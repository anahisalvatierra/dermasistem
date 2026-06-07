import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router   = inject(Router);

  const { session } = await supabase.getSession();

  if (session) {
    return true;
  }

  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};