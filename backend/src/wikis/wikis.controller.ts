import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, SetMetadata } from '@nestjs/common';
import { WikisService } from './wikis.service';
import { PagesService } from '../pages/pages.service';
import { CreateWikiDto } from './dto/create-wiki.dto';
import { UpdateWikiDto } from './dto/update-wiki.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AccessControlGuard } from '../access-control/access-control.guard';
import { User } from '../common/decorators/user.decorator';

@Controller('wikis')
export class WikisController {
  constructor(
    private wikisService: WikisService,
    private pagesService: PagesService,
  ) {}

  @Get()
  async findAll(
    @User() user: any,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.wikisService.findAll(user, includeDeleted === 'true');
  }

  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.wikisService.findBySlug(slug, includeDeleted === 'true');
  }

  @Get('slug/:wikiSlug/sections/slug/:sectionSlug/pages/slug/:pageSlug')
  async findPageBySlug(
    @Param('wikiSlug') wikiSlug: string,
    @Param('sectionSlug') sectionSlug: string,
    @Param('pageSlug') pageSlug: string,
    @User() user: any = null,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('viewPublished') viewPublished?: string,
  ) {
    return this.pagesService.findBySlug(
      wikiSlug,
      sectionSlug,
      pageSlug,
      user,
      includeDeleted === 'true',
      viewPublished === 'true'
    );
  }

  @Get(':id')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'wiki', idParam: 'id' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.wikisService.findOne(id, includeDeleted === 'true');
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() dto: CreateWikiDto, @User() user: any) {
    return this.wikisService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWikiDto,
    @User() user: any,
  ) {
    return this.wikisService.update(id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.wikisService.remove(id, user.id);
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard)
  async archive(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.wikisService.archive(id, user.id);
  }

  @Post(':id/unarchive')
  @UseGuards(AuthGuard)
  async unarchive(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.wikisService.unarchive(id, user.id);
  }
}
