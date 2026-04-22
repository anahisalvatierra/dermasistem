import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NuevaPasswordComponent } from './nueva-password';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { vi } from 'vitest';

describe('NuevaPasswordComponent', () => {

  const routerMock = {
    navigate: vi.fn()
  };

  const supabaseMock = {
    actualizarPassword: vi.fn().mockResolvedValue({ data: {}, error: null })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NuevaPasswordComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(NuevaPasswordComponent, {
      set: { template: '' } // 🔥 clave igual que registro
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(NuevaPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

});