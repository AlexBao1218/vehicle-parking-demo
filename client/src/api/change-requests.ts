import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { ApiResponse, DraftRecord, CreateDraftRequest, UpdateDraftRequest, SubmitDraftsRequest } from '@shared/api.interface';

export async function fetchDrafts(): Promise<ApiResponse<DraftRecord[]>> {
  const res = await axiosForBackend.get<ApiResponse<DraftRecord[]>>('/api/change-requests/drafts');
  return res.data;
}

export async function createDraft(data: CreateDraftRequest): Promise<ApiResponse<DraftRecord>> {
  const res = await axiosForBackend.post<ApiResponse<DraftRecord>>('/api/change-requests/drafts', data);
  return res.data;
}

export async function updateDraft(id: string, data: UpdateDraftRequest): Promise<ApiResponse<DraftRecord>> {
  const res = await axiosForBackend.patch<ApiResponse<DraftRecord>>(`/api/change-requests/drafts/${id}`, data);
  return res.data;
}

export async function deleteDraft(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/change-requests/drafts/${id}`);
}

export async function submitDrafts(ids: string[]): Promise<ApiResponse<{ count: number }>> {
  const res = await axiosForBackend.post<ApiResponse<{ count: number }>>('/api/change-requests/drafts/submit', { ids } as SubmitDraftsRequest);
  return res.data;
}