import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit {

  // ── Estado ──
  autenticado = false;
  cargando = true;
  guardando = false;
  mensajeToast = '';
  tabActiva: 'dashboard' | 'productos' | 'pedidos' | 'usuarios' = 'dashboard';

  // ── Login admin ──
  loginForm = { email: '', password: '' };
  loginError = '';
  loginCargando = false;
  ADMIN_PASSWORD = 'Admin2025*';

  // ── Datos ──
  estadisticas: any = {};
  usuarios: any[] = [];
  pedidos: any[] = [];
  productos: any[] = [];
  categorias: any[] = [];

  // ── Producto form ──
  mostrarFormProducto = false;
  editandoProducto: any = null;
  productoForm: any = {
    nombre: '', marca: '', descripcion: '',
    precio: 0, categoria_id: '', emoji: '🌿',
    color: '#F5E9E2', badge: '', estrellas: 5,
    piel: [], activo: true
  };
  tiposPiel = ['Normal', 'Seca', 'Grasa', 'Mixta', 'Sensible', 'Todo tipo'];
  estadosPedido = ['pendiente', 'completado', 'cancelado'];

  // ── Búsqueda ──
  busquedaUsuarios = '';
  busquedaPedidos = '';
  busquedaProductos = '';

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const adminGuardado = sessionStorage.getItem('dermasistem_admin');
    if (adminGuardado) {
      this.autenticado = true;
      await this.cargarTodo();
    }
    this.cargando = false;
  }

  async loginAdmin(): Promise<void> {
    if (!this.loginForm.email || !this.loginForm.password) {
      this.loginError = 'Completa todos los campos';
      return;
    }
    this.loginCargando = true;
    this.loginError = '';

    if (this.loginForm.password !== this.ADMIN_PASSWORD) {
      this.loginError = 'Contraseña incorrecta';
      this.loginCargando = false;
      return;
    }

    const { data, error } = await this.supabase.loginAdmin(
      this.loginForm.email,
      this.loginForm.password
    );

    this.loginCargando = false;

    if (error || !data) {
      this.loginError = 'Email de administrador no encontrado';
      return;
    }

    sessionStorage.setItem('dermasistem_admin', JSON.stringify(data));
    this.autenticado = true;
    await this.cargarTodo();
  }

  async cargarTodo(): Promise<void> {
    this.cargando = true;
    await Promise.all([
      this.cargarEstadisticas(),
      this.cargarUsuarios(),
      this.cargarPedidos(),
      this.cargarProductos(),
      this.cargarCategorias()
    ]);
    this.cargando = false;
  }

  async cargarEstadisticas(): Promise<void> {
    this.estadisticas = await this.supabase.getEstadisticas();
  }

  async cargarUsuarios(): Promise<void> {
    const { data } = await this.supabase.getUsuariosAdmin();
    this.usuarios = data || [];
  }

  async cargarPedidos(): Promise<void> {
    const { data } = await this.supabase.getPedidosAdmin();
    this.pedidos = data || [];
  }

  async cargarProductos(): Promise<void> {
    const { data } = await this.supabase.getProductos();
    this.productos = data || [];
  }

  async cargarCategorias(): Promise<void> {
    const { data } = await this.supabase.getCategorias();
    this.categorias = data || [];
  }

  // ── Productos ──
  abrirFormProducto(producto?: any): void {
    if (producto) {
      this.editandoProducto = producto;
      this.productoForm = {
        nombre: producto.nombre,
        marca: producto.marca,
        descripcion: producto.descripcion,
        precio: producto.precio,
        categoria_id: producto.categoria_id,
        emoji: producto.emoji,
        color: producto.color,
        badge: producto.badge || '',
        estrellas: producto.estrellas,
        piel: [...(producto.piel || [])],
        activo: producto.activo
      };
    } else {
      this.editandoProducto = null;
      this.productoForm = {
        nombre: '', marca: '', descripcion: '',
        precio: 0, categoria_id: '', emoji: '🌿',
        color: '#F5E9E2', badge: '', estrellas: 5,
        piel: [], activo: true
      };
    }
    this.mostrarFormProducto = true;
  }

  cerrarFormProducto(): void {
    this.mostrarFormProducto = false;
    this.editandoProducto = null;
  }

  togglePiel(tipo: string): void {
    const idx = this.productoForm.piel.indexOf(tipo);
    if (idx > -1) this.productoForm.piel.splice(idx, 1);
    else this.productoForm.piel.push(tipo);
  }

  async guardarProducto(): Promise<void> {
    this.guardando = true;
    try {
      if (this.editandoProducto) {
        const { error } = await this.supabase.actualizarProducto(
          this.editandoProducto.id,
          this.productoForm
        );
        if (error) { this.showToast('⚠️ Error al actualizar'); return; }
        this.showToast('✅ Producto actualizado');
      } else {
        const { error } = await this.supabase.crearProducto(this.productoForm);
        if (error) { this.showToast('⚠️ Error al crear'); return; }
        this.showToast('✅ Producto creado');
      }
      await this.cargarProductos();
      this.cerrarFormProducto();
    } finally {
      this.guardando = false;
    }
  }

  async eliminarProducto(id: string): Promise<void> {
    if (!confirm('¿Desactivar este producto?')) return;
    const { error } = await this.supabase.eliminarProducto(id);
    if (error) { this.showToast('⚠️ Error al eliminar'); return; }
    this.showToast('✅ Producto desactivado');
    await this.cargarProductos();
  }

  // ── Pedidos ──
  async cambiarEstadoPedido(pedidoId: string, estado: string): Promise<void> {
    const { error } = await this.supabase.actualizarEstadoPedido(pedidoId, estado);
    if (error) { this.showToast('⚠️ Error al actualizar estado'); return; }
    this.showToast(`✅ Estado actualizado: ${estado}`);
    await this.cargarPedidos();
  }

  // ── Filtros ──
  get usuariosFiltrados(): any[] {
    if (!this.busquedaUsuarios) return this.usuarios;
    const q = this.busquedaUsuarios.toLowerCase();
    return this.usuarios.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.nombre?.toLowerCase().includes(q)
    );
  }

  get pedidosFiltrados(): any[] {
    if (!this.busquedaPedidos) return this.pedidos;
    const q = this.busquedaPedidos.toLowerCase();
    return this.pedidos.filter(p =>
      p.id?.toLowerCase().includes(q) ||
      p.usuarios?.email?.toLowerCase().includes(q) ||
      p.estado?.toLowerCase().includes(q)
    );
  }

  get productosFiltrados(): any[] {
    if (!this.busquedaProductos) return this.productos;
    const q = this.busquedaProductos.toLowerCase();
    return this.productos.filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.marca?.toLowerCase().includes(q)
    );
  }

  get ingresoTotal(): number {
    return this.pedidos.reduce((a, p) => a + (Number(p.total) || 0), 0);
  }

  getEstadoColor(estado: string): string {
    const map: any = {
      'pendiente': '#BA7517',
      'completado': '#3B6D11',
      'cancelado': '#A32D2D'
    };
    return map[estado] || '#888';
  }

  cerrarSesionAdmin(): void {
    sessionStorage.removeItem('dermasistem_admin');
    this.autenticado = false;
  }

  showToast(msg: string): void {
    this.mensajeToast = msg;
    setTimeout(() => this.mensajeToast = '', 3000);
  }

  get pedidosPendientesCount(): number {
  return this.pedidos.filter(p => p.estado === 'pendiente').length;
}
}