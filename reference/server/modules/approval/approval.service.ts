import { Injectable, Inject, Logger, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase, AuthNPaasService } from '@lark-apaas/fullstack-nestjs-core';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, ne, inArray, lte, gte, ilike, count, asc, not, max, sql, isNull } from 'drizzle-orm';
import { changeRequests, logbook, administrators } from '@server/database/schema';
import type {
  AttachmentInfo, ApprovalRecord, BatchApproveResult,
  AdminCheckResponse, VehicleDetailResponse, ApprovalRequestListResponse,
  PendingLogbookRow, MarkSyncedResult, FollowUpItem,
  PendingVehicleSyncRow, ExecuteVehicleSyncResult,
  EditHistoryEntry, EditRequest,
  ArchiveQuery, ArchiveListResponse,
  SyncStatusResponse,
} from '@shared/api.interface';
import { formatLogbookDate } from '@shared/format-logbook-date';

import { CHANGE_TYPES, getChangeType, isSubmittableChangeType } from '@shared/change-types';
import type { ChangeTypeDef } from '@shared/change-types';
import { getSyncMode, getTestVehicleLicenses, isTestVehicle } from '@server/common/sync-mode';

const VEHICLE_PLUGIN_ID = 'vehicle_list_draft_readonly_query_3';
const VEHICLE_WRITE_PLUGIN_ID = 'vehicle_list_draft_batch_update_1';

/** 規範化字段名：折疊空白與換行、忽略大小寫，用於穩健匹配 Base 返回的字段 */
function normalizeKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 先精確取值，取不到再按規範化字段名匹配（容忍大小寫 / 空格 / 換行差異） */
function getFieldValueRobust(record: Record<string, unknown>, fieldName: string): unknown {
  if (fieldName in record) return record[fieldName];
  const target = normalizeKey(fieldName);
  for (const key of Object.keys(record)) {
    if (normalizeKey(key) === target) return record[key];
  }
  return undefined;
}

const WHITELIST_FIELDS = new Set([
  'VicLicense', 'Status', 'Make', 'Model', 'Colour',
  'Veh. Class', 'Fuel type', 'Company', 'Department',
  'Section', 'Transport Coordinator', 'Parking Location',
]);

function getTextValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'text' in val) {
    return (val as { text: string }).text ?? '';
  }
  return String(val);
}

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly capabilityService: CapabilityService,
    private readonly authn: AuthNPaasService,
  ) {}

  /**
   * 按車牌號在車輛表中重新解析 record ID。
   * 用途：Base 車輛表若被全量重新導入，record ID 會重新生成，
   * 申請記錄中存的 vehicleId 隨之失效。車牌號是業務主鍵，可靠得多。
   */
  private async resolveRecordIdByLicense(license: string): Promise<string | null> {
    const target = (license ?? '').trim().toLowerCase();
    if (!target) return null;
    try {
      const result = await this.capabilityService.load(VEHICLE_PLUGIN_ID).call('searchRecords', {
        filter: {
          conjunction: 'and',
          conditions: [{ fieldName: 'VicLicense', operator: 'contains', value: [license.trim()] }],
        },
        fieldNames: ['VicLicense'],
        pageSize: 20,
      }) as { records?: Array<{ id: string; record: Record<string, unknown> }> };

      const exact = (result.records ?? []).filter(
        (r) => getTextValue(r.record['VicLicense']).trim().toLowerCase() === target,
      );
      if (exact.length === 1) return exact[0].id;
      if (exact.length > 1) {
        this.logger.error(`[SYNC] 車牌 ${license} 在車輛表中匹配到多條記錄，無法唯一解析`);
      }
      return null;
    } catch (err) {
      this.logger.error(`[SYNC] resolveRecordIdByLicense failed for ${license}: ${String(err)}`);
      return null;
    }
  }

  private async requireAdmin(userId: string): Promise<void> {
    // 空 userId（匿名或身份缺失）直接拒絕：空值進 user_profile 比較會觸發 PG 42846，變成 500 而非 403
    if (!userId || !userId.trim()) {
      throw new ForbiddenException('您沒有管理員權限');
    }
    const rows = await this.db.select({ userId: administrators.userId })
      .from(administrators)
      .where(eq(administrators.userId, userId))
      .limit(1);
    if (rows.length === 0) {
      throw new ForbiddenException('您沒有管理員權限');
    }
  }

  /** change_requests 行 → ApprovalRecord，listRequests / listMyRequests / listArchive / editRequest 共用 */
  private toApprovalRecord(r: typeof changeRequests.$inferSelect): ApprovalRecord {
    return {
      id: r.id,
      changeType: r.changeType,
      vehicleId: r.vehicleId,
      vehicleLicense: r.vehicleLicense,
      logFrom: r.logFrom,
      logTo: r.logTo,
      effectiveDate: r.effectiveDate ? r.effectiveDate.toISOString().slice(0, 10) : null,
      effectiveDateTs: r.effectiveDate ? r.effectiveDate.getTime() : null,
      remark: r.remark,
      status: r.status,
      applyTime: r.createdAt.toISOString(),
      attachments: (r.attachments as AttachmentInfo[]) ?? [],
      approverName: r.approver ?? undefined,
      approvalTime: r.approvalTime ? r.approvalTime.toISOString() : undefined,
      approvalComment: r.approvalComment ?? undefined,
      editHistory: (r.editHistory as EditHistoryEntry[]) ?? [],
    };
  }

  /**
   * 將單個車輛字段寫回 Base 車輛表，含寫入、讀回校驗、record ID 兜底重解析。
   * approve() 與補同步共用同一套邏輯，避免兩份實現漂移。
   */
  private async syncVehicleFieldToBase(params: {
    vehicleLicense: string;
    vehicleId: string;
    fieldName: string;
    expectedValue: string;
  }): Promise<{ ok: true; resolvedRecordId: string } | { ok: false; error: string }> {
    const { vehicleLicense, vehicleId, fieldName, expectedValue } = params;
    let targetRecordId = vehicleId;
    let lastError = '';

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!targetRecordId) {
        lastError = '無法確定車輛記錄 ID';
      } else {
        try {
          await this.capabilityService.load(VEHICLE_WRITE_PLUGIN_ID).call('batchUpdateRecords', {
            records: [{
              id: targetRecordId,
              record: { [fieldName]: expectedValue },
            }],
          });

          const verifyResult = await this.capabilityService.load(VEHICLE_PLUGIN_ID)
            .call('getRecord', { recordID: targetRecordId }) as { record?: Record<string, unknown> };
          const actualValue = getTextValue(
            getFieldValueRobust(verifyResult.record ?? {}, fieldName),
          ).trim();

          if (actualValue === expectedValue) {
            return { ok: true, resolvedRecordId: targetRecordId };
          }
          lastError = `寫入校驗失敗：期望「${expectedValue}」，實際讀回「${actualValue}」`;
        } catch (pluginErr) {
          lastError = String(pluginErr);
          this.logger.error(`[SYNC] Plugin update failed: ${lastError}`);
        }
      }

      if (attempt === 0) {
        const resolved = await this.resolveRecordIdByLicense(vehicleLicense);
        if (resolved && resolved !== targetRecordId) {
          this.logger.warn(
            `[SYNC] record ID 已失效，按車牌重新解析：${vehicleLicense} ` +
            `${targetRecordId} -> ${resolved}`,
          );
          targetRecordId = resolved;
        } else {
          break;
        }
      }
    }

    return { ok: false, error: lastError };
  }

  async checkAdmin(userId: string): Promise<AdminCheckResponse> {
    const rows = await this.db.select({ userId: administrators.userId })
      .from(administrators)
      .where(eq(administrators.userId, userId))
      .limit(1);
    return {
      isAdmin: rows.length > 0,
      syncMode: getSyncMode(),
      testVehicleLicenses: getTestVehicleLicenses(),
    };
  }

  async getVehicleDetail(vehicleId: string, isAdmin: boolean): Promise<VehicleDetailResponse> {
    const result = await this.capabilityService.load(VEHICLE_PLUGIN_ID).call('getRecord', { recordID: vehicleId }) as {
      id: string;
      record?: Record<string, unknown>;
    };

    const record = result.record ?? {};

    const base: VehicleDetailResponse = {
      id: result.id,
      vicLicense: getTextValue(record['VicLicense']),
      status: getTextValue(record['Status']),
      make: getTextValue(record['Make']),
      model: getTextValue(record['Model']),
      colour: getTextValue(record['Colour']),
      vehClass: getTextValue(record['Veh. Class']),
      fuelType: getTextValue(record['Fuel type']),
      company: getTextValue(record['Company']),
      department: getTextValue(record['Department']),
      section: getTextValue(record['Section']),
      transportCoordinator: getTextValue(record['Transport Coordinator']),
      parkingLocationName: getTextValue(record['Parking Location']),
    };

    if (isAdmin) {
      const extraFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (!WHITELIST_FIELDS.has(key)) {
          extraFields[key] = value;
        }
      }
      base.extraFields = extraFields;
    }

    return base;
  }

  async listRequests(status: string | undefined, userId: string): Promise<ApprovalRequestListResponse> {
    await this.requireAdmin(userId);

    const conditions = [ne(changeRequests.status, '草稿')];
    if (status && status !== '全部') {
      conditions.push(eq(changeRequests.status, status));
    }

    const rows = await this.db.select().from(changeRequests)
      .where(and(...conditions))
      .orderBy(desc(changeRequests.createdAt));

    const items: ApprovalRecord[] = rows.map((r: typeof changeRequests.$inferSelect) =>
      this.toApprovalRecord(r),
    );
    await this.attachApplicantNames(items, rows);

    return { items, total: items.length };
  }

  /**
   * 批量解析申請人姓名：createdBy(miaoda user_id) → name（en_us 優先）。
   * 查無此人時留 undefined，前端顯示佔位；平台錯誤向上拋（不吞）。
   */
  private async attachApplicantNames(
    items: ApprovalRecord[],
    rows: (typeof changeRequests.$inferSelect)[],
  ): Promise<void> {
    const ids: string[] = [
      ...new Set(
        rows
          .map((r: typeof changeRequests.$inferSelect) => r.createdBy)
          .filter(
            (id: string | null): id is string =>
              typeof id === 'string' && id.trim().length > 0,
          ),
      ),
    ];
    if (ids.length === 0) return;

    const users = await this.authn.listUsersByIds(ids);
    const nameById = new Map<string, string>();
    users.forEach((u, i: number) => {
      const name: string = u?.name?.en_us ?? u?.name?.zh_cn ?? '';
      if (name) nameById.set(ids[i], name);
    });
    items.forEach((item: ApprovalRecord, i: number) => {
      const id: string | null = rows[i].createdBy;
      item.applicantName = id ? nameById.get(id) : undefined;
    });
  }

  async listMyRequests(userId: string): Promise<ApprovalRecord[]> {
    const rows = await this.db.select().from(changeRequests)
      .where(and(
        eq(changeRequests.createdBy, userId),
        ne(changeRequests.status, '草稿'),
      ))
      .orderBy(desc(changeRequests.createdAt));

    return rows.map((r: typeof changeRequests.$inferSelect) => this.toApprovalRecord(r));
  }

  /**
   * 管理員申請檔案檢索：多條件篩選 + 分頁，恆排除「草稿」。
   * 業務時區 Asia/Shanghai，日期範圍直接拼 +08:00 偏移。
   */
  async listArchive(query: ArchiveQuery, userId: string): Promise<ArchiveListResponse> {
    await this.requireAdmin(userId);

    const conditions = [ne(changeRequests.status, '草稿')];

    const vehicleLicense: string = (query.vehicleLicense ?? '').trim();
    if (vehicleLicense) {
      const escaped: string = vehicleLicense.replace(/[\\%_]/g, (c: string) => '\\' + c);
      conditions.push(ilike(changeRequests.vehicleLicense, `%${escaped}%`));
    }

    const applicant: string = (query.applicant ?? '').trim();
    if (applicant) {
      conditions.push(eq(changeRequests.createdBy, applicant));
    }

    const changeType: string = (query.changeType ?? '').trim();
    const category: string = (query.category ?? '').trim();
    if (changeType) {
      // changeType 與 category 同傳時以 changeType 為準，忽略 category
      conditions.push(eq(changeRequests.changeType, changeType));
    } else if (category) {
      const ids: string[] = CHANGE_TYPES
        .filter((d) => d.category === category)
        .map((d) => d.id);
      if (ids.length > 0) {
        conditions.push(inArray(changeRequests.changeType, ids));
      } else {
        // 未知類別：恆假條件，結果為空
        conditions.push(eq(changeRequests.changeType, '__none__'));
      }
    }

    if (query.status && query.status !== '全部') {
      conditions.push(eq(changeRequests.status, query.status));
    }

    const dateFrom: string = (query.dateFrom ?? '').trim();
    if (dateFrom) {
      conditions.push(gte(changeRequests.createdAt, new Date(dateFrom + 'T00:00:00.000+08:00')));
    }

    const dateTo: string = (query.dateTo ?? '').trim();
    if (dateTo) {
      conditions.push(lte(changeRequests.createdAt, new Date(dateTo + 'T23:59:59.999+08:00')));
    }

    const page: number = Math.max(1, parseInt(query.page ?? '', 10) || 1);
    const pageSize: number = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '', 10) || 20));

    const countRows = await this.db.select({ count: count() })
      .from(changeRequests)
      .where(and(...conditions));
    const total: number = Number(countRows[0]?.count ?? 0);

    const rows = await this.db.select().from(changeRequests)
      .where(and(...conditions))
      .orderBy(desc(changeRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map((r: typeof changeRequests.$inferSelect) => this.toApprovalRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async editRequest(id: string, dto: EditRequest, userId: string): Promise<ApprovalRecord> {
    await this.requireAdmin(userId);

    const existing = await this.db.select().from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('申請不存在');
    const req = existing[0];

    if (req.status !== '待审批') {
      throw new BadRequestException('只能編輯「待審批」狀態的申請，當前狀態：' + req.status);
    }

    const changes: EditHistoryEntry['changes'] = [];

    if (dto.changeType !== undefined) {
      if (!isSubmittableChangeType(dto.changeType)) {
        throw new BadRequestException('變更類型「' + dto.changeType + '」未開放，無法提交');
      }
      if (dto.logTo === undefined) {
        throw new BadRequestException('修改變更類型時必須同時填寫新的 Log-To');
      }
      if (dto.changeType !== req.changeType) {
        changes.push({ field: 'changeType', from: req.changeType, to: dto.changeType });
      }
    }

    if (dto.logFrom !== undefined && dto.logFrom !== req.logFrom) {
      changes.push({ field: 'logFrom', from: req.logFrom, to: dto.logFrom });
    }
    if (dto.logTo !== undefined && dto.logTo !== req.logTo) {
      changes.push({ field: 'logTo', from: req.logTo, to: dto.logTo });
    }
    if (dto.effectiveDate !== undefined) {
      const newDate = dto.effectiveDate ? dto.effectiveDate : null;
      const oldDate = req.effectiveDate
        ? new Date(req.effectiveDate).toISOString().slice(0, 10)
        : '';
      if (newDate !== oldDate) {
        changes.push({ field: 'effectiveDate', from: oldDate, to: newDate ?? '' });
      }
    }
    if (dto.remark !== undefined && dto.remark !== req.remark) {
      changes.push({ field: 'remark', from: req.remark, to: dto.remark });
    }

    if (changes.length === 0) {
      throw new BadRequestException('未做任何修改');
    }

    const entry: EditHistoryEntry = {
      editedAt: new Date().toISOString(),
      editedBy: userId,
      changes,
    };

    const now = new Date();

    const updated = await this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (dto.changeType !== undefined) patch.changeType = dto.changeType;
      if (dto.logFrom !== undefined) patch.logFrom = dto.logFrom;
      if (dto.logTo !== undefined) patch.logTo = dto.logTo;
      if (dto.effectiveDate !== undefined) {
        patch.effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : null;
      }
      if (dto.remark !== undefined) patch.remark = dto.remark;

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        patch.updatedBy = userId;
      }

      const prevHistory = (req.editHistory as EditHistoryEntry[]) ?? [];
      patch.editHistory = [...prevHistory, entry];

      const [row] = await tx.update(changeRequests)
        .set(patch as typeof changeRequests.$inferInsert)
        .where(and(eq(changeRequests.id, id), eq(changeRequests.status, '待审批')))
        .returning();

      if (!row) throw new NotFoundException('申請已被處理或不存在');
      return row;
    });

    return this.toApprovalRecord(updated);
  }

  async approve(id: string, approvalComment: string | undefined, userId: string): Promise<{ id: string; status: string }> {
    await this.requireAdmin(userId);

    const existing = await this.db.select().from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('申請不存在');
    const req = existing[0];

    if (req.status !== '待审批') {
      throw new BadRequestException('該申請無法批准，當前狀態：' + req.status);
    }

    // ── 測試模式白名單校驗：僅允許批准測試車輛的申請 ──
    const syncMode = getSyncMode();
    if (syncMode === 'test' && !isTestVehicle(req.vehicleLicense)) {
      const testLicenses = getTestVehicleLicenses().join('、');
      throw new BadRequestException(
        `當前為測試模式，只能批准測試車輛（${testLicenses}）的申請。` +
        `如需批准真實申請，請將 SYNC_MODE 改為 production。`,
      );
    }

    // ── 第 0 階段分流：批准後做什麼由註冊表決定，不再由散落的硬編碼集合決定 ──
    const def = getChangeType(req.changeType);
    if (!def) {
      throw new BadRequestException(
        `未登記的變更類型「${req.changeType}」，無法確定批准後應執行的動作。` +
        `請先在 shared/change-types.ts 中補登記。`,
      );
    }
    // 帶 handler 的類型（寫飛書自有表的第三類動作）處理邏輯尚未實現。
    // 寧可在此拋錯，也不讓申請「批准成功但什麼都沒發生」。
    if (def.handler) {
      throw new BadRequestException(
        `變更類型「${def.label}」的處理邏輯（${def.handler}）尚未實現，暫時無法批准。`,
      );
    }

    const now = new Date();

    try {
      return await this.db.transaction(async (tx) => {
        // 生效日期為今天或更早才立即同步；未來生效的只寫 Logbook，等到日子由對賬流程處理
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const effectiveDate = req.effectiveDate ? new Date(req.effectiveDate) : null;
        const isEffectiveNow = !effectiveDate || effectiveDate <= todayEnd;
        const shouldSync = def.syncsVehicleField && isEffectiveNow;

        this.logger.log(
          `[SYNC] request=${id} type=${req.changeType} effective=${effectiveDate?.toISOString() ?? 'null'} ` +
          `writesLogbook=${def.writesLogbook} syncsVehicleField=${def.syncsVehicleField} ` +
          `effectiveNow=${isEffectiveNow} shouldSync=${shouldSync}`,
        );

        // 分流一：是否生成 Logbook 行（== 這條變更最終是否要回到 Excel）
        if (def.writesLogbook) {
          const [logEntry] = await tx.insert(logbook).values({
            logDate: req.effectiveDate ?? now,
            vicLicense: req.vehicleLicense,
            changeType: def.excelLogbookType,
            logFrom: req.logFrom,
            logTo: req.logTo,
            remark: req.remark,
            syncStatus: '未同步',
            sourceRequestId: req.id,
            createdBy: userId,
          }).returning({ id: logbook.id });

          if (!logEntry) throw new Error('寫入 Logbook 失敗');
        }

        let vehicleSyncedAt: Date | null = null;

        // 分流二：是否自動寫回 Base 車輛表
        if (shouldSync) {
          const fieldName = def.vehicleField;
          if (!fieldName) throw new Error(`變更類型「${def.id}」缺少 vehicleField`);
          const result = await this.syncVehicleFieldToBase({
            vehicleLicense: req.vehicleLicense,
            vehicleId: req.vehicleId,
            fieldName,
            expectedValue: (req.logTo ?? '').trim(),
          });

          if (!result.ok) {
            const fail = result as { ok: false; error: string };
            throw new Error(
              `更新車輛字段失敗（${req.vehicleLicense} / ${fieldName}）：${fail.error}。` +
              `請檢查寫入插件的字段映射，或該車輛在 Base 中是否存在。`,
            );
          }

          if (result.resolvedRecordId !== req.vehicleId) {
            await tx.update(changeRequests)
              .set({ vehicleId: result.resolvedRecordId })
              .where(eq(changeRequests.id, id));
          }

          vehicleSyncedAt = now;
        }

        const [updated] = await tx.update(changeRequests)
          .set({
            status: '已批准',
            approver: userId,
            approvalTime: now,
            approvalComment: approvalComment ?? null,
            vehicleSyncedAt: vehicleSyncedAt,
            updatedAt: now,
            updatedBy: userId,
          })
          .where(eq(changeRequests.id, id))
          .returning({ id: changeRequests.id, status: changeRequests.status });

        if (!updated) throw new Error('更新申請狀態失敗');

        return { id: updated.id, status: updated.status };
      });
    } catch (err) {
      const code = extractPostgresErrorCode(err);
      if (code === '23505') {
        throw new ConflictException('記錄重複，請稍後重試');
      }
      this.logger.error(`Approve failed: ${String(err)}`);
      throw new BadRequestException('批准失敗：' + String(err));
    }
  }

  async reject(id: string, approvalComment: string, userId: string): Promise<{ id: string; status: string }> {
    await this.requireAdmin(userId);

    if (!approvalComment || !approvalComment.trim()) {
      throw new BadRequestException('拒絕時必須填寫審批意見');
    }

    const existing = await this.db.select().from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('申請不存在');
    const req = existing[0];

    if (req.status !== '待审批') {
      throw new BadRequestException('該申請無法拒絕，當前狀態：' + req.status);
    }

    const now = new Date();
    const [updated] = await this.db.update(changeRequests)
      .set({
        status: '已拒絕',
        approver: userId,
        approvalTime: now,
        approvalComment: approvalComment.trim(),
        updatedAt: now,
        updatedBy: userId,
      })
      .where(eq(changeRequests.id, id))
      .returning({ id: changeRequests.id, status: changeRequests.status });

    if (!updated) throw new NotFoundException('申請不存在');

    return { id: updated.id, status: updated.status };
  }

  /**
   * Follow-up 列表：已批准且 writesLogbook === false 的申請（補領類、其他）。
   * 這類申請批准後不進 Logbook、不寫回 Base，需要管理員線下逐條處理。
   * 類型集合由註冊表派生，禁止硬編碼類型 id。
   */
  async listFollowUps(userId: string): Promise<FollowUpItem[]> {
    await this.requireAdmin(userId);

    const offlineTypeIds: string[] = CHANGE_TYPES
      .filter((d: ChangeTypeDef) => !d.writesLogbook)
      .map((d: ChangeTypeDef) => d.id);

    const rows = await this.db.select().from(changeRequests)
      .where(and(
        eq(changeRequests.status, '已批准'),
        inArray(changeRequests.changeType, offlineTypeIds),
        isNull(changeRequests.followUpCompletedAt),
      ))
      .orderBy(desc(changeRequests.approvalTime))
      .limit(50);

    const records: ApprovalRecord[] = rows.map((r: typeof changeRequests.$inferSelect) =>
      this.toApprovalRecord(r),
    );
    await this.attachApplicantNames(records, rows);

    return records.map((r: ApprovalRecord) => ({
      id: r.id,
      changeType: r.changeType,
      vehicleLicense: r.vehicleLicense,
      remark: r.remark,
      effectiveDate: r.effectiveDate,
      approvalTime: r.approvalTime ?? null,
      applicantName: r.applicantName,
    }));
  }

  async listPendingLogbook(userId: string): Promise<PendingLogbookRow[]> {
    await this.requireAdmin(userId);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const pendingSyncMode = getSyncMode();
    const testLicenses = getTestVehicleLicenses();

    const conditions: ReturnType<typeof and>[] = [
      eq(logbook.syncStatus, '未同步'),
      lte(logbook.logDate, todayEnd),
    ];

    if (pendingSyncMode === 'production' && testLicenses.length > 0) {
      conditions.push(not(inArray(logbook.vicLicense, testLicenses)));
    }

    const rows = await this.db.select({
      id: logbook.id,
      logDate: logbook.logDate,
      vicLicense: logbook.vicLicense,
      changeType: logbook.changeType,
      logFrom: logbook.logFrom,
      logTo: logbook.logTo,
      remark: logbook.remark,
      createdAt: logbook.createdAt,
    })
      .from(logbook)
      .innerJoin(
        changeRequests,
        and(
          eq(logbook.sourceRequestId, changeRequests.id),
          eq(changeRequests.status, '已批准'),
        ),
      )
      .where(and(...conditions))
      .orderBy(asc(logbook.logDate), asc(logbook.createdAt));

    return rows.map((r) => ({
      id: r.id,
      logDate: formatLogbookDate(r.logDate),
      vicLicense: r.vicLicense,
      changeType: r.changeType,
      logFrom: r.logFrom,
      logTo: r.logTo,
      remark: r.remark,
      isTestVehicle: isTestVehicle(r.vicLicense),
    }));
  }

  async markLogbookSynced(userId: string, ids: string[]): Promise<MarkSyncedResult> {
    await this.requireAdmin(userId);

    if (!ids || ids.length === 0) {
      return { updatedCount: 0 };
    }

    const now = new Date();
    const result = await this.db.update(logbook)
      .set({
        syncStatus: '已同步',
        updatedAt: now,
        updatedBy: userId,
      })
      .where(and(
        inArray(logbook.id, ids),
        eq(logbook.syncStatus, '未同步'),
      ))
      .returning({ id: logbook.id });

    return { updatedCount: result.length };
  }

  /**
   * Follow-up 標記完成：已批准且 writesLogbook === false 的申請線下處理完後，
   * 寫入 follow_up_completed_at 從 Follow-up 列表移除（狀態保持已批准，檔案可查）。
   */
  async markFollowUpsComplete(userId: string, ids: string[]): Promise<MarkSyncedResult> {
    await this.requireAdmin(userId);

    if (!ids || ids.length === 0) {
      return { updatedCount: 0 };
    }

    const now = new Date();
    const result = await this.db.update(changeRequests)
      .set({
        followUpCompletedAt: now,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(and(
        inArray(changeRequests.id, ids),
        eq(changeRequests.status, '已批准'),
        isNull(changeRequests.followUpCompletedAt),
      ))
      .returning({ id: changeRequests.id });

    return { updatedCount: result.length };
  }

  async batchApprove(ids: string[], approvalComment: string | undefined, userId: string): Promise<BatchApproveResult> {
    await this.requireAdmin(userId);

    const results: BatchApproveResult['results'] = [];
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        await this.approve(id, approvalComment, userId);
        results.push({ id, success: true });
        successCount += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ id, success: false, error: message });
        failCount += 1;
      }
    }

    return { results, successCount, failCount };
  }

  async listPendingVehicleSync(userId: string): Promise<PendingVehicleSyncRow[]> {
    await this.requireAdmin(userId);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const rows = await this.db.select({
      id: changeRequests.id,
      vehicleLicense: changeRequests.vehicleLicense,
      changeType: changeRequests.changeType,
      logTo: changeRequests.logTo,
      effectiveDate: changeRequests.effectiveDate,
      vehicleId: changeRequests.vehicleId,
    })
      .from(changeRequests)
      .where(and(
        eq(changeRequests.status, '已批准'),
        sql`${changeRequests.vehicleSyncedAt} IS NULL`,
        lte(changeRequests.effectiveDate, todayEnd),
      ))
      .orderBy(asc(changeRequests.effectiveDate), asc(changeRequests.createdAt));

    const result: PendingVehicleSyncRow[] = [];
    for (const row of rows) {
      const def = getChangeType(row.changeType);
      if (!def || !def.syncsVehicleField || !def.vehicleField) continue;

      let currentBaseValue = '';
      try {
        const vehicleResult = await this.capabilityService.load(VEHICLE_PLUGIN_ID)
          .call('getRecord', { recordID: row.vehicleId }) as { record?: Record<string, unknown> };
        currentBaseValue = getTextValue(
          getFieldValueRobust(vehicleResult.record ?? {}, def.vehicleField),
        ).trim();
      } catch (err) {
        this.logger.error(`[PENDING-VEHICLE-SYNC] Failed to read Base value for ${row.vehicleLicense}: ${String(err)}`);
        currentBaseValue = '（讀取失敗）';
      }

      result.push({
        id: row.id,
        vehicleLicense: row.vehicleLicense,
        changeType: row.changeType,
        logTo: row.logTo,
        effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : '',
        currentBaseValue,
      });
    }

    return result;
  }

  /**
   * 同步狀態條：待同步條數（與 listPendingVehicleSync 相同的待同步謂詞）
   * + 最後一次成功寫回 Base 車輛表的時間。
   */
  async getSyncStatus(userId: string): Promise<SyncStatusResponse> {
    await this.requireAdmin(userId);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 待同步謂詞與 listPendingVehicleSync 一致：已批准 + 已到生效日 + 未寫回；
    // change_type 限 syncsVehicleField 的類型（該方法在 JS 層過濾，此處下推到 DB）
    const syncingTypeIds: string[] = CHANGE_TYPES
      .filter((d: ChangeTypeDef) => d.syncsVehicleField)
      .map((d: ChangeTypeDef) => d.id);

    const pendingRows: Array<{ count: string | number }> = await this.db
      .select({ count: count() })
      .from(changeRequests)
      .where(and(
        eq(changeRequests.status, '已批准'),
        sql`${changeRequests.vehicleSyncedAt} IS NULL`,
        lte(changeRequests.effectiveDate, todayEnd),
        inArray(changeRequests.changeType, syncingTypeIds),
      ));
    const pendingCount: number = Number(pendingRows[0]?.count ?? 0);

    const maxRows: Array<{ lastSyncedAt: Date | null }> = await this.db
      .select({ lastSyncedAt: max(changeRequests.vehicleSyncedAt) })
      .from(changeRequests);
    const lastSyncedAtDate: Date | null = maxRows[0]?.lastSyncedAt ?? null;

    return {
      pendingCount,
      lastSyncedAt: lastSyncedAtDate ? lastSyncedAtDate.toISOString() : null,
    };
  }

  async executeVehicleSync(userId: string, ids: string[]): Promise<ExecuteVehicleSyncResult> {
    await this.requireAdmin(userId);

    const syncMode = getSyncMode();
    const results: ExecuteVehicleSyncResult['results'] = [];
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const existing = await this.db.select({
          id: changeRequests.id,
          status: changeRequests.status,
          vehicleLicense: changeRequests.vehicleLicense,
          vehicleId: changeRequests.vehicleId,
          changeType: changeRequests.changeType,
          logTo: changeRequests.logTo,
          vehicleSyncedAt: changeRequests.vehicleSyncedAt,
        })
          .from(changeRequests)
          .where(eq(changeRequests.id, id))
          .limit(1);

        if (existing.length === 0) {
          results.push({ id, success: false, error: '申請不存在' });
          failCount += 1;
          continue;
        }

        const req = existing[0];

        if (req.status !== '已批准') {
          results.push({ id, success: false, error: '該申請狀態非「已批准」' });
          failCount += 1;
          continue;
        }

        if (req.vehicleSyncedAt !== null) {
          results.push({ id, success: false, error: '該申請已同步過' });
          failCount += 1;
          continue;
        }

        if (syncMode === 'test' && !isTestVehicle(req.vehicleLicense)) {
          const testLicenses = getTestVehicleLicenses().join('、');
          results.push({
            id, success: false,
            error: `當前為測試模式，只能同步測試車輛（${testLicenses}）的申請。`,
          });
          failCount += 1;
          continue;
        }

        const def = getChangeType(req.changeType);
        if (!def || !def.syncsVehicleField || !def.vehicleField) {
          results.push({ id, success: false, error: '該變更類型不支援同步至 Base' });
          failCount += 1;
          continue;
        }

        const syncResult = await this.syncVehicleFieldToBase({
          vehicleLicense: req.vehicleLicense,
          vehicleId: req.vehicleId,
          fieldName: def.vehicleField,
          expectedValue: (req.logTo ?? '').trim(),
        });

        if (!syncResult.ok) {
          const fail = syncResult as { ok: false; error: string };
          results.push({ id, success: false, error: fail.error });
          failCount += 1;
          continue;
        }

        const now = new Date();
        await this.db.update(changeRequests)
          .set({
            vehicleSyncedAt: now,
            vehicleId: syncResult.resolvedRecordId,
            updatedAt: now,
            updatedBy: userId,
          })
          .where(eq(changeRequests.id, id));

        results.push({ id, success: true });
        successCount += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ id, success: false, error: message });
        failCount += 1;
      }
    }

    return { results, successCount, failCount };
  }
}