import { IsString, IsOptional, MinLength, MaxLength, IsInt, IsBoolean } from 'class-validator';

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  scripts?: string;

  @IsOptional()
  @IsBoolean()
  allowScripts?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
