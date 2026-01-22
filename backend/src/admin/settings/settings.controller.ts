import { Controller, Get, Patch, Body, Param, UseGuards, SetMetadata } from '@nestjs/common';
import { AdminSettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';

@Controller('admin/settings')
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', ['site_admin'])
export class AdminSettingsController {
  constructor(private settingsService: AdminSettingsService) {}

  @Get()
  async findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Patch(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.update(key, dto);
  }
}
