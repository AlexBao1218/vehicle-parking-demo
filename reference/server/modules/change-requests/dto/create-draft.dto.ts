import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class AttachmentDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;

  @IsString()
  type!: string;

  @IsNumber()
  size!: number;
}

export class CreateDraftDto {
  @IsString()
  changeType!: string;

  @IsString()
  vehicleId!: string;

  @IsString()
  vehicleLicense!: string;

  @IsString()
  logFrom!: string;

  @IsString()
  logTo!: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string | null;

  @IsString()
  remark!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments!: AttachmentDto[];
}

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  changeType?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  vehicleLicense?: string;

  @IsOptional()
  @IsString()
  logFrom?: string;

  @IsOptional()
  @IsString()
  logTo?: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string | null;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class SubmitDraftsDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}