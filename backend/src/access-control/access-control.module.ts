import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlService } from './access-control.service';
import { AccessControlGuard } from './access-control.guard';

@Module({
  imports: [DatabaseModule],
  providers: [AccessControlService, AccessControlGuard],
  exports: [AccessControlService, AccessControlGuard],
})
export class AccessControlModule {}
