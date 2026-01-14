import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, ParseIntPipe, SetMetadata, ForbiddenException } from '@nestjs/common';
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

  private getRoleLevel(role: string): number {
    const levels = {
      guest: 0,
      library_staff: 1,
      mobius_staff: 2,
      site_admin: 3,
    };
    return levels[role] || 0;
  }

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
    @User() user: any,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('viewPublished') viewPublished?: string,
  ) {
    return this.pagesService.findOne(id, user, includeDeleted === 'true', viewPublished === 'true');
  }

  @Get('pages/:id/versions')
  async getVersions(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    // Verify page exists and user can view it (now includes status check)
    await this.pagesService.findOne(id, user);
    return this.pageVersionsService.findAllForPage(id);
  }

  @Get('pages/:id/versions/:versionNumber')
  async getVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @User() user: any,
  ) {
    // Verify page exists and user can view it (now includes status check)
    await this.pagesService.findOne(id, user);
    return this.pageVersionsService.findOne(id, versionNumber);
  }

  @Post('sections/:sectionId/pages')
  @UseGuards(AuthGuard)
  async create(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: CreatePageDto,
    @User() user: any,
  ) {
    // Check permission if allowScripts is true
    if (dto.allowScripts === true) {
      const roleLevel = this.getRoleLevel(user.role);

      if (roleLevel < 2) {
        // mobius_staff is level 2, site_admin is level 3
        throw new ForbiddenException(
          'Only MOBIUS staff and site admins can enable scripts on pages',
        );
      }
    }

    return this.pagesService.create(sectionId, dto, user.id);
  }

  @Patch('pages/:id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePageDto,
    @User() user: any,
  ) {
    // Check permission if allowScripts is being enabled
    if (dto.allowScripts === true) {
      const roleLevel = this.getRoleLevel(user.role);

      if (roleLevel < 2) {
        throw new ForbiddenException(
          'Only MOBIUS staff and site admins can enable scripts on pages',
        );
      }
    }

    return this.pagesService.update(id, dto, user.id, user);
  }

  @Post('pages/:id/publish')
  @UseGuards(AuthGuard)
  async publish(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.pagesService.publish(id, user.id);
  }

  @Post('pages/:id/discard-draft')
  @UseGuards(AuthGuard)
  async discardDraft(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.pagesService.discardDraft(id, user);
  }

  @Delete('pages/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.pagesService.remove(id, user.id);
  }
}
