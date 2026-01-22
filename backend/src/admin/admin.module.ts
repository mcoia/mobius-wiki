import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminUsersController } from './users/users.controller';
import { AdminUsersService } from './users/users.service';
import { AdminSettingsController } from './settings/settings.controller';
import { AdminSettingsService } from './settings/settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminUsersController, AdminSettingsController],
  providers: [AdminUsersService, AdminSettingsService],
  exports: [AdminUsersService, AdminSettingsService],
})
export class AdminModule {}
