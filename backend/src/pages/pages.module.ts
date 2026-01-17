import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PageVersionsService } from './page-versions.service';
import { EditSessionsController } from './edit-sessions.controller';
import { EditSessionsService } from './edit-sessions.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, AnalyticsModule],
  controllers: [PagesController, EditSessionsController],
  providers: [PagesService, PageVersionsService, EditSessionsService],
  exports: [PagesService, PageVersionsService, EditSessionsService],
})
export class PagesModule {}
