import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.currentUser();

    if (user && allowedRoles.includes(user.rol)) {
      return true;
    }

    if (user) {
      if (user.rol === 'admin') {
        router.navigate(['/admin']);
      } else {
        router.navigate(['/citizen']);
      }
    } else {
      router.navigate(['/auth/login']);
    }
    
    return false;
  };
};
