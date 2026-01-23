import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { StaffUsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('staff/users')
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', ['mobius_staff'])
export class StaffUsersController {
  constructor(private usersService: StaffUsersService) {}

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

  @Post(':id/send-password-reset')
  async sendPasswordResetEmail(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.sendPasswordResetEmail(id);
  }
}
