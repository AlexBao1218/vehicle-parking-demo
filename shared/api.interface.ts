// ===== 变更申请草稿 =====

export interface AttachmentInfo {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface DraftRecord {
  id: string;
  changeType: string;
  vehicleId: string;
  vehicleLicense: string;
  logFrom: string;
  logTo: string;
  effectiveDate: string | null;
  effectiveDateTs: number | null;
  remark: string;
  attachments: AttachmentInfo[];
  status: string;
  applyTime: string;
  isLegacy?: boolean;
}

export interface CreateDraftRequest {
  changeType: string;
  vehicleId: string;
  vehicleLicense: string;
  logFrom: string;
  logTo: string;
  effectiveDate?: string | null;
  remark: string;
  attachments: AttachmentInfo[];
}

export interface UpdateDraftRequest {
  changeType?: string;
  vehicleId?: string;
  vehicleLicense?: string;
  logFrom?: string;
  logTo?: string;
  effectiveDate?: string | null;
  remark?: string;
  attachments?: AttachmentInfo[];
}

export interface SubmitDraftsRequest {
  ids: string[];
}

// ===== 審批 =====

export interface EditHistoryChange {
  field: 'changeType' | 'logFrom' | 'logTo' | 'effectiveDate' | 'remark';
  from: string;
  to: string;
}

export interface EditHistoryEntry {
  editedAt: string;
  editedBy: string;
  changes: EditHistoryChange[];
}

export interface EditRequest {
  changeType?: string;
  logFrom?: string;
  logTo?: string;
  effectiveDate?: string | null;
  remark?: string;
}

export interface ApprovalRecord {
  id: string;
  changeType: string;
  vehicleId: string;
  vehicleLicense: string;
  logFrom: string;
  logTo: string;
  effectiveDate: string | null;
  effectiveDateTs: number | null;
  remark: string;
  status: string;
  applyTime: string;
  attachments: AttachmentInfo[];
  applicantName?: string;
  approverName?: string;
  approvalTime?: string;
  approvalComment?: string;
  editHistory: EditHistoryEntry[];
}

export interface ApproveRequest {
  approvalComment?: string;
}

export interface RejectRequest {
  approvalComment: string;
}

export interface BatchApproveRequest {
  ids: string[];
  approvalComment?: string;
}

export interface BatchApproveResult {
  results: Array<{ id: string; success: boolean; error?: string }>;
  successCount: number;
  failCount: number;
}

export interface AdminCheckResponse {
  isAdmin: boolean;
  syncMode: 'test' | 'production';
  testVehicleLicenses: string[];
}

export interface VehicleDetailResponse {
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
  parkingLocationName: string;
  extraFields?: Record<string, unknown>;
}

export interface ApprovalRequestListResponse {
  items: ApprovalRecord[];
  total: number;
}

// ===== 申請檔案檢索（管理員） =====

/** GET /api/approval/archive 查詢參數，全部可選、均為 string */
export interface ArchiveQuery {
  /** 車牌，模糊匹配 */
  vehicleLicense?: string;
  /** 申請人 userId */
  applicant?: string;
  /** 變更類型 id（與 category 同傳時以此為準） */
  changeType?: string;
  /** 類別：vehicleChange / supplyRequest / personnelChange / parkingSpace */
  category?: string;
  status?: string;
  /** 申請時間範圍（含當日） */
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  /** 默認 20，上限 100 */
  pageSize?: string;
}

export interface ArchiveListResponse {
  items: ApprovalRecord[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== 同步状态条（管理员） =====

/** GET /api/approval/sync-status 响应 */
export interface SyncStatusResponse {
  /** 已到生效日、尚未写回 Base 车辆表的条数 */
  pendingCount: number;
  /** 最后一次成功写回 Base 的时间（ISO string）；从未成功写回过为 null */
  lastSyncedAt: string | null;
}

// ===== Logbook 导出 =====

export interface PendingLogbookRow {
  id: string;
  logDate: string;
  vicLicense: string;
  changeType: string;
  logFrom: string;
  logTo: string;
  remark: string;
  isTestVehicle: boolean;
}

// ===== Follow-up（批准後需線下處理的申請） =====

export interface FollowUpItem {
  id: string;
  changeType: string;
  vehicleLicense: string;
  remark: string;
  effectiveDate: string | null;
  approvalTime: string | null;
  applicantName?: string;
}

export interface MarkSyncedRequest {
  ids: string[];
}

export interface MarkSyncedResult {
  updatedCount: number;
}

// ===== 補同步至 Base 車輛表 =====

export interface PendingVehicleSyncRow {
  id: string;
  vehicleLicense: string;
  changeType: string;
  logTo: string;
  effectiveDate: string;
  currentBaseValue: string;
}

export interface ExecuteVehicleSyncRequest {
  ids: string[];
}

export interface ExecuteVehicleSyncResult {
  results: Array<{ id: string; success: boolean; error?: string }>;
  successCount: number;
  failCount: number;
}

// ===== 停車場反向檢索 =====

export interface ParkingLocationSummary {
  id: string;
  name: string;
}

export interface ParkingLocationDetail {
  id: string;
  name: string;
  /** 地址（空为 null，前端显示「尚未確認」） */
  address: string | null;
  /** 限高情況：'有限高' | '無限高' | '未確認' | null */
  heightLimitStatus: string | null;
  /** 限高（米），仅有限高时有值 */
  heightLimitMeters: number | null;
  /** 街景示意圖附件 URL */
  streetViewUrls: string[];
  /** 使用汽車升降機：'是' | '否' | '未確認' | null */
  carLift: string | null;
  /** 使用泊車架：'是' | '否' | '未確認' | null */
  parkingRack: string | null;
  /** 可停車種（多选），空数组表示尚未确认 */
  allowedVehicleTypes: string[];
  /** 充電設備：'有' | '部分有' | '無' | '未確認' | null */
  chargingEquipment: string | null;
  /** 充電設備類型 */
  chargingEquipmentType: string | null;
  /** 平面图附件 URL（0-2+ 张） */
  diagramUrls: string[];
}

export interface ParkedVehicleSummary {
  /** 车辆记录 ID（供跳转） */
  id: string;
  vicLicense: string;
  make: string;
  model: string;
  department: string;
  section: string;
}

export interface ParkingLocationListResponse {
  items: ParkingLocationSummary[];
}

export interface ParkedVehicleListResponse {
  items: ParkedVehicleSummary[];
  total: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}