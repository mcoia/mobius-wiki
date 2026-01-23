import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PublicSettingsController } from './public-settings.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PublicSettingsController],
})
export class PublicSettingsModule {}
