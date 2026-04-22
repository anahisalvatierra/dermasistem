import { TestBed } from '@angular/core/testing';
import { LoginComponent } from './login';
import { SupabaseService } from '../supabase.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';

describe('LoginComponent', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: SupabaseService,
          useValue: {
            login: async () => ({ data: null, error: null })
          }
        },
        {
          provide: Router, // 🔥 FALTABA ESTO
          useValue: {
            navigate: () => Promise.resolve(true)
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(LoginComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

});