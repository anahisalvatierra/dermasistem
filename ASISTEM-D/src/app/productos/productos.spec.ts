import { TestBed } from '@angular/core/testing';
import { ProductosComponent, Producto } from './productos';
import { SupabaseService } from '../supabase.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { vi } from 'vitest';

const mockProductos: Producto[] = [
  {
    id: '1', nombre: 'Gel Limpiador', marca: 'CeraVe',
    descripcion: 'Limpiador suave', precio: 24.99,
    categoria_id: 'cat1', emoji: '🫧', color: '#D4EDE8',
    estrellas: 5, piel: ['Seca'],
    categorias: { id: 'cat1', nombre: 'Limpieza' }
  },
  {
    id: '2', nombre: 'Sérum Vitamina C', marca: 'The Ordinary',
    descripcion: 'Sérum iluminador', precio: 49.99,
    categoria_id: 'cat2', emoji: '🧪', color: '#FFF0C8',
    estrellas: 4, piel: ['Mixta'],
    categorias: { id: 'cat2', nombre: 'Tratamiento' }
  },
  {
    id: '3', nombre: 'Protector Solar', marca: 'La Roche-Posay',
    descripcion: 'SPF 50', precio: 29.99,
    categoria_id: 'cat3', emoji: '☀️', color: '#FFF3C8',
    estrellas: 5, piel: ['Todo tipo'],
    categorias: { id: 'cat3', nombre: 'Protección' }
  }
];

describe('ProductosComponent', () => {

  const supabaseMock = {
    getSession: vi.fn().mockResolvedValue({ session: {} }),
    getProductos: vi.fn().mockResolvedValue({ data: mockProductos, error: null }),
    getCategorias: vi.fn().mockResolvedValue({
      data: [
        { id: 'cat1', nombre: 'Limpieza' },
        { id: 'cat2', nombre: 'Tratamiento' },
        { id: 'cat3', nombre: 'Protección' }
      ], error: null
    }),
    getFavoritos: vi.fn().mockResolvedValue({ data: [], error: null }),
    toggleFavoritoDb: vi.fn().mockResolvedValue({ accion: 'agregado', error: null }),
    crearPedido: vi.fn().mockResolvedValue({ error: null })
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProductosComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(ProductosComponent, {
      set: { template: '' }
    })
    .compileComponents();
  });

  // ── 1. Creación ──
  it('should create', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // ── 2. Estado inicial ──
  it('carrito debe estar vacío al iniciar', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    expect(fixture.componentInstance.carrito.length).toBe(0);
  });

  it('cargando debe ser true al iniciar', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    expect(fixture.componentInstance.cargando).toBe(true);
  });

  it('mostrarCarrito debe ser false al iniciar', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    expect(fixture.componentInstance.mostrarCarrito).toBe(false);
  });

  it('mostrarEscaneo debe ser false al iniciar', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    expect(fixture.componentInstance.mostrarEscaneo).toBe(false);
  });

  // ── 3. Carrito ──
  it('debe agregar producto al carrito', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.agregarAlCarrito(mockProductos[0]);
    expect(component.carrito.length).toBe(1);
  });

  it('debe incrementar cantidad si producto ya está en carrito', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.agregarAlCarrito(mockProductos[0]);
    component.agregarAlCarrito(mockProductos[0]);
    expect(component.carrito[0].cantidad).toBe(2);
  });

  it('no debe duplicar productos en el carrito', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.agregarAlCarrito(mockProductos[0]);
    component.agregarAlCarrito(mockProductos[0]);
    expect(component.carrito.length).toBe(1);
  });

  it('total debe ser 0 con carrito vacío', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    expect(fixture.componentInstance.totalCarrito).toBe(0);
  });

  it('debe calcular total del carrito correctamente', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;

    //  Agregar dos veces para que cantidad sea 2 → 24.99 * 2 = 49.98
    component.agregarAlCarrito(mockProductos[0]);
    component.agregarAlCarrito(mockProductos[0]);

    expect(component.totalCarrito).toBeCloseTo(49.98, 2);
  });

  it('debe eliminar producto del carrito', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.agregarAlCarrito(mockProductos[0]);
    component.eliminarDelCarrito(0);
    expect(component.carrito.length).toBe(0);
  });

  it('disminuir cantidad a 0 debe eliminar el producto', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.agregarAlCarrito(mockProductos[0]);
    component.disminuirCantidad(0);
    expect(component.carrito.length).toBe(0);
  });

  it('debe limpiar carrito después de confirmar compra', async () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.agregarAlCarrito(mockProductos[0]);
    await component.confirmarCompra();
    expect(component.carrito.length).toBe(0);
  });

  // ── 4. Filtros ──
  it('debe filtrar productos por búsqueda', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.productos = [...mockProductos];
    component.busqueda = 'gel';
    expect(component.productosFiltrados.length).toBe(1);
    expect(component.productosFiltrados[0].nombre).toBe('Gel Limpiador');
  });

  it('debe mostrar todos los productos cuando búsqueda está vacía', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.productos = [...mockProductos];
    component.busqueda = '';
    expect(component.productosFiltrados.length).toBe(3);
  });

  it('debe ordenar por precio ascendente', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.productos = [...mockProductos];
    component.ordenamiento = 'price-asc';
    const ordenados = component.productosFiltrados;
    expect(ordenados[0].precio).toBeLessThanOrEqual(ordenados[1].precio);
  });

  it('debe ordenar por precio descendente', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.productos = [...mockProductos];
    component.ordenamiento = 'price-desc';
    const ordenados = component.productosFiltrados;
    expect(ordenados[0].precio).toBeGreaterThanOrEqual(ordenados[1].precio);
  });

  // ── 5. Escaneo ──
  it('escanearPiel debe cambiar mostrarEscaneo a true', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.escanearPiel();
    expect(component.mostrarEscaneo).toBe(true);
  });

  it('escanearPiel debe resetear pasoEscaneo a 0', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    component.pasoEscaneo = 3;
    component.escanearPiel();
    expect(component.pasoEscaneo).toBe(0);
  });

  // ── 6. Utilidades ──
  it('getEstrellas debe retornar siempre 5 elementos', () => {
    const fixture = TestBed.createComponent(ProductosComponent);
    const component = fixture.componentInstance;
    expect(component.getEstrellas(5).length).toBe(5);
    expect(component.getEstrellas(3).length).toBe(5);
  });

});