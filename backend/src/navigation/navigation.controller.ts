import { Controller, Get, Req } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { Request } from 'express';

@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('tree')
  async getNavigationTree(@Req() req: Request) {
    const session = (req as any).session;
    const user = session?.userId
      ? {
          id: session.userId,
          role: session.role,
          libraryId: session.libraryId,
        }
      : null;
    return this.navigationService.getNavigationTree(user);
  }
}
