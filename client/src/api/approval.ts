import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ApiResponse, ApprovalRecord, ApproveRequest, RejectRequest,
  BatchApproveRequest, BatchApproveResult, AdminCheckResponse,
  VehicleDetailResponse, ApprovalRequestListResponse,
  PendingLogbookRow, MarkSyncedRequest, MarkSyncedResult,
  PendingVehicleSyncRow, ExecuteVehicleSyncRequest, ExecuteVehicleSyncResult,
  EditRequest, ArchiveQuery, ArchiveListResponse,
  SyncStatusResponse, FollowUpItem,
} from '@shared/api.interface';

export async function checkAdmin(): Promise<ApiResponse<AdminCheckResponse>> {
  const res = await axiosForBackend.get<ApiResponse<AdminCheckResponse>>('/api/auth/admin-check');
  return res.data;
}

export async function getVehicleDetail(id: string): Promise<ApiResponse<VehicleDetailResponse>> {
  const res = await axiosForBackend.get<ApiResponse<VehicleDetailResponse>>(`/api/vehicles/${id}`);
  return res.data;
}

export async function getSyncStatus(): Promise<ApiResponse<SyncStatusResponse>> {
  const res = await axiosForBackend.get<ApiResponse<SyncStatusResponse>>('/api/approval/sync-status');
  return res.data;
}

export async function listRequests(status?: string): Promise<ApiResponse<ApprovalRequestListResponse>> {
  const params = status ? { status } : {};
  const res = await axiosForBackend.get<ApiResponse<ApprovalRequestListResponse>>('/api/approval/requests', { params });
  return res.data;
}

export async function listMyRequests(): Promise<ApiResponse<ApprovalRecord[]>> {
  const res = await axiosForBackend.get<ApiResponse<ApprovalRecord[]>>('/api/approval/my-requests');
  return res.data;
}

export async function editRequest(id: string, data: EditRequest): Promise<ApiResponse<ApprovalRecord>> {
  const res = await axiosForBackend.patch<ApiResponse<ApprovalRecord>>(`/api/approval/requests/${id}`, data);
  return res.data;
}

export async function approveRequest(id: string, data: ApproveRequest): Promise<ApiResponse<{ id: string; status: string }>> {
  const res = await axiosForBackend.post<ApiResponse<{ id: string; status: string }>>(`/api/approval/approve/${id}`, data);
  return res.data;
}

export async function rejectRequest(id: string, data: RejectRequest): Promise<ApiResponse<{ id: string; status: string }>> {
  const res = await axiosForBackend.post<ApiResponse<{ id: string; status: string }>>(`/api/approval/reject/${id}`, data);
  return res.data;
}

export async function batchApprove(data: BatchApproveRequest): Promise<ApiResponse<BatchApproveResult>> {
  const res = await axiosForBackend.post<ApiResponse<BatchApproveResult>>('/api/approval/batch-approve', data);
  return res.data;
}

export async function listPendingLogbook(): Promise<ApiResponse<PendingLogbookRow[]>> {
  const res = await axiosForBackend.get<ApiResponse<PendingLogbookRow[]>>('/api/approval/logbook/pending');
  return res.data;
}

export async function listFollowUps(): Promise<ApiResponse<FollowUpItem[]>> {
  const res = await axiosForBackend.get<ApiResponse<FollowUpItem[]>>('/api/approval/follow-ups');
  return res.data;
}

export async function markFollowUpsComplete(data: MarkSyncedRequest): Promise<ApiResponse<MarkSyncedResult>> {
  const res = await axiosForBackend.post<ApiResponse<MarkSyncedResult>>('/api/approval/follow-ups/mark-complete', data);
  return res.data;
}

export async function markLogbookSynced(data: MarkSyncedRequest): Promise<ApiResponse<MarkSyncedResult>> {
  const res = await axiosForBackend.post<ApiResponse<MarkSyncedResult>>('/api/approval/logbook/mark-synced', data);
  return res.data;
}

export async function listPendingVehicleSync(): Promise<ApiResponse<PendingVehicleSyncRow[]>> {
  const res = await axiosForBackend.get<ApiResponse<PendingVehicleSyncRow[]>>('/api/approval/pending-vehicle-sync');
  return res.data;
}

export async function executeVehicleSync(data: ExecuteVehicleSyncRequest): Promise<ApiResponse<ExecuteVehicleSyncResult>> {
  const res = await axiosForBackend.post<ApiResponse<ExecuteVehicleSyncResult>>('/api/approval/execute-vehicle-sync', data);
  return res.data;
}

export async function fetchArchive(params: ArchiveQuery): Promise<ArchiveListResponse> {
  const query: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]: [string, string | undefined]) => {
    if (value !== undefined && value !== '') {
      query[key] = value;
    }
  });
  const res = await axiosForBackend.get<ApiResponse<ArchiveListResponse>>('/api/approval/archive', { params: query });
  return res.data.data;
}