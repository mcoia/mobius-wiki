import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  parentSectionId?: number;
}
