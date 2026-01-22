import { IsEmail, IsString, IsOptional, IsBoolean, MaxLength, MinLength, IsInt } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  libraryId?: number;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128, { message: 'Password must be less than 128 characters' })
  password: string;
}
