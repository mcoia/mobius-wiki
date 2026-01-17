import { Controller, Get, Req } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { Request } from 'express';

@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('tree')
  async getNavigationTree(@Req() req: Request) {
    const user = (req as any).user || null;
    return this.navigationService.getNavigationTree(user);
  }
}
