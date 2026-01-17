import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [NavigationController],
  providers: [NavigationService],
  exports: [NavigationService],
})
export class NavigationModule {}
