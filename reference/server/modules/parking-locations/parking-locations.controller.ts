import { Controller, Get, Param } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ParkingLocationsService } from './parking-locations.service';
import type {
  ApiResponse,
  ParkingLocationListResponse,
  ParkingLocationDetail,
  ParkedVehicleListResponse,
} from '@shared/api.interface';

@Controller('api/parking-locations')
export class ParkingLocationsController {
  constructor(private readonly service: ParkingLocationsService) {}

  @NeedLogin()
  @Get()
  async list(): Promise<ApiResponse<ParkingLocationListResponse>> {
    const items = await this.service.listParkingLocations();
    return { success: true, data: { items }, message: 'ok' };
  }

  @NeedLogin()
  @Get(':id')
  async getDetail(@Param('id') id: string): Promise<ApiResponse<ParkingLocationDetail>> {
    const data = await this.service.getParkingLocationDetail(id);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Get(':id/vehicles')
  async getVehicles(@Param('id') id: string): Promise<ApiResponse<ParkedVehicleListResponse>> {
    const data = await this.service.getParkedVehicles(id);
    return { success: true, data, message: 'ok' };
  }
}
