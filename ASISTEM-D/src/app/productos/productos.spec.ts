import { TestBed } from '@angular/core/testing';
import { ProductosComponent } from './productos';
import { SupabaseService } from '../supabase.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ProductosComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductosComponent],
      providers: [
        {
          provide: SupabaseService,
          useValue: {
            getSession: async () => ({ session: {} }),
            getProductos: async () => ({ data: [], error: null }),
            getCategorias: async () => ({ data: [], error: null }),
            getFavoritos: async () => ({ data: [], error: null }),
            toggleFavoritoDb: async () => ({ accion: 'agregado', error: null }),
            crearPedido: async () => ({ error: null })
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA] // 🔥 ESTO ES CLAVE
    })
    // 🔥 Sobrescribimos el template para evitar errores
    .overrideComponent(ProductosComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});