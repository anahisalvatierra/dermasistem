import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RecuperarComponent } from './recuperar';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { vi } from 'vitest';

describe('RecuperarComponent', () => {

  const routerMock = {
    navigate: vi.fn()
  };

  const supabaseMock = {
    recuperarPassword: vi.fn().mockResolvedValue({ data: {}, error: null })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecuperarComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(RecuperarComponent, {
      set: { template: '' } // 🔥 clave para evitar ViewContainerRef
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RecuperarComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

});