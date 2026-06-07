import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RecuperarComponent } from './recuperar';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { vi } from 'vitest';

describe('RecuperarComponent', () => {

  const routerMock = { navigate: vi.fn() };

  const supabaseMock = {
    recuperarPassword: vi.fn().mockResolvedValue({ data: {}, error: null })
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [RecuperarComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(RecuperarComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('correoEnviado debe ser false al iniciar', () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    expect(fixture.componentInstance.correoEnviado).toBe(false);
  });

  it('isLoading debe ser false al iniciar', () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('el formulario debe ser inválido cuando está vacío', () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    expect(fixture.componentInstance.recuperarForm.valid).toBe(false);
  });

  it('debe marcar email inválido con formato incorrecto', () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    fixture.componentInstance.recuperarForm.get('email')?.setValue('correo-invalido');
    expect(fixture.componentInstance.recuperarForm.get('email')?.hasError('email')).toBe(true);
  });

  it('debe enviar correo y cambiar correoEnviado a true cuando es exitoso', async () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    const component = fixture.componentInstance;
    component.recuperarForm.get('email')?.setValue('test@gmail.com');
    await component.onSubmit();
    expect(supabaseMock.recuperarPassword).toHaveBeenCalledWith('test@gmail.com');
    expect(component.correoEnviado).toBe(true);
  });

  it('debe mostrar error cuando el servicio falla', async () => {
    supabaseMock.recuperarPassword.mockResolvedValue({
      data: null,
      error: { message: 'Error al enviar correo' }
    });
    const fixture = TestBed.createComponent(RecuperarComponent);
    const component = fixture.componentInstance;
    component.recuperarForm.get('email')?.setValue('test@gmail.com');
    await component.onSubmit();
    expect(component.errorMessage).toBe('Error al enviar el correo. Verifica la dirección.');
  });
});