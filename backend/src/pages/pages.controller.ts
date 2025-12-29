import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, ParseIntPipe, SetMetadata } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PageVersionsService } from './page-versions.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AccessControlGuard } from '../access-control/access-control.guard';
import { User } from '../common/decorators/user.decorator';
import { PageViewInterceptor } from '../analytics/interceptors/page-view.interceptor';

@Controller()
export class PagesController {
  constructor(
    private pagesService: PagesService,
    private pageVersionsService: PageVersionsService,
  ) {}

  @Get('sections/:sectionId/pages')
  async findAllInSection(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @User() user: any,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.pagesService.findAllInSection(sectionId, user, includeDeleted === 'true');
  }

  @Get('pages/:id')
  @UseGuards(AccessControlGuard)
  @UseInterceptors(PageViewInterceptor)
  @SetMetadata('aclCheck', { type: 'page', idParam: 'id' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.pagesService.findOne(id, includeDeleted === 'true');
  }

  @Get('pages/:id/versions')
  async getVersions(@Param('id', ParseIntPipe) id: number) {
    // Verify page exists
    await this.pagesService.findOne(id);
    return this.pageVersionsService.findAllForPage(id);
  }

  @Get('pages/:id/versions/:versionNumber')
  async getVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    // Verify page exists
    await this.pagesService.findOne(id);
    return this.pageVersionsService.findOne(id, versionNumber);
  }

  @Post('sections/:sectionId/pages')
  @UseGuards(AuthGuard)
  async create(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: CreatePageDto,
    @User() user: any,
  ) {
    return this.pagesService.create(sectionId, dto, user.id);
  }

  @Patch('pages/:id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePageDto,
    @User() user: any,
  ) {
    return this.pagesService.update(id, dto, user.id);
  }

  @Post('pages/:id/publish')
  @UseGuards(AuthGuard)
  async publish(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.pagesService.publish(id, user.id);
  }

  @Delete('pages/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.pagesService.remove(id, user.id);
  }
}
