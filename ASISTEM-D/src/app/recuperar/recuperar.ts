import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './recuperar.html',
  styleUrls: ['./recuperar.css']
})
export class RecuperarComponent {

  recuperarForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  exitoMessage = '';
  correoEnviado = false;

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService
  ) {
    this.recuperarForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() { return this.recuperarForm.get('email'); }

  async onSubmit(): Promise<void> {
    if (this.recuperarForm.invalid) {
      this.recuperarForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { error } = await this.supabase.recuperarPassword(
      this.recuperarForm.value.email
    );

    this.isLoading = false;

    if (error) {
      this.errorMessage = 'Error al enviar el correo. Verifica la dirección.';
    } else {
      this.correoEnviado = true;
    }
  }
}