import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,    // 👈 agregado
    private supabase: SupabaseService
  ) {
    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get email()    { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    const { data, error } = await this.supabase.login(email, password);

    if (error) {
      this.isLoading = false;
      if (error.message.includes('Invalid login credentials')) {
        this.errorMessage = 'Correo o contraseña incorrectos';
      } else if (error.message.includes('Email not confirmed')) {
        this.errorMessage = 'Confirma tu correo antes de iniciar sesión';
      } else {
        this.errorMessage = 'Error al iniciar sesión. Intenta de nuevo.';
      }
      return;
    }

    // ✅ Login exitoso — redirige al returnUrl o a /productos
    this.isLoading = false;
    await this.supabase.crearPerfilSiNoExiste();
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/productos';
    this.router.navigateByUrl(returnUrl);
  }
}