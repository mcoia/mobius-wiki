import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Session,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AccessRulesService } from './access-rules.service';
import { CreateAccessRuleDto } from './dto/create-access-rule.dto';

@Controller()
@UseGuards(AuthGuard)
export class AccessRulesController {
  constructor(private readonly accessRulesService: AccessRulesService) {}

  @Get(':type/:id/access-rules')
  async findAll(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'files'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Map plural to singular for ruleable_type
    const ruleableType = type.slice(0, -1); // wikis -> wiki, pages -> page
    const rules = await this.accessRulesService.findAll(ruleableType, id);

    return { data: rules };
  }

  @Post(':type/:id/access-rules')
  async create(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAccessRuleDto,
    @Session() session: Record<string, any>,
  ) {
    const validTypes = ['wikis', 'sections', 'pages', 'files'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const ruleableType = type.slice(0, -1);
    const rule = await this.accessRulesService.create(
      ruleableType,
      id,
      dto,
      session.userId,
    );

    return { data: rule };
  }

  @Delete('access-rules/:ruleId')
  async remove(
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Session() session: Record<string, any>,
  ) {
    const rule = await this.accessRulesService.remove(ruleId);
    return { data: rule };
  }
}
