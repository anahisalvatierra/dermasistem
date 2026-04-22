import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RegistroComponent } from './registro';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { vi } from 'vitest';

describe('RegistroComponent', () => {

  const routerMock = {
    navigate: vi.fn()
  };

  const supabaseMock = {
    registrar: vi.fn().mockResolvedValue({ data: {}, error: null })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(RegistroComponent, {
      set: { template: '' } // 🔥 CLAVE: elimina HTML completamente
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RegistroComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

});