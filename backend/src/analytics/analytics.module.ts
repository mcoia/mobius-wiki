import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PageViewInterceptor } from './interceptors/page-view.interceptor';

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PageViewInterceptor],
  exports: [AnalyticsService, PageViewInterceptor],
})
export class AnalyticsModule {}
