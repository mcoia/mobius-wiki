import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileAuditService } from './file-audit.service';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [FilesController],
  providers: [FilesService, FileAuditService],
  exports: [FilesService, FileAuditService],
})
export class FilesModule {}
