import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const toastService = inject(ToastService);
    const user = authService.currentUser();

    if (user && allowedRoles.includes(user.rol)) {
      return true;
    }

    if (user) {
      const attemptedUrl = state?.url || 'esta sección';
      toastService.show(
        `Acceso denegado: no tienes permisos para acceder a "${attemptedUrl}".`,
        'error',
        5000
      );

      if (user.rol === 'admin' || user.rol === 'colaborador') {
        router.navigate(['/admin/monitor']);
      } else {
        router.navigate(['/citizen']);
      }
    } else {
      router.navigate(['/auth/login']);
    }
    
    return false;
  };
};
