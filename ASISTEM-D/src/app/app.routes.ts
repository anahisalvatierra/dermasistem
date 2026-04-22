import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { ProductosComponent } from './productos/productos';
import { RegistroComponent } from './registro/registro';
import { RecuperarComponent } from './recuperar/recuperar';
import { NuevaPasswordComponent } from './nueva-password/nueva-password';

export const routes: Routes = [
  { path: '',          redirectTo: 'login', pathMatch: 'full' },
  { path: 'login',     component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'recuperar',      component: RecuperarComponent },
  { path: 'nueva-password',  component: NuevaPasswordComponent },
  { path: 'productos', component: ProductosComponent }
];