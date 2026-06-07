import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const admin  = sessionStorage.getItem('dermasistem_admin');

  if (admin) {
    return true;
  }

  router.navigate(['/admin']);
  return false;
};