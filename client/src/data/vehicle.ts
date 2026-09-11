// EXPORTS: IVehicleRecord, IParkingLocation, mapVehicleRecord, mapParkingLocation, getTextValue, getLinkValue

/** 车辆记录（前端白名单字段） */
export interface IVehicleRecord {
  id: string;
  vicLicense: string;
  status: string;
  make: string;
  model: string;
  colour: string;
  vehClass: string;
  fuelType: string;
  company: string;
  department: string;
  section: string;
  transportCoordinator: string;
  /** 车辆表中 Parking Location 字段的文本值，用于搜索停车场表 */
  parkingLocationName: string;
}

/** 停车位置信息 */
export interface IParkingLocation {
  name: string;
  diagramUrls: string[];
}

/** 安全提取 Text 字段的 text 值 */
export function getTextValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'text' in val) {
    return (val as { text: string }).text ?? '';
  }
  return String(val);
}

/** 安全提取 Link 字段的关联记录 ID（取第一个） */
export function getLinkValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'id' in first) {
      return (first as { id: string }).id ?? '';
    }
  }
  if (typeof val === 'object') {
    if ('link_record_ids' in val && Array.isArray((val as Record<string, unknown>).link_record_ids)) {
      const ids = (val as { link_record_ids: string[] }).link_record_ids;
      if (ids.length > 0 && typeof ids[0] === 'string') return ids[0];
    }
    if ('id' in val) {
      return (val as { id: string }).id ?? '';
    }
  }
  return '';
}

/** 将插件返回的车辆记录映射为前端白名单结构 */
export function mapVehicleRecord(record: { id: string; record: Record<string, unknown> }): IVehicleRecord {
  const r = record.record;
  return {
    id: record.id,
    vicLicense: getTextValue(r['VicLicense']),
    status: getTextValue(r['Status']),
    make: getTextValue(r['Make']),
    model: getTextValue(r['Model']),
    colour: getTextValue(r['Colour']),
    vehClass: getTextValue(r['Veh. Class']),
    fuelType: getTextValue(r['Fuel type']),
    company: getTextValue(r['Company']),
    department: getTextValue(r['Department']),
    section: getTextValue(r['Section']),
    transportCoordinator: getTextValue(r['Transport Coordinator']),
    parkingLocationName: getTextValue(r['Parking Location']),
  };
}

/** 将插件返回的停车场记录映射为前端结构 */
export function mapParkingLocation(record: { record?: Record<string, unknown> }): IParkingLocation {
  const r = record.record;
  if (!r) return { name: '', diagramUrls: [] };

  const name = getTextValue(r['Location']);
  const diagrams = r['Diagram'];
  let diagramUrls: string[] = [];
  if (Array.isArray(diagrams)) {
    diagramUrls = diagrams
      .map((d: unknown) => {
        if (d && typeof d === 'object' && 'tmpUrl' in d) {
          return (d as { tmpUrl: string }).tmpUrl ?? '';
        }
        return '';
      })
      .filter((url: string) => url.length > 0);
  }

  return { name, diagramUrls };
}