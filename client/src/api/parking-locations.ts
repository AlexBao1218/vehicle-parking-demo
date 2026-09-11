import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ApiResponse,
  ParkingLocationListResponse,
  ParkingLocationDetail,
  ParkedVehicleListResponse,
} from '@shared/api.interface';

export async function listParkingLocations(): Promise<ApiResponse<ParkingLocationListResponse>> {
  const res = await axiosForBackend.get<ApiResponse<ParkingLocationListResponse>>('/api/parking-locations');
  return res.data;
}

export async function getParkingLocationDetail(id: string): Promise<ApiResponse<ParkingLocationDetail>> {
  const res = await axiosForBackend.get<ApiResponse<ParkingLocationDetail>>(`/api/parking-locations/${id}`);
  return res.data;
}

export async function listParkedVehicles(id: string): Promise<ApiResponse<ParkedVehicleListResponse>> {
  const res = await axiosForBackend.get<ApiResponse<ParkedVehicleListResponse>>(`/api/parking-locations/${id}/vehicles`);
  return res.data;
}
