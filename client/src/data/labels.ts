import {
  STATUS_DRAFT,
  STATUS_PENDING,
  STATUS_APPROVED,
  STATUS_REJECTED,
} from './status';

/**
 * 显示层英文化映射。
 * 存储值 / 接口传参保持中文原值，仅在最终渲染时走本映射。
 * 未知值原样兜底，避免静默丢失信息。
 */

export const STATUS_LABEL: Record<string, string> = {
  [STATUS_DRAFT]: 'Draft',
  [STATUS_PENDING]: 'Pending',
  [STATUS_APPROVED]: 'Approved',
  [STATUS_REJECTED]: 'Rejected',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/**
 * 停车场 Base 选项值 → 英文显示值。
 * 注意：仅用于显示，读取 / 写入 Base 时仍使用中文原选项值。
 */
export const PARKING_VALUE_LABEL: Record<string, string> = {
  // 限高情況
  有限高: 'Height limit',
  無限高: 'No limit',
  未確認: 'Not confirmed',
  // 是 / 否（使用汽車升降機、使用泊車架）
  是: 'Yes',
  否: 'No',
  // 可停車種
  私家車: 'Private car',
  客貨車: 'Van',
  電單車: 'Motorcycle',
  貨車: 'Truck',
  // 充電設備
  有: 'Available',
  部分有: 'Partial',
  無: 'None',
};

export function getParkingValueLabel(value: string | undefined | null): string {
  if (value == null || value === '') return 'Not confirmed';
  if (value === '尚未確認') return 'Not confirmed';
  return PARKING_VALUE_LABEL[value] ?? value;
}
