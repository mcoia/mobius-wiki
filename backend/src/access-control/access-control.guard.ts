import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';

@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private aclService: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const aclCheck = this.reflector.get('aclCheck', context.getHandler());

    if (!aclCheck) {
      // No ACL check specified, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Get content type and ID from metadata
    const { type, idParam } = aclCheck;
    const contentId = parseInt(request.params[idParam], 10);

    if (isNaN(contentId)) {
      throw new ForbiddenException('Invalid content ID');
    }

    // Get user from session (or null for guests)
    const user = request.session?.userId
      ? {
          id: request.session.userId,
          role: request.session.role,
          libraryId: request.session.libraryId,
        }
      : null;

    // Check access
    const hasAccess = await this.aclService.canAccess(user, type, contentId);

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
