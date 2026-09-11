import { Controller, Get, Post, Patch, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ApprovalService } from './approval.service';
import { ApproveDto, RejectDto, BatchApproveDto } from './dto/approval.dto';
import type { ApiResponse, ApprovalRecord, BatchApproveResult, AdminCheckResponse, VehicleDetailResponse, ApprovalRequestListResponse, PendingLogbookRow, MarkSyncedRequest, MarkSyncedResult, PendingVehicleSyncRow, ExecuteVehicleSyncRequest, ExecuteVehicleSyncResult, EditRequest, ArchiveQuery, ArchiveListResponse, SyncStatusResponse, FollowUpItem } from '@shared/api.interface';

@Controller('api')
export class ApprovalController {
  constructor(private readonly service: ApprovalService) {}

  @Get('auth/admin-check')
  async adminCheck(@Req() req: Request): Promise<ApiResponse<AdminCheckResponse>> {
    const { userId } = req.userContext;
    const data = await this.service.checkAdmin(userId);
    return { success: true, data, message: 'ok' };
  }

  @Get('vehicles/:id')
  async getVehicleDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<ApiResponse<VehicleDetailResponse>> {
    const { userId } = req.userContext;
    const adminCheck = await this.service.checkAdmin(userId);
    const data = await this.service.getVehicleDetail(id, adminCheck.isAdmin);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Get('approval/sync-status')
  async getSyncStatus(@Req() req: Request): Promise<ApiResponse<SyncStatusResponse>> {
    const { userId } = req.userContext;
    const data = await this.service.getSyncStatus(userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Get('approval/requests')
  async listRequests(
    @Req() req: Request,
    @Query('status') status?: string,
  ): Promise<ApiResponse<ApprovalRequestListResponse>> {
    const { userId } = req.userContext;
    const data = await this.service.listRequests(status, userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Get('approval/archive')
  async listArchive(
    @Req() req: Request,
    @Query() query: ArchiveQuery,
  ): Promise<ApiResponse<ArchiveListResponse>> {
    const { userId } = req.userContext;
    const data = await this.service.listArchive(query, userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Get('approval/my-requests')
  async listMyRequests(@Req() req: Request): Promise<ApiResponse<ApprovalRecord[]>> {
    const { userId } = req.userContext;
    const data = await this.service.listMyRequests(userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Get('approval/follow-ups')
  async listFollowUps(@Req() req: Request): Promise<ApiResponse<FollowUpItem[]>> {
    const { userId } = req.userContext;
    const data = await this.service.listFollowUps(userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Post('approval/follow-ups/mark-complete')
  async markFollowUpsComplete(
    @Req() req: Request,
    @Body() dto: MarkSyncedRequest,
  ): Promise<ApiResponse<MarkSyncedResult>> {
    const { userId } = req.userContext;
    const data = await this.service.markFollowUpsComplete(userId, dto.ids);
    return { success: true, data, message: `已標記 ${data.updatedCount} 條為已完成` };
  }

  @NeedLogin()
  @Patch('approval/requests/:id')
  async editRequest(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: EditRequest,
  ): Promise<ApiResponse<ApprovalRecord>> {
    const { userId } = req.userContext;
    const data = await this.service.editRequest(id, dto, userId);
    return { success: true, data, message: '已儲存修改' };
  }

  @NeedLogin()
  @Post('approval/approve/:id')
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveDto,
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    const { userId } = req.userContext;
    const data = await this.service.approve(id, dto.approvalComment, userId);
    return { success: true, data, message: '已批准' };
  }

  @NeedLogin()
  @Post('approval/reject/:id')
  async reject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    const { userId } = req.userContext;
    const data = await this.service.reject(id, dto.approvalComment, userId);
    return { success: true, data, message: '已拒絕' };
  }

  @NeedLogin()
  @Get('approval/logbook/pending')
  async listPendingLogbook(@Req() req: Request): Promise<ApiResponse<PendingLogbookRow[]>> {
    const { userId } = req.userContext;
    const data = await this.service.listPendingLogbook(userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Post('approval/logbook/mark-synced')
  async markLogbookSynced(
    @Req() req: Request,
    @Body() dto: MarkSyncedRequest,
  ): Promise<ApiResponse<MarkSyncedResult>> {
    const { userId } = req.userContext;
    const data = await this.service.markLogbookSynced(userId, dto.ids);
    return { success: true, data, message: `已標記 ${data.updatedCount} 條為已同步` };
  }

  @NeedLogin()
  @Post('approval/batch-approve')
  async batchApprove(
    @Req() req: Request,
    @Body() dto: BatchApproveDto,
  ): Promise<ApiResponse<BatchApproveResult>> {
    const { userId } = req.userContext;
    const data = await this.service.batchApprove(dto.ids, dto.approvalComment, userId);
    return { success: true, data, message: `成功 ${data.successCount} 條，失敗 ${data.failCount} 條` };
  }

  @NeedLogin()
  @Get('approval/pending-vehicle-sync')
  async listPendingVehicleSync(@Req() req: Request): Promise<ApiResponse<PendingVehicleSyncRow[]>> {
    const { userId } = req.userContext;
    const data = await this.service.listPendingVehicleSync(userId);
    return { success: true, data, message: 'ok' };
  }

  @NeedLogin()
  @Post('approval/execute-vehicle-sync')
  async executeVehicleSync(
    @Req() req: Request,
    @Body() dto: ExecuteVehicleSyncRequest,
  ): Promise<ApiResponse<ExecuteVehicleSyncResult>> {
    const { userId } = req.userContext;
    const data = await this.service.executeVehicleSync(userId, dto.ids);
    return { success: true, data, message: `成功 ${data.successCount} 條，失敗 ${data.failCount} 條` };
  }
}