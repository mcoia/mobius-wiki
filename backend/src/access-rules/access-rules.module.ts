import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessRulesController } from './access-rules.controller';
import { AccessRulesService } from './access-rules.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AccessRulesController],
  providers: [AccessRulesService],
  exports: [AccessRulesService],
})
export class AccessRulesModule {}
