import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RegistroComponent } from './registro';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { vi } from 'vitest';

describe('RegistroComponent', () => {

  const routerMock = { navigate: vi.fn() };

  const supabaseMock = {
    registrar: vi.fn().mockResolvedValue({ data: {}, error: null })
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(RegistroComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('el formulario debe ser inválido cuando está vacío', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    expect(fixture.componentInstance.registroForm.valid).toBe(false);
  });

  it('debe tener los campos email password y confirmar', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    const form = fixture.componentInstance.registroForm;
    expect(form.contains('email')).toBe(true);
    expect(form.contains('password')).toBe(true);
    expect(form.contains('confirmar')).toBe(true);
  });

  it('isLoading debe ser false al iniciar', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('errorMessage debe estar vacío al iniciar', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    expect(fixture.componentInstance.errorMessage).toBe('');
  });

  it('debe registrar usuario exitosamente y navegar a productos', async () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    const component = fixture.componentInstance;
    component.registroForm.setValue({
      email: 'nuevo@gmail.com',
      password: '123456',
      confirmar: '123456'
    });
    await component.onSubmit();
    expect(supabaseMock.registrar).toHaveBeenCalledWith('nuevo@gmail.com', '123456');
  });

  it('no debe llamar al servicio si las contraseñas no coinciden', async () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    const component = fixture.componentInstance;
    component.registroForm.setValue({
      email: 'nuevo@gmail.com',
      password: '123456',
      confirmar: '654321'
    });
    await component.onSubmit();
    expect(supabaseMock.registrar).not.toHaveBeenCalled();
  });

  it('debe mostrar error cuando el correo ya está registrado', async () => {
    supabaseMock.registrar.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' }
    });
    const fixture = TestBed.createComponent(RegistroComponent);
    const component = fixture.componentInstance;
    component.registroForm.setValue({
      email: 'existente@gmail.com',
      password: '123456',
      confirmar: '123456'
    });
    await component.onSubmit();
    expect(component.errorMessage).toBe('Este correo ya está registrado');
  });
});