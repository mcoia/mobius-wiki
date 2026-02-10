import { Controller, Get, Param, Query, ParseIntPipe, UseGuards, SetMetadata } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';

@Controller('analytics')
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', ['library_staff'])
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('pages/:id')
  async getPageStats(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getPageStats(id, dto.days);
  }

  @Get('pages/:id/views')
  async getPageViewLog(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getPageViewLog(id, dto.limit, dto.offset);
  }

  @Get('popular')
  async getPopularPages(@Query() dto: AnalyticsQueryDto) {
    return {
      data: await this.analyticsService.getPopularPages(dto.limit, dto.days),
      meta: {
        limit: dto.limit,
        period: dto.days ? `last_${dto.days}_days` : 'all_time',
      },
    };
  }

  @Get('stats')
  async getOverallStats(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getOverallStats(dto.days);
  }

  @Get('daily-views')
  async getDailyViews(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getDailyViews(dto.days || 30);
  }

  @Get('wikis')
  async getWikiStats(@Query() dto: AnalyticsQueryDto) {
    return {
      data: await this.analyticsService.getWikiStats(dto.days),
      meta: {
        period: dto.days ? `last_${dto.days}_days` : 'all_time',
      },
    };
  }

  @Get('sections')
  async getSectionStats(@Query() dto: AnalyticsQueryDto) {
    return {
      data: await this.analyticsService.getSectionStats(dto.days, dto.limit || 10),
      meta: {
        limit: dto.limit || 10,
        period: dto.days ? `last_${dto.days}_days` : 'all_time',
      },
    };
  }

  @Get('contributors')
  async getUserContributions(@Query() dto: AnalyticsQueryDto) {
    return {
      data: await this.analyticsService.getUserContributions(dto.days, dto.limit || 10),
      meta: {
        limit: dto.limit || 10,
        period: dto.days ? `last_${dto.days}_days` : 'all_time',
      },
    };
  }

  @Get('content-trends')
  async getContentCreationTrends(@Query() dto: AnalyticsQueryDto) {
    return {
      data: await this.analyticsService.getContentCreationTrends(dto.days || 30),
      meta: {
        period: `last_${dto.days || 30}_days`,
      },
    };
  }

  @Get('content-health')
  async getContentHealth() {
    return this.analyticsService.getContentHealth();
  }

  @Get('referrers')
  async getReferrerStats(@Query() dto: AnalyticsQueryDto) {
    return {
      data: await this.analyticsService.getReferrerStats(dto.days, dto.limit || 10),
      meta: {
        limit: dto.limit || 10,
        period: dto.days ? `last_${dto.days}_days` : 'all_time',
      },
    };
  }
}
