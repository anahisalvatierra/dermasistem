// src/app/features/main/main.routes.ts
import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';

export const MAIN_ROUTES: Routes = [
  {
    path: '',
    component: Dashboard,
    // O si prefieres redirect:
    // redirectTo: 'dashboard',
    // pathMatch: 'full'
  },

  // Más adelante puedes agregar aquí otras páginas internas
  // {
  //   path: 'perfil',
  //   loadComponent: () => import('./perfil/perfil.component')
  //     .then(m => m.PerfilComponent)
  // },
];