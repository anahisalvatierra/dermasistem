import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { LoginComponent } from './login/login';
import { RegistroComponent } from './registro/registro';
import { RecuperarComponent } from './recuperar/recuperar';
import { NuevaPasswordComponent } from './nueva-password/nueva-password';
import { ProductosComponent } from './productos/productos';
import { PerfilComponent } from './perfil/perfil';
import { AdminComponent } from './admin/admin';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '',              component: Landing },
  { path: 'landing',       component: Landing },
  { path: 'login',         component: LoginComponent },
  { path: 'registro',      component: RegistroComponent },
  { path: 'recuperar',     component: RecuperarComponent },
  { path: 'nueva-password',component: NuevaPasswordComponent },
  { path: 'admin',         component: AdminComponent },

  // 👇 Rutas protegidas con AuthGuard
  { path: 'productos', component: ProductosComponent, canActivate: [authGuard] },
  { path: 'perfil',    component: PerfilComponent,    canActivate: [authGuard] },
];