import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StaffLibrariesController } from './libraries/libraries.controller';
import { StaffLibrariesService } from './libraries/libraries.service';
import { StaffUsersController } from './users/users.controller';
import { StaffUsersService } from './users/users.service';
import { StaffAccessRulesController } from './access-rules/access-rules.controller';
import { StaffAccessRulesService } from './access-rules/access-rules.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    StaffLibrariesController,
    StaffUsersController,
    StaffAccessRulesController,
  ],
  providers: [
    StaffLibrariesService,
    StaffUsersService,
    StaffAccessRulesService,
  ],
  exports: [
    StaffLibrariesService,
    StaffUsersService,
    StaffAccessRulesService,
  ],
})
export class StaffModule {}
