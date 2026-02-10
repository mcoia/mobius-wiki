import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { PagesModule } from '../pages/pages.module';
import { WikisModule } from '../wikis/wikis.module';
import { SectionsModule } from '../sections/sections.module';
import { FilesModule } from '../files/files.module';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    PagesModule,
    WikisModule,
    SectionsModule,
    FilesModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
