import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const ROLE_LEVELS = {
  library_staff: 1,
  mobius_staff: 2,
  site_admin: 3,
};

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check both method and class level metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.session?.role;

    if (!userRole) {
      throw new ForbiddenException('Access denied');
    }

    const userLevel = ROLE_LEVELS[userRole] || 0;
    const hasAccess = requiredRoles.some(
      (role) => userLevel >= ROLE_LEVELS[role],
    );

    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
