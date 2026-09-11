import { Controller, Get, Post, Patch, Delete, Body, Param, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ChangeRequestsService } from './change-requests.service';
import { CreateDraftDto, UpdateDraftDto, SubmitDraftsDto } from './dto/create-draft.dto';
import type { ApiResponse, DraftRecord } from '@shared/api.interface';

@Controller('api/change-requests')
export class ChangeRequestsController {
  constructor(private readonly service: ChangeRequestsService) {}

  @Get('drafts')
  async listDrafts(@Req() req: Request): Promise<ApiResponse<DraftRecord[]>> {
    const { userId } = req.userContext;
    const [drafts, legacy] = await Promise.all([
      this.service.listDrafts(userId),
      this.service.listLegacyDrafts(userId),
    ]);
    const all = [...drafts, ...legacy];
    return { success: true, data: all, message: 'ok' };
  }

  @NeedLogin()
  @Post('drafts')
  async createDraft(@Req() req: Request, @Body() dto: CreateDraftDto): Promise<ApiResponse<DraftRecord>> {
    const { userId } = req.userContext;
    const draft = await this.service.createDraft(dto, userId);
    return { success: true, data: draft, message: 'ok' };
  }

  @NeedLogin()
  @Patch('drafts/:id')
  async updateDraft(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
  ): Promise<ApiResponse<DraftRecord>> {
    const { userId } = req.userContext;
    const draft = await this.service.updateDraft(id, dto, userId);
    return { success: true, data: draft, message: 'ok' };
  }

  @NeedLogin()
  @Delete('drafts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDraft(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const { userId } = req.userContext;
    await this.service.deleteDraft(id, userId);
  }

  @NeedLogin()
  @Post('drafts/submit')
  async submitDrafts(@Req() req: Request, @Body() dto: SubmitDraftsDto): Promise<ApiResponse<{ count: number }>> {
    const { userId } = req.userContext;
    const count = await this.service.submitDrafts(dto.ids, userId);
    return { success: true, data: { count }, message: `已提交 ${count} 条申请` };
  }
}