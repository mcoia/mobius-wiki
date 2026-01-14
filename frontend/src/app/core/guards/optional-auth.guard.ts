import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Optional authentication guard - checks user session but allows guests.
 * Never blocks navigation.
 *
 * Use this guard when routes should be accessible to both authenticated users
 * and guests, but you still want to check if the user is logged in.
 */
export const optionalAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  // Try to load user if not already loaded
  if (!authService.isAuthenticated) {
    authService.checkCurrentUser();
  }

  // Always allow navigation (never blocks)
  return true;
};
