import { IsString, IsOptional, MinLength, MaxLength, IsInt, IsEnum, IsBoolean } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  scripts?: string;

  @IsOptional()
  @IsBoolean()
  allowScripts?: boolean;

  @IsOptional()
  @IsEnum(['draft', 'published'])
  status?: 'draft' | 'published';

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
