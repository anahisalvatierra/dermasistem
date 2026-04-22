import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class RegistroComponent {

  registroForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  exitoMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private supabase: SupabaseService
  ) {
    this.registroForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar:['', [Validators.required]]
    });
  }

  get email()     { return this.registroForm.get('email'); }
  get password()  { return this.registroForm.get('password'); }
  get confirmar() { return this.registroForm.get('confirmar'); }

  async onSubmit(): Promise<void> {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }
    const { password, confirmar } = this.registroForm.value;
    if (password !== confirmar) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const { error } = await this.supabase.registrar(
      this.registroForm.value.email, password
    );
    this.isLoading = false;
    if (error) {
      this.errorMessage = error.message.includes('already registered')
        ? 'Este correo ya está registrado'
        : 'Error al crear la cuenta. Intenta de nuevo.';
    } else {
      this.exitoMessage = '✅ Cuenta creada. Redirigiendo...';
      setTimeout(() => this.router.navigate(['/productos']), 2000);
    }
  }
}