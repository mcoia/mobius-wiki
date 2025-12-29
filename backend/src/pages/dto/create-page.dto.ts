import { IsString, IsOptional, MinLength, MaxLength, IsInt, IsEnum } from 'class-validator';

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
  @IsEnum(['draft', 'published'])
  status?: 'draft' | 'published';

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
