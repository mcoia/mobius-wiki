import { IsEnum, IsOptional, IsString, IsISO8601 } from 'class-validator';

export class CreateAccessRuleDto {
  @IsEnum(['public', 'link', 'role', 'library', 'user'])
  ruleType: string;

  @IsOptional()
  @IsString()
  ruleValue?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
