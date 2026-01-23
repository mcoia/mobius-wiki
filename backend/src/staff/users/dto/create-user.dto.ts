import { IsEmail, IsString, IsNotEmpty, MaxLength, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsInt()
  @IsNotEmpty({ message: 'Library is required for library staff' })
  libraryId: number;
}
