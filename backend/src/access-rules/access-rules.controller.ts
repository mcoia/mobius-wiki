import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { User } from '../common/decorators/user.decorator';
import { AccessRulesService } from './access-rules.service';
import { AccessControlService } from '../access-control/access-control.service';
import { CreateAccessRuleDto } from './dto/create-access-rule.dto';

@Controller()
@UseGuards(AuthGuard)
export class AccessRulesController {
  constructor(
    private readonly accessRulesService: AccessRulesService,
    private readonly accessControlService: AccessControlService,
  ) {}

  @Get(':type/:id/access-rules')
  async findAll(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'files'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Map plural to singular for ruleable_type
    const ruleableType = type.slice(0, -1); // wikis -> wiki, pages -> page

    // Must have edit permission to view access rules
    const canEdit = await this.accessControlService.canEdit(user, ruleableType, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to view access rules for this content');
    }

    const rules = await this.accessRulesService.findAll(ruleableType, id);

    return { data: rules };
  }

  @Post(':type/:id/access-rules')
  async create(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAccessRuleDto,
    @User() user: any,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'files'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const ruleableType = type.slice(0, -1);

    // Must have edit permission to manage access rules
    const canEdit = await this.accessControlService.canEdit(user, ruleableType, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to manage access rules for this content');
    }

    const rule = await this.accessRulesService.create(
      ruleableType,
      id,
      dto,
      user.id,
    );

    return { data: rule };
  }

  @Delete('access-rules/:ruleId')
  async remove(
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @User() user: any,
  ) {
    // Get rule to find which content it belongs to
    const ruleInfo = await this.accessRulesService.findById(ruleId);

    // Check edit permission on the content
    const canEdit = await this.accessControlService.canEdit(
      user,
      ruleInfo.ruleable_type,
      ruleInfo.ruleable_id,
    );
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to manage access rules for this content');
    }

    const rule = await this.accessRulesService.remove(ruleId);
    return { data: rule };
  }
}
