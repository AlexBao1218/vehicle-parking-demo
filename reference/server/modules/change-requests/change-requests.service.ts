import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, inArray } from 'drizzle-orm';
import { changeRequests } from '@server/database/schema';
import type { DraftRecord, AttachmentInfo, CreateDraftRequest, UpdateDraftRequest } from '@shared/api.interface';
import { getChangeType, isSubmittableChangeType } from '@shared/change-types';

@Injectable()
export class ChangeRequestsService {
  private readonly logger = new Logger(ChangeRequestsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 校驗變更類型是否已登記且已開放。
   *
   * 攔截點必須在「建草稿 / 改草稿 / 提交」三處，而不能只在批准處：
   * 只在批准攔的話，手工構造的請求已經能把未開放類型推進待審批列表，
   * admin 會看到一條批不掉的僵屍記錄（拒絕倒是能拒）。
   */
  private assertSubmittable(changeType: string): void {
    const def = getChangeType(changeType);
    if (!def) {
      throw new BadRequestException(`未知的變更類型「${changeType}」`);
    }
    if (!def.enabled) {
      throw new BadRequestException(`變更類型「${def.label}」尚未開放，暫時無法提交`);
    }
  }

  async listDrafts(userId: string): Promise<DraftRecord[]> {
    const rows = await this.db.select().from(changeRequests)
      .where(and(
        eq(changeRequests.status, '草稿'),
        eq(changeRequests.createdBy, userId),
      ))
      .orderBy(changeRequests.createdAt);

    return rows.map((r) => ({
      id: r.id,
      changeType: r.changeType,
      vehicleId: r.vehicleId,
      vehicleLicense: r.vehicleLicense,
      logFrom: r.logFrom,
      logTo: r.logTo,
      effectiveDate: r.effectiveDate ? r.effectiveDate.toISOString().slice(0, 10) : null,
      effectiveDateTs: r.effectiveDate ? r.effectiveDate.getTime() : null,
      remark: r.remark,
      attachments: (r.attachments as AttachmentInfo[]) ?? [],
      status: r.status,
      applyTime: r.createdAt.toISOString(),
    }));
  }

  async listLegacyDrafts(userId: string): Promise<DraftRecord[]> {
    const rows = await this.db.select().from(changeRequests)
      .where(and(
        eq(changeRequests.status, ''),
        eq(changeRequests.createdBy, userId),
      ))
      .orderBy(changeRequests.createdAt);

    return rows.map((r) => ({
      id: r.id,
      changeType: r.changeType,
      vehicleId: r.vehicleId,
      vehicleLicense: r.vehicleLicense,
      logFrom: r.logFrom,
      logTo: r.logTo,
      effectiveDate: r.effectiveDate ? r.effectiveDate.toISOString().slice(0, 10) : null,
      effectiveDateTs: r.effectiveDate ? r.effectiveDate.getTime() : null,
      remark: r.remark,
      attachments: (r.attachments as AttachmentInfo[]) ?? [],
      status: r.status,
      applyTime: r.createdAt.toISOString(),
      isLegacy: true,
    }));
  }

  async createDraft(dto: CreateDraftRequest, userId: string): Promise<DraftRecord> {
    this.assertSubmittable(dto.changeType);
    this.logger.log('[DEBUG] att-5 createDraft attachments:', JSON.stringify(dto.attachments));
    const [row] = await this.db.insert(changeRequests).values({
      changeType: dto.changeType,
      vehicleId: dto.vehicleId,
      vehicleLicense: dto.vehicleLicense,
      logFrom: dto.logFrom,
      logTo: dto.logTo,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
      remark: dto.remark,
      status: '草稿',
      attachments: dto.attachments as unknown as Record<string, unknown>[],
      createdBy: userId,
    }).returning();

    if (!row) throw new BadRequestException('创建草稿失败');

    return {
      id: row.id,
      changeType: row.changeType,
      vehicleId: row.vehicleId,
      vehicleLicense: row.vehicleLicense,
      logFrom: row.logFrom,
      logTo: row.logTo,
      effectiveDate: row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : null,
      effectiveDateTs: row.effectiveDate ? row.effectiveDate.getTime() : null,
      remark: row.remark,
      attachments: (row.attachments as AttachmentInfo[]) ?? [],
      status: row.status,
      applyTime: row.createdAt.toISOString(),
    };
  }

  async updateDraft(id: string, dto: UpdateDraftRequest, userId: string): Promise<DraftRecord> {
    if (dto.changeType !== undefined) this.assertSubmittable(dto.changeType);
    this.logger.log('[DEBUG] att-5 updateDraft attachments:', JSON.stringify(dto.attachments));
    const existing = await this.db.select().from(changeRequests)
      .where(and(eq(changeRequests.id, id), eq(changeRequests.createdBy, userId)))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('草稿不存在');

    const patch: Partial<typeof changeRequests.$inferInsert> = {};
    if (dto.changeType !== undefined) patch.changeType = dto.changeType;
    if (dto.vehicleId !== undefined) patch.vehicleId = dto.vehicleId;
    if (dto.vehicleLicense !== undefined) patch.vehicleLicense = dto.vehicleLicense;
    if (dto.logFrom !== undefined) patch.logFrom = dto.logFrom;
    if (dto.logTo !== undefined) patch.logTo = dto.logTo;
    if (dto.effectiveDate !== undefined) patch.effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : null;
    if (dto.remark !== undefined) patch.remark = dto.remark;
    if (dto.attachments !== undefined) patch.attachments = dto.attachments as unknown as Record<string, unknown>[];

    if (Object.keys(patch).length === 0) throw new BadRequestException('未提供可更新字段');

    const [updated] = await this.db.update(changeRequests)
      .set(patch)
      .where(eq(changeRequests.id, id))
      .returning();

    if (!updated) throw new NotFoundException('草稿不存在');

    return {
      id: updated.id,
      changeType: updated.changeType,
      vehicleId: updated.vehicleId,
      vehicleLicense: updated.vehicleLicense,
      logFrom: updated.logFrom,
      logTo: updated.logTo,
      effectiveDate: updated.effectiveDate ? updated.effectiveDate.toISOString().slice(0, 10) : null,
      effectiveDateTs: updated.effectiveDate ? updated.effectiveDate.getTime() : null,
      remark: updated.remark,
      attachments: (updated.attachments as AttachmentInfo[]) ?? [],
      status: updated.status,
      applyTime: updated.createdAt.toISOString(),
    };
  }

  async deleteDraft(id: string, userId: string): Promise<void> {
    const [deleted] = await this.db.delete(changeRequests)
      .where(and(eq(changeRequests.id, id), eq(changeRequests.createdBy, userId)))
      .returning({ id: changeRequests.id });

    if (!deleted) throw new NotFoundException('草稿不存在');
  }

  async submitDrafts(ids: string[], userId: string): Promise<number> {
    // 整批預檢：類型可能在草稿保存之後被下線，逐條放行會讓一部分申請進入無法處理的狀態。
    // 購物車模式下用戶預期「全部提交」是一個原子動作，因此有任一條不合格即整批拒絕。
    const targets = await this.db.select({
      id: changeRequests.id,
      changeType: changeRequests.changeType,
    }).from(changeRequests)
      .where(and(
        inArray(changeRequests.id, ids),
        eq(changeRequests.createdBy, userId),
        eq(changeRequests.status, '草稿'),
      ));

    const blocked = targets.filter((t) => !isSubmittableChangeType(t.changeType));
    if (blocked.length > 0) {
      const names = [...new Set(blocked.map((t) => t.changeType))].join('、');
      throw new BadRequestException(`以下變更類型尚未開放，無法提交：${names}`);
    }

    const updated = await this.db.update(changeRequests)
      .set({ status: '待审批' })
      .where(and(
        inArray(changeRequests.id, ids),
        eq(changeRequests.createdBy, userId),
        eq(changeRequests.status, '草稿'),
      ))
      .returning({ id: changeRequests.id });

    return updated.length;
  }
}