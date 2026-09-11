import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import type {
  ParkingLocationSummary,
  ParkingLocationDetail,
  ParkedVehicleSummary,
} from '@shared/api.interface';

const PARKING_PLUGIN_ID = 'parking_location_map_readonly_query_3';
const VEHICLE_PLUGIN_ID = 'vehicle_list_draft_readonly_query_3';

/** 分页循环上限，防止插件异常返回导致死循环 */
const PARKED_VEHICLE_FIELD_NAMES = [
  'VicLicense', 'Make', 'Model', 'Department', 'Section', 'Parking Location',
];

/** 分页循环上限，防止插件异常返回导致死循环 */
const MAX_PAGES = 50;

interface PluginRecord {
  id: string;
  record: Record<string, unknown>;
}

interface SearchRecordsResult {
  records?: PluginRecord[];
  hasMore?: boolean;
  pageToken?: string;
  total?: number;
}

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

function getTextValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'text' in val) {
    return (val as { text: string }).text ?? '';
  }
  return String(val);
}

/** SingleSelect 读取为 string；空值返回 null */
function getSelectValue(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val.length > 0 ? val : null;
  if (typeof val === 'object' && 'text' in val) {
    const text = (val as { text?: string }).text;
    return typeof text === 'string' && text.length > 0 ? text : null;
  }
  return null;
}

/** MultiSelect 读取为 string[]；空值返回空数组 */
function getMultiSelectValue(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
  return [];
}

function getNumberValue(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'string' && val.trim().length > 0) {
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/** Attachment 读取为附件对象数组，提取 tmpUrl */
function getAttachmentUrls(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => {
      if (item && typeof item === 'object' && 'tmpUrl' in item) {
        const url = (item as { tmpUrl?: unknown }).tmpUrl;
        return typeof url === 'string' ? url : '';
      }
      return '';
    })
    .filter((url) => url.length > 0);
}

/** 精确比对：trim + 折叠空白 + 忽略大小写 */
function isSameLocationName(a: string, b: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  return na.length > 0 && na === nb;
}

@Injectable()
export class ParkingLocationsService {
  private readonly logger = new Logger(ParkingLocationsService.name);

  constructor(private readonly capabilityService: CapabilityService) {}

  /** 全部停车场摘要列表（供前端下拉选择） */
  async listParkingLocations(): Promise<ParkingLocationSummary[]> {
    const records = await this.searchAllParkingRecords(['Location']);
    const items = records
      .map((r) => ({ id: r.id, name: getTextValue(getFieldValueRobust(r.record, 'Location')).trim() }))
      .filter((item) => item.name.length > 0);
    items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    return items;
  }

  /** 单个停车场详情：9 个属性 + 平面图 + 街景图 */
  async getParkingLocationDetail(id: string): Promise<ParkingLocationDetail> {
    const record = await this.getParkingRecord(id);
    return this.mapParkingDetail(id, record);
  }

  /** 停放在该停车场的车辆列表（严格字段白名单） */
  async getParkedVehicles(id: string): Promise<{ items: ParkedVehicleSummary[]; total: number }> {
    const parkingRecord = await this.getParkingRecord(id);
    const locationName = getTextValue(getFieldValueRobust(parkingRecord, 'Location')).trim();
    if (!locationName) {
      return { items: [], total: 0 };
    }

    const records = await this.searchAllVehicleRecords(locationName);
    const items: ParkedVehicleSummary[] = records
      .filter((r) => {
        const vehicleLocation = getTextValue(getFieldValueRobust(r.record, 'Parking Location'));
        return isSameLocationName(vehicleLocation, locationName);
      })
      .map((r) => ({
        id: r.id,
        vicLicense: getTextValue(getFieldValueRobust(r.record, 'VicLicense')).trim(),
        make: getTextValue(getFieldValueRobust(r.record, 'Make')).trim(),
        model: getTextValue(getFieldValueRobust(r.record, 'Model')).trim(),
        department: getTextValue(getFieldValueRobust(r.record, 'Department')).trim(),
        section: getTextValue(getFieldValueRobust(r.record, 'Section')).trim(),
      }));

    return { items, total: items.length };
  }

  /** 按 ID 读取停车场记录，不存在时抛 404 */
  private async getParkingRecord(id: string): Promise<Record<string, unknown>> {
    const result = await this.capabilityService.load(PARKING_PLUGIN_ID)
      .call('getRecord', { recordID: id }) as { record?: Record<string, unknown> };
    if (!result.record || Object.keys(result.record).length === 0) {
      throw new NotFoundException('找不到該停車場地點');
    }
    return result.record;
  }

  /** 分页取完停车场表全部记录 */
  private async searchAllParkingRecords(fieldNames: string[]): Promise<PluginRecord[]> {
    const all: PluginRecord[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const input: Record<string, unknown> = { fieldNames, pageSize: 200 };
      if (pageToken) input.pageToken = pageToken;
      const result = await this.capabilityService.load(PARKING_PLUGIN_ID)
        .call('searchRecords', input) as SearchRecordsResult;
      all.push(...(result.records ?? []));
      if (!result.hasMore || !result.pageToken) break;
      pageToken = result.pageToken;
    }
    this.logger.log(`[PARKING] 讀取停車場表共 ${all.length} 條記錄`);
    return all;
  }

  /** 按地点名 contains 检索车辆并分页取完，供服务端再做精确比对 */
  private async searchAllVehicleRecords(locationName: string): Promise<PluginRecord[]> {
    const all: PluginRecord[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const input: Record<string, unknown> = {
        filter: {
          conjunction: 'and',
          conditions: [{ fieldName: 'Parking Location', operator: 'contains', value: [locationName] }],
        },
        fieldNames: PARKED_VEHICLE_FIELD_NAMES,
        pageSize: 200,
      };
      if (pageToken) input.pageToken = pageToken;
      const result = await this.capabilityService.load(VEHICLE_PLUGIN_ID)
        .call('searchRecords', input) as SearchRecordsResult;
      all.push(...(result.records ?? []));
      if (!result.hasMore || !result.pageToken) break;
      pageToken = result.pageToken;
    }
    this.logger.log(`[PARKING] 地點 ${locationName} contains 檢索到 ${all.length} 條車輛記錄`);
    return all;
  }

  /** 解析停车场记录为详情结构（仅消费契约字段，实现字段白名单） */
  private mapParkingDetail(id: string, record: Record<string, unknown>): ParkingLocationDetail {
    return {
      id,
      name: getTextValue(getFieldValueRobust(record, 'Location')).trim(),
      address: getTextValue(getFieldValueRobust(record, '地址')).trim() || null,
      heightLimitStatus: getSelectValue(getFieldValueRobust(record, '限高情況')),
      heightLimitMeters: getNumberValue(getFieldValueRobust(record, '限高（米）')),
      streetViewUrls: getAttachmentUrls(getFieldValueRobust(record, '街景示意圖')),
      carLift: getSelectValue(getFieldValueRobust(record, '使用汽車升降機')),
      parkingRack: getSelectValue(getFieldValueRobust(record, '使用泊車架')),
      allowedVehicleTypes: getMultiSelectValue(getFieldValueRobust(record, '可停車種')),
      chargingEquipment: getSelectValue(getFieldValueRobust(record, '充電設備')),
      chargingEquipmentType: getTextValue(getFieldValueRobust(record, '充電設備類型')).trim() || null,
      diagramUrls: getAttachmentUrls(getFieldValueRobust(record, 'Diagram')),
    };
  }
}
