import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
