import { IsString, IsOptional, IsArray } from 'class-validator';

export class ApproveDto {
  @IsOptional()
  @IsString()
  approvalComment?: string;
}

export class RejectDto {
  @IsString()
  approvalComment!: string;
}

export class BatchApproveDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  approvalComment?: string;
}