import { Controller, Post, Get, Body, Req, HttpCode, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
      },
    };
  }
}
