import { IsOptional, IsString, IsNumber, IsBoolean, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class FileAdminQueryDto {
  @IsOptional()
  @IsIn(['image', 'document', 'archive', 'other'])
  type?: 'image' | 'document' | 'archive' | 'other';

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsNumber()
  uploadedBy?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  orphaned?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : 1)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : 25)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsIn(['filename', 'size_bytes', 'uploaded_at', 'mime_type'])
  sortBy?: 'filename' | 'size_bytes' | 'uploaded_at' | 'mime_type';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class UpdateFileMetadataDto {
  @IsOptional()
  @IsString()
  description?: string;
}
