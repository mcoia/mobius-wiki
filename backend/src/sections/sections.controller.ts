import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, SetMetadata } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AccessControlGuard } from '../access-control/access-control.guard';
import { User } from '../common/decorators/user.decorator';

@Controller()
export class SectionsController {
  constructor(private sectionsService: SectionsService) {}

  @Get('wikis/:wikiId/sections')
  async findAllInWiki(
    @Param('wikiId', ParseIntPipe) wikiId: number,
    @User() user: any,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.sectionsService.findAllInWiki(wikiId, user, includeDeleted === 'true');
  }

  @Get('wikis/:wikiId/sections/tree')
  async getSectionTree(
    @Param('wikiId', ParseIntPipe) wikiId: number,
    @User() user: any,
  ) {
    return this.sectionsService.getSectionTree(wikiId, user);
  }

  @Get('sections/:id')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'section', idParam: 'id' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.sectionsService.findOne(id, includeDeleted === 'true');
  }

  @Post('wikis/:wikiId/sections')
  @UseGuards(AuthGuard)
  async create(
    @Param('wikiId', ParseIntPipe) wikiId: number,
    @Body() dto: CreateSectionDto,
    @User() user: any,
  ) {
    return this.sectionsService.create(wikiId, dto, user.id);
  }

  @Patch('sections/:id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSectionDto,
    @User() user: any,
  ) {
    return this.sectionsService.update(id, dto, user.id);
  }

  @Delete('sections/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.sectionsService.remove(id, user.id);
  }
}
