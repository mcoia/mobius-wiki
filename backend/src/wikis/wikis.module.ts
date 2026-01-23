import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { PagesModule } from '../pages/pages.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WikisController } from './wikis.controller';
import { WikisService } from './wikis.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, PagesModule, AnalyticsModule],
  controllers: [WikisController],
  providers: [WikisService],
  exports: [WikisService],
})
export class WikisModule {}
