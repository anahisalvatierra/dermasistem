import { Component, OnInit } from '@angular/core';
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
  selector: 'app-nueva-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './nueva-password.html',
  styleUrls: ['./nueva-password.css']
})
export class NuevaPasswordComponent implements OnInit {

  passwordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  exitoMessage = '';
  hidePassword = true;
  hideConfirmar = true;
  sesionValida = false;
  verificando = true;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private supabase: SupabaseService
  ) {
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar: ['', [Validators.required]]
    }, { validators: this.passwordsIguales });
  }

  async ngOnInit(): Promise<void> {
    // Verificar que hay una sesión activa desde el enlace de recuperación
    const { session } = await this.supabase.getSession();
    if (session) {
      this.sesionValida = true;
    } else {
      this.errorMessage = 'El enlace ha expirado o no es válido.';
    }
    this.verificando = false;
  }

  passwordsIguales(group: FormGroup) {
    const pass = group.get('password')?.value;
    const confirmar = group.get('confirmar')?.value;
    return pass === confirmar ? null : { noCoinciden: true };
  }

  get password()  { return this.passwordForm.get('password'); }
  get confirmar() { return this.passwordForm.get('confirmar'); }

  async onSubmit(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { error } = await this.supabase.actualizarPassword(
      this.passwordForm.value.password
    );

    this.isLoading = false;

    if (error) {
      this.errorMessage = 'Error al actualizar la contraseña. Intenta de nuevo.';
    } else {
      this.exitoMessage = '✅ Contraseña actualizada correctamente. Redirigiendo...';
      setTimeout(() => this.router.navigate(['/login']), 3000);
    }
  }

  getSeguridadPorcentaje(): number {
  const pass = this.password?.value || '';
  let puntos = 0;
  if (pass.length >= 6)  puntos += 25;
  if (pass.length >= 10) puntos += 25;
  if (/[A-Z]/.test(pass)) puntos += 25;
  if (/[0-9!@#$%^&*]/.test(pass)) puntos += 25;
  return puntos;
}

getSeguridadColor(): string {
  const p = this.getSeguridadPorcentaje();
  if (p <= 25) return '#E74C3C';
  if (p <= 50) return '#E67E22';
  if (p <= 75) return '#F1C40F';
  return '#27AE60';
}

getSeguridadTexto(): string {
  const p = this.getSeguridadPorcentaje();
  if (p <= 25) return 'Muy débil';
  if (p <= 50) return 'Débil';
  if (p <= 75) return 'Moderada';
  return 'Fuerte ✓';
}
}