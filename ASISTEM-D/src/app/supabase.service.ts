import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';


const SUPABASE_URL = environment.supabaseUrl;
const SUPABASE_KEY = environment.supabaseKey;

@Injectable({ providedIn: 'root' })
export class SupabaseService {

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  // ── AUTENTICACIÓN ──────────────────────────────────────

  async registrar(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    return { data, error };
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  async getUsuario() {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async recuperarPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://dermasistem-gmjc.vercel.app/nueva-password'
    });
    return { data, error };
  }

  async actualizarPassword(nuevaPassword: string) {
    const { data, error } = await this.supabase.auth.updateUser({
      password: nuevaPassword
    });
    return { data, error };
  }

  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();
    return { session: data.session, error };
  }

  onAuthChange(callback: (event: string, session: any) => void) {
    this.supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  // ── PERFIL DE USUARIO ──────────────────────────────────

  async getPerfil() {
    const usuario = await this.getUsuario();
    if (!usuario) return { data: null, error: 'No autenticado' };
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .eq('id', usuario.id)
      .maybeSingle(); // ← FIX: maybeSingle() devuelve null en vez de error cuando no hay fila
    return { data, error };
  }

  async actualizarPerfil(datos: {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    tipo_piel?: string;
    fecha_nacimiento?: string;
    avatar_url?: string;
  }) {
    const usuario = await this.getUsuario();
    if (!usuario) return { data: null, error: 'No autenticado' };
    const { data, error } = await this.supabase
      .from('usuarios')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', usuario.id)
      .select()
      .single();
    return { data, error };
  }

  async crearPerfilSiNoExiste() {
    const usuario = await this.getUsuario();
    if (!usuario) return { error: 'No autenticado' };

    // FIX: usar maybeSingle() para que devuelva null (no error) cuando no existe la fila
    const { data: existe, error: errorBusqueda } = await this.supabase
      .from('usuarios')
      .select('id')
      .eq('id', usuario.id)
      .maybeSingle();

    console.log('crearPerfilSiNoExiste — existe:', existe, 'errorBusqueda:', errorBusqueda);

    if (!existe) {
      console.log('Perfil no existe, creando...');
      const { error } = await this.supabase
        .from('usuarios')
        .insert({ id: usuario.id, email: usuario.email });
      console.log('Perfil creado, error:', error);
      return { error };
    }

    return { error: null };
  }

  // ── PRODUCTOS ──────────────────────────────────────────

  async getProductos() {
    const { data, error } = await this.supabase
      .from('productos')
      .select(`
        *,
        categorias (
          id,
          nombre
        )
      `)
      .eq('activo', true)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  async getProductosPorCategoria(categoriaId: string) {
    const { data, error } = await this.supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('activo', true)
      .eq('categoria_id', categoriaId);
    return { data, error };
  }

  // ── CATEGORÍAS ─────────────────────────────────────────

  async getCategorias() {
    const { data, error } = await this.supabase
      .from('categorias')
      .select('*')
      .order('nombre');
    return { data, error };
  }

  // ── FAVORITOS ──────────────────────────────────────────

  async getFavoritos() {
    const usuario = await this.getUsuario();
    if (!usuario) return { data: [], error: null };
    const { data, error } = await this.supabase
      .from('favoritos')
      .select('producto_id')
      .eq('usuario_id', usuario.id);
    return { data, error };
  }

  async toggleFavoritoDb(productoId: string) {
    const usuario = await this.getUsuario();
    if (!usuario) return { error: 'No autenticado' };

    // FIX: maybeSingle() para no lanzar error cuando no existe el favorito
    const { data: existe } = await this.supabase
      .from('favoritos')
      .select('id')
      .eq('usuario_id', usuario.id)
      .eq('producto_id', productoId)
      .maybeSingle();

    if (existe) {
      const { error } = await this.supabase
        .from('favoritos')
        .delete()
        .eq('usuario_id', usuario.id)
        .eq('producto_id', productoId);
      return { accion: 'eliminado', error };
    } else {
      const { error } = await this.supabase
        .from('favoritos')
        .insert({ usuario_id: usuario.id, producto_id: productoId });
      return { accion: 'agregado', error };
    }
  }

  // ── PEDIDOS ────────────────────────────────────────────

  async crearPedido(
    items: { producto_id: string; cantidad: number; precio_unitario: number }[],
    total: number
  ) {
    const usuario = await this.getUsuario();
    if (!usuario) return { error: 'No autenticado' };

    const { data: pedido, error: errorPedido } = await this.supabase
      .from('pedidos')
      .insert({ usuario_id: usuario.id, total, estado: 'pendiente' })
      .select()
      .single();

    if (errorPedido) return { error: errorPedido };

    const itemsConPedido = items.map(item => ({
      ...item,
      pedido_id: pedido.id
    }));

    const { error: errorItems } = await this.supabase
      .from('pedido_items')
      .insert(itemsConPedido);

    return { data: pedido, error: errorItems };
  }

  async getMisPedidos() {
    const usuario = await this.getUsuario();
    if (!usuario) return { data: [], error: null };

    const { data, error } = await this.supabase
      .from('pedidos')
      .select(`
        *,
        pedido_items (
          cantidad,
          precio_unitario,
          productos (nombre, marca, emoji)
        )
      `)
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  // ── ADMIN — Login ──
  async loginAdmin(email: string, password: string) {
    const { data, error } = await this.supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('activo', true)
      .single();
    return { data, error };
  }

  // ── ADMIN — Usuarios ──
  async getUsuariosAdmin() {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  }

  // ── ADMIN — Todos los pedidos ──
  async getPedidosAdmin() {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select(`
        *,
        usuarios (email, nombre, apellido),
        pedido_items (
          cantidad,
          precio_unitario,
          productos (nombre, marca, emoji)
        )
      `)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  // ── ADMIN — Actualizar estado pedido ──
  async actualizarEstadoPedido(pedidoId: string, estado: string) {
    const { data, error } = await this.supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', pedidoId)
      .select()
      .single();
    return { data, error };
  }

  // ── ADMIN — Crear producto ──
  async crearProducto(producto: any) {
    const { data, error } = await this.supabase
      .from('productos')
      .insert(producto)
      .select()
      .single();
    return { data, error };
  }

  // ── ADMIN — Actualizar producto ──
  async actualizarProducto(id: string, producto: any) {
    const { data, error } = await this.supabase
      .from('productos')
      .update({ ...producto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  // ── ADMIN — Eliminar producto ──
  async eliminarProducto(id: string) {
    const { error } = await this.supabase
      .from('productos')
      .update({ activo: false })
      .eq('id', id);
    return { error };
  }

  // ── ADMIN — Estadísticas ──
  async getEstadisticas() {
    const [usuarios, pedidos, productos, favoritos] = await Promise.all([
      this.supabase.from('usuarios').select('id', { count: 'exact' }),
      this.supabase.from('pedidos').select('id, total', { count: 'exact' }),
      this.supabase.from('productos').select('id', { count: 'exact' }).eq('activo', true),
      this.supabase.from('favoritos').select('id', { count: 'exact' })
    ]);
    return {
      totalUsuarios: usuarios.count || 0,
      totalPedidos: pedidos.count || 0,
      totalProductos: productos.count || 0,
      totalFavoritos: favoritos.count || 0,
      ingresoTotal: pedidos.data?.reduce((a, p) => a + (Number(p.total) || 0), 0) || 0
    };
  }
}