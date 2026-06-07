import { TestBed } from '@angular/core/testing';
import { LoginComponent } from './login';
import { SupabaseService } from '../supabase.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { vi } from 'vitest';

describe('LoginComponent', () => {

  const routerMock = {
    navigate: vi.fn()
  };

  const supabaseMock = {
    login: vi.fn().mockResolvedValue({ data: null, error: null })
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: Router, useValue: routerMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(LoginComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  // ── 1. Creación ──
  it('should create', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // ── 2. Estado inicial ──
  it('isLoading debe ser false al iniciar', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('errorMessage debe estar vacío al iniciar', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance.errorMessage).toBe('');
  });

  it('hidePassword debe ser true al iniciar', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance.hidePassword).toBe(true);
  });

  // ── 3. Validación formulario ──
  it('el formulario debe ser inválido cuando está vacío', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance.loginForm.valid).toBe(false);
  });

  it('debe marcar email inválido con formato incorrecto', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.loginForm.get('email')?.setValue('correo-invalido');
    expect(fixture.componentInstance.loginForm.get('email')?.hasError('email')).toBe(true);
  });

  it('debe marcar email válido con formato correcto', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.loginForm.get('email')?.setValue('test@gmail.com');
    expect(fixture.componentInstance.loginForm.get('email')?.valid).toBe(true);
  });

  it('debe marcar password inválido con menos de 6 caracteres', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.loginForm.get('password')?.setValue('123');
    expect(fixture.componentInstance.loginForm.get('password')?.hasError('minlength')).toBe(true);
  });

  it('el formulario debe ser válido con datos correctos', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.loginForm.setValue({
      email: 'test@gmail.com',
      password: '123456'
    });
    expect(fixture.componentInstance.loginForm.valid).toBe(true);
  });

  // ── 4. Login exitoso ──
  it('debe navegar a /productos cuando login es exitoso', async () => {
    supabaseMock.login.mockResolvedValue({ data: { user: {} }, error: null });
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.loginForm.setValue({
      email: 'test@gmail.com',
      password: '123456'
    });
    await component.onSubmit();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/productos']);
  });

  // ── 5. Login fallido ──
  it('debe mostrar error cuando las credenciales son incorrectas', async () => {
    supabaseMock.login.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' }
    });
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.loginForm.setValue({
      email: 'test@gmail.com',
      password: '123456'
    });
    await component.onSubmit();
    expect(component.errorMessage).toBe('Correo o contraseña incorrectos');
  });

  // ── 6. Formulario inválido ──
  it('no debe llamar al servicio si el formulario es inválido', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    component.loginForm.setValue({ email: '', password: '' });
    await component.onSubmit();
    expect(supabaseMock.login).not.toHaveBeenCalled();
  });
});