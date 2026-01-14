import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAccessRuleDto {
  @IsEnum(['public', 'role', 'user'])
  ruleType: string;

  @IsOptional()
  @IsString()
  ruleValue?: string;
}
