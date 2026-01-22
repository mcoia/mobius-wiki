import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

export const staffGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if user is already authenticated and is mobius_staff or site_admin
  const currentUser = authService.currentUserValue;
  if (currentUser) {
    if (currentUser.role === 'mobius_staff' || currentUser.role === 'site_admin') {
      return true;
    }
    // User is authenticated but not staff - redirect to 403
    router.navigate(['/403']);
    return false;
  }

  // If not authenticated, check with server
  return authService.getCurrentUser().pipe(
    map(response => {
      if (response.authenticated && response.user) {
        if (response.user.role === 'mobius_staff' || response.user.role === 'site_admin') {
          return true;
        }
        // User is authenticated but not staff - redirect to 403
        router.navigate(['/403']);
        return false;
      }
      // Not authenticated - redirect to login
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    })
  );
};
