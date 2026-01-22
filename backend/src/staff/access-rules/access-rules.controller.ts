import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { StaffAccessRulesService, AccessRuleFilter } from './access-rules.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';

@Controller('staff/access-rules')
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', ['mobius_staff'])
export class StaffAccessRulesController {
  constructor(private accessRulesService: StaffAccessRulesService) {}

  @Get()
  async findAll(
    @Query('ruleableType') ruleableType?: string,
    @Query('ruleType') ruleType?: string,
  ) {
    const filters: AccessRuleFilter = {};
    if (ruleableType) filters.ruleableType = ruleableType;
    if (ruleType) filters.ruleType = ruleType;
    return this.accessRulesService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accessRulesService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.accessRulesService.remove(id);
  }
}
