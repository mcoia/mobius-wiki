import { IsNotEmpty, IsString } from 'class-validator';

export class UploadAvatarDto {
  @IsNotEmpty()
  @IsString()
  filename: string;
}
