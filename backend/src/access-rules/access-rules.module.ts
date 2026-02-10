import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AccessRulesController } from './access-rules.controller';
import { AccessRulesService } from './access-rules.service';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [AccessRulesController],
  providers: [AccessRulesService],
  exports: [AccessRulesService],
})
export class AccessRulesModule {}
