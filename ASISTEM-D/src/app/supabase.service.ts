import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vamrnxqhhhsvuysodedb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXJueHFoaGhzdnV5c29kZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTM3NDksImV4cCI6MjA4OTMyOTc0OX0.GcgIV00j725uXa5Y-s8qvgKUt1s38BxMktEIN7WCIiw';

@Injectable({ providedIn: 'root' })
export class SupabaseService {

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  // ── Registro ──
  async registrar(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    return { data, error };
  }

  // ── Login ──
  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  // ── Logout ──
  async logout() {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  // ── Obtener usuario actual ──
  async getUsuario() {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  // ── Recuperar contraseña ──
  async recuperarPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:4200/nueva-password'
    });
    return { data, error };
  }

  // ── Actualizar nueva contraseña ──
  async actualizarPassword(nuevaPassword: string) {
    const { data, error } = await this.supabase.auth.updateUser({
      password: nuevaPassword
    });
    return { data, error };
  }

  // ── Verificar sesión activa ──
  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();
    return { session: data.session, error };
  }

  // ── Escuchar cambios de sesión ──
  onAuthChange(callback: (event: string, session: any) => void) {
    this.supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  // ── PRODUCTOS ──
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

// ── CATEGORÍAS ──
async getCategorias() {
  const { data, error } = await this.supabase
    .from('categorias')
    .select('*')
    .order('nombre');
  return { data, error };
}

// ── FAVORITOS ──
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

  const { data: existe } = await this.supabase
    .from('favoritos')
    .select('id')
    .eq('usuario_id', usuario.id)
    .eq('producto_id', productoId)
    .single();

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

// ── PEDIDOS ──
async crearPedido(items: { producto_id: string; cantidad: number; precio_unitario: number }[], total: number) {
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


}
