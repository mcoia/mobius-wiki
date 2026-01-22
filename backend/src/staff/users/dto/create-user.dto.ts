import { IsEmail, IsString, IsNotEmpty, MinLength, MaxLength, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128, { message: 'Password must be less than 128 characters' })
  password: string;

  @IsInt()
  @IsNotEmpty({ message: 'Library is required for library staff' })
  libraryId: number;
}
