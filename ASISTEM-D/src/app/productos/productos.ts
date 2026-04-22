import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../supabase.service';

export interface Categoria {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  nombre: string;
  marca: string;
  descripcion: string;
  precio: number;
  categoria_id: string;
  categorias?: Categoria;
  emoji: string;
  color: string;
  badge?: string;
  estrellas: number;
  piel: string[];
  cantidad?: number;
  favorito?: boolean;
}

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.html',
  styleUrls: ['./productos.css']
})
export class ProductosComponent implements OnInit {

  categoriaActiva = 'Todos';
  busqueda = '';
  ordenamiento = 'default';
  mostrarCarrito = false;
  mostrarConfirmacion = false;
  mostrarEscaneo = false;
  pasoEscaneo = 0;
  mensajeToast = '';
  cargando = true;
  carrito: Producto[] = [];

  categorias: string[] = ['Todos'];
  productos: Producto[] = [];
  favoritosIds: Set<string> = new Set();

  pasos = [
    { titulo: 'Frente',           subtitulo: 'Mira directamente a la cámara',    por_que: 'Analizamos textura general, poros y manchas en toda la zona T.' },
    { titulo: 'Perfil derecho',   subtitulo: 'Gira tu rostro hacia la derecha',  por_que: 'Detectamos líneas de expresión y flacidez en el contorno facial.' },
    { titulo: 'Perfil izquierdo', subtitulo: 'Gira tu rostro hacia la izquierda',por_que: 'Comparamos simetría y estado de la piel en ambos lados.' },
    { titulo: 'Listo',            subtitulo: 'Análisis completado',               por_que: 'Te recomendaremos productos ideales para tu tipo de piel.' },
  ];

  // ✅ Inyectar ChangeDetectorRef y NgZone
  constructor(
    private supabase: SupabaseService,
    private cd: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('ngOnInit iniciado');

    const session = await this.supabase.getSession();
    console.log('Sesión activa:', session.session?.user?.email);

    try {
      // ✅ Cargar en orden: primero favoritos, luego productos
      await this.cargarCategorias();
      await this.cargarFavoritos();
      await this.cargarProductos();
      console.log('Todo cargado - productos:', this.productos.length);
    } catch(e) {
      console.error('Error en ngOnInit:', e);
    }

    // ✅ Forzar detección de cambios dentro de la zona de Angular
    this.zone.run(() => {
      this.cargando = false;
      this.cd.detectChanges();
    });
  }

  async cargarProductos(): Promise<void> {
    console.log('Cargando productos...');
    const { data, error } = await this.supabase.getProductos();
    console.log('Productos recibidos:', data?.length, 'Error:', error);

    if (!error && data && data.length > 0) {
      // ✅ Asignar dentro de zone.run para que Angular detecte el cambio
      this.zone.run(() => {
        this.productos = data.map((p: any) => ({
          ...p,
          emoji:    p.emoji    || '✨',
          color:    p.color    || '#F9E4D4',
          piel:     Array.isArray(p.piel) ? p.piel : ['Normal'],
          estrellas: p.estrellas || 4,
          favorito: this.favoritosIds.has(p.id)
        }));
        this.cd.detectChanges();
      });
    } else if (error) {
      console.error('Error cargando productos:', error);
      this.showToast('⚠️ Error al cargar los productos');
    }
  }

  async cargarCategorias(): Promise<void> {
    const { data, error } = await this.supabase.getCategorias();
    console.log('Categorías recibidas:', data?.length, 'Error:', error);
    if (!error && data) {
      this.zone.run(() => {
        this.categorias = ['Todos', ...data.map((c: Categoria) => c.nombre)];
      });
    }
  }

  async cargarFavoritos(): Promise<void> {
    const { data, error } = await this.supabase.getFavoritos();
    console.log('Favoritos recibidos:', data?.length, 'Error:', error);
    if (!error && data) {
      this.favoritosIds = new Set(data.map((f: any) => f.producto_id));
    }
  }

  get productosFiltrados(): Producto[] {
    let lista = [...this.productos];

    if (this.categoriaActiva !== 'Todos')
      lista = lista.filter(p => p.categorias?.nombre === this.categoriaActiva);

    if (this.busqueda) {
      const q = this.busqueda.toLowerCase();
      lista = lista.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q)
      );
    }

    if (this.ordenamiento === 'price-asc')  lista.sort((a, b) => a.precio - b.precio);
    if (this.ordenamiento === 'price-desc') lista.sort((a, b) => b.precio - a.precio);
    if (this.ordenamiento === 'rating')     lista.sort((a, b) => b.estrellas - a.estrellas);

    return lista;
  }

  get cantidadTotal(): number  { return this.carrito.reduce((a, p) => a + (p.cantidad || 1), 0); }
  get totalCarrito():  number  { return this.carrito.reduce((a, p) => a + p.precio * (p.cantidad || 1), 0); }
  get favoritosTotal(): number { return this.productos.filter(p => p.favorito).length; }

  seleccionarCategoria(cat: string): void { this.categoriaActiva = cat; }

  agregarAlCarrito(producto: Producto): void {
    const ex = this.carrito.find(p => p.id === producto.id);
    ex ? ex.cantidad = (ex.cantidad || 1) + 1 : this.carrito.push({ ...producto, cantidad: 1 });
    this.showToast(`✓ ${producto.nombre} agregado`);
  }

  async toggleFavorito(producto: Producto, event: Event): Promise<void> {
    event.stopPropagation();
    const { accion, error } = await this.supabase.toggleFavoritoDb(producto.id);
    if (!error) {
      this.zone.run(() => {
        producto.favorito = accion === 'agregado';
        if (accion === 'agregado') this.favoritosIds.add(producto.id);
        else this.favoritosIds.delete(producto.id);
        this.cd.detectChanges();
      });
      this.showToast(accion === 'agregado' ? `❤️ Añadido a favoritos` : `Eliminado de favoritos`);
    }
  }

  eliminarDelCarrito(i: number): void { this.carrito.splice(i, 1); }
  aumentarCantidad(i: number):   void { this.carrito[i].cantidad = (this.carrito[i].cantidad || 1) + 1; }
  disminuirCantidad(i: number):  void {
    if ((this.carrito[i].cantidad || 1) > 1) this.carrito[i].cantidad = (this.carrito[i].cantidad || 1) - 1;
    else this.eliminarDelCarrito(i);
  }

  async confirmarCompra(): Promise<void> {
    const items = this.carrito.map(p => ({
      producto_id:     p.id,
      cantidad:        p.cantidad || 1,
      precio_unitario: p.precio
    }));

    const { error } = await this.supabase.crearPedido(items, this.totalCarrito);

    if (error) {
      this.showToast('⚠️ Error al procesar el pedido. Intenta de nuevo.');
      return;
    }

    this.zone.run(() => {
      this.carrito = [];
      this.mostrarCarrito = false;
      this.mostrarConfirmacion = true;
    });
    setTimeout(() => {
      this.zone.run(() => {
        this.mostrarConfirmacion = false;
        this.cd.detectChanges();
      });
    }, 4000);
  }

  escanearPiel(): void { this.mostrarEscaneo = true; this.pasoEscaneo = 0; }

  siguientePaso(): void {
    if (this.pasoEscaneo < this.pasos.length - 1) this.pasoEscaneo++;
    else { this.mostrarEscaneo = false; this.showToast('🔬 Análisis con IA — ¡Próximamente!'); }
  }

  showToast(msg: string): void {
    this.mensajeToast = msg;
    setTimeout(() => {
      this.zone.run(() => {
        this.mensajeToast = '';
        this.cd.detectChanges();
      });
    }, 2800);
  }

  getEstrellas(n: number, total = 5): string[] {
    return Array(total).fill(0).map((_, i) => i < n ? '★' : '☆');
  }
}