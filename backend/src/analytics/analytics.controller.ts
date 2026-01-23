import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
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
}
