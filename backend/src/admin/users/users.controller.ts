import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseIntPipe, SetMetadata } from '@nestjs/common';
import { AdminUsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('admin/users')
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', ['site_admin'])
export class AdminUsersController {
  constructor(private usersService: AdminUsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @User() user: any) {
    return this.usersService.create(dto, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @User() user: any,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.usersService.remove(id, user.id);
  }

  @Post(':id/activate')
  async activate(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.usersService.activate(id, user.id);
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.usersService.deactivate(id, user.id);
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @User() user: any,
  ) {
    return this.usersService.resetPassword(id, dto, user.id);
  }

  @Post(':id/resend-invitation')
  async resendInvitation(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.resendInvitation(id);
  }
}
