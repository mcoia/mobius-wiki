import { Controller, Post, Get, Patch, Put, Delete, Body, Req, Param, HttpCode, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Req() req: any) {
    const user = await this.authService.validateUser(body.email, body.password);

    // Extend session if "remember me" is checked
    if (body.rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    await this.authService.login(req, user);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        libraryId: user.library_id,
        avatarUrl: user.avatarUrl,
        avatarPreset: user.avatar_preset,
      },
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@Req() req: any) {
    await this.authService.logout(req);
    return { success: true };
  }

  @Get('me')
  @HttpCode(200)
  async me(@Req() req: any) {
    if (!req.session?.userId) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.email,
        name: req.session.name,
        role: req.session.role,
        libraryId: req.session.libraryId,
        avatarUrl: req.session.avatarUrl || null,
        avatarPreset: req.session.avatarPreset || null,
      },
    };
  }

  @Patch('profile')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.session.userId, dto, req);
  }

  @Post('profile/change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.session.userId, dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('invitation/:token')
  @HttpCode(200)
  async validateInvitation(@Param('token') token: string) {
    return this.authService.validateInvitationToken(token);
  }

  @Post('accept-invitation')
  @HttpCode(200)
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(dto.token, dto.password);
  }

  @Post('profile/avatar')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.authService.uploadAvatar(req.session.userId, file, req);
  }

  @Delete('profile/avatar')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async removeAvatar(@Req() req: any) {
    return this.authService.removeAvatar(req.session.userId, req);
  }

  @Put('profile/avatar-preset')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async setAvatarPreset(@Req() req: any, @Body() body: { preset: string | null }) {
    return this.authService.setAvatarPreset(req.session.userId, body.preset, req);
  }
}
