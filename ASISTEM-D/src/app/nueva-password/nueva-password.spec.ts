import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NuevaPasswordComponent } from './nueva-password';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { vi } from 'vitest';

describe('NuevaPasswordComponent', () => {

  // ── MOCK ROUTER ──
  const routerMock = {
    navigate: vi.fn()
  };

  // ── MOCK SUPABASE ──
  const supabaseMock = {
    actualizarPassword: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ session: { user: 'test' } }) // ← FALTABA
  };

  beforeEach(async () => {
    vi.clearAllMocks(); // ← Limpia mocks entre tests

    // Restaurar getSession válido por defecto
    supabaseMock.getSession.mockResolvedValue({ session: { user: 'test' } });

    await TestBed.configureTestingModule({
      imports: [NuevaPasswordComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(NuevaPasswordComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  // ── 1. TEST BÁSICO ──
  it('should create', () => {
    const fixture = TestBed.createComponent(NuevaPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

// ── 2. CASO: éxito al actualizar contraseña ──
it('should update password successfully and navigate to login', async () => {

  supabaseMock.actualizarPassword.mockResolvedValue({
    data: {},
    error: null
  });

  const fixture = TestBed.createComponent(NuevaPasswordComponent);
  const component = fixture.componentInstance;

  await fixture.whenStable();

  vi.useFakeTimers();

  component.passwordForm.setValue({
    password: 'Abc123456',
    confirmar: 'Abc123456'
  });

  await component.onSubmit();

  expect(supabaseMock.actualizarPassword).toHaveBeenCalledWith('Abc123456');
  expect(component.exitoMessage).toBeDefined();

  vi.advanceTimersByTime(3000);
  expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);

  vi.useRealTimers();
});

  // ── 3. CASO: error al actualizar contraseña ──
  it('should show error when password update fails', async () => {

    supabaseMock.actualizarPassword.mockResolvedValue({
      data: null,
      error: { message: 'Error al actualizar contraseña' }
    });

    const fixture = TestBed.createComponent(NuevaPasswordComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable(); // ← Espera ngOnInit

    component.passwordForm.setValue({
      password: 'Abc123456',
      confirmar: 'Abc123456'
    });

    await component.onSubmit();

    expect(component.errorMessage).toBe('Error al actualizar la contraseña. Intenta de nuevo.');
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  // ── 4. CASO: formulario inválido ──
  it('should not call service if form is invalid', async () => {

    const fixture = TestBed.createComponent(NuevaPasswordComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable(); // ← Espera ngOnInit

    component.passwordForm.setValue({
      password: '',    // inválido: required + minLength(6)
      confirmar: ''
    });

    await component.onSubmit();

    expect(supabaseMock.actualizarPassword).not.toHaveBeenCalled();
  });

  // ── 5. CASO: sesión inválida ──
  it('should show error when session is invalid', async () => {

    supabaseMock.getSession.mockResolvedValue({ session: null }); // ← Sin sesión

    const fixture = TestBed.createComponent(NuevaPasswordComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    expect(component.errorMessage).toBe('El enlace ha expirado o no es válido.');
    expect(component.sesionValida).toBe(false);
  });

});