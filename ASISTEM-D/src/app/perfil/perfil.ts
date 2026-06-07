import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.css']
})
export class PerfilComponent implements OnInit {

  private inicializado = false;

  cargando = true;
  guardando = false;
  mensajeToast = '';
  tabActiva: 'resumen' | 'pedidos' | 'favoritos' | 'editar' = 'resumen';

  usuario: any = null;
  perfil: any = null;
  pedidos: any[] = [];
  favoritos: any[] = [];

  editForm = {
    nombre: '',
    apellido: '',
    telefono: '',
    tipo_piel: '',
    fecha_nacimiento: ''
  };

  tiposPiel = ['Normal', 'Seca', 'Grasa', 'Mixta', 'Sensible'];

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.inicializado) return;
    this.inicializado = true;

    // NgZone.run garantiza que Angular detecte todos los cambios
    // que ocurren dentro de callbacks async/await de librerías externas (Supabase)
    this.ngZone.run(async () => {
      try {
        console.log('STEP 1 - inicio ngOnInit');

        console.log('STEP 2 - obteniendo sesión...');
        const { session } = await this.supabase.getSession();
        console.log('STEP 3 - sesión obtenida:', !!session);

        if (!session) {
          console.log('Sin sesión, redirigiendo a login');
          this.router.navigate(['/login']);
          return;
        }

        this.usuario = session.user;
        console.log('STEP 4 - usuario:', this.usuario?.email);

        console.log('STEP 5 - creando perfil si no existe...');
        await this.supabase.crearPerfilSiNoExiste();
        console.log('STEP 6 - crearPerfilSiNoExiste completado');

        console.log('STEP 7 - iniciando carga paralela de datos...');
        await Promise.all([
          this.cargarPerfil(),
          this.cargarPedidos(),
          this.cargarFavoritos()
        ]);
        console.log('STEP 8 - todos los datos cargados correctamente');

      } catch (e) {
        console.error('ERROR CAPTURADO en ngOnInit:', e);
        this.showToast('⚠️ Error al cargar el perfil');
      } finally {
        console.log('STEP 9 - finally ejecutado, cargando = false');
        this.cargando = false;
        this.cdr.detectChanges(); // forzar re-render
      }
    });
  }

  async cargarPerfil(): Promise<void> {
    try {
      console.log('  [cargarPerfil] iniciando...');
      const { data, error } = await this.supabase.getPerfil();
      console.log('  [cargarPerfil] data:', JSON.stringify(data));
      console.log('  [cargarPerfil] error:', JSON.stringify(error));

      if (error) {
        console.error('  [cargarPerfil] ERROR:', error);
        return;
      }

      if (data) {
        this.perfil = data;
        this.editForm = {
          nombre:           data.nombre || '',
          apellido:         data.apellido || '',
          telefono:         data.telefono || '',
          tipo_piel:        data.tipo_piel || '',
          fecha_nacimiento: data.fecha_nacimiento || ''
        };
        console.log('  [cargarPerfil] perfil cargado:', this.perfil);
      } else {
        console.warn('  [cargarPerfil] data es null — la fila puede no existir o RLS está bloqueando');
      }
    } catch (e) {
      console.error('  [cargarPerfil] EXCEPCIÓN:', e);
    }
  }

  async cargarPedidos(): Promise<void> {
    try {
      console.log('  [cargarPedidos] iniciando...');
      const { data, error } = await this.supabase.getMisPedidos();
      console.log('  [cargarPedidos] cantidad:', data?.length, 'error:', JSON.stringify(error));
      if (error) console.error('  [cargarPedidos] ERROR:', error);
      this.pedidos = data || [];
    } catch (e) {
      console.error('  [cargarPedidos] EXCEPCIÓN:', e);
      this.pedidos = [];
    }
  }

  async cargarFavoritos(): Promise<void> {
    try {
      console.log('  [cargarFavoritos] iniciando...');
      const { data: favIds, error } = await this.supabase.getFavoritos();
      console.log('  [cargarFavoritos] favIds:', favIds?.length, 'error:', JSON.stringify(error));
      if (error) console.error('  [cargarFavoritos] ERROR:', error);

      if (!favIds || favIds.length === 0) {
        this.favoritos = [];
        return;
      }

      const { data: productos } = await this.supabase.getProductos();
      if (productos) {
        const ids = favIds.map((f: any) => f.producto_id);
        this.favoritos = productos.filter((p: any) => ids.includes(p.id));
      }
    } catch (e) {
      console.error('  [cargarFavoritos] EXCEPCIÓN:', e);
      this.favoritos = [];
    }
  }

  async guardarPerfil(): Promise<void> {
    this.guardando = true;
    try {
      const { error } = await this.supabase.actualizarPerfil(this.editForm);
      if (error) {
        console.error('[guardarPerfil] error:', error);
        this.showToast('⚠️ Error al guardar los cambios');
      } else {
        await this.cargarPerfil();
        this.tabActiva = 'resumen';
        this.showToast('✅ Perfil actualizado correctamente');
      }
    } catch (e) {
      console.error('[guardarPerfil] EXCEPCIÓN:', e);
      this.showToast('⚠️ Error inesperado');
    } finally {
      this.guardando = false;
    }
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.logout();
    this.router.navigate(['/login']);
  }

  get nombreCompleto(): string {
    if (this.perfil?.nombre || this.perfil?.apellido) {
      return `${this.perfil.nombre || ''} ${this.perfil.apellido || ''}`.trim();
    }
    return this.usuario?.email?.split('@')[0] || 'Usuario';
  }

  get iniciales(): string {
    const nombre   = this.perfil?.nombre || this.usuario?.email || 'U';
    const apellido = this.perfil?.apellido || '';
    return `${nombre[0]}${apellido[0] || ''}`.toUpperCase();
  }

  get totalGastado(): number {
    return this.pedidos.reduce((a, p) => a + (Number(p.total) || 0), 0);
  }

  get pedidosPendientes(): number {
    return this.pedidos.filter(p => p.estado === 'pendiente').length;
  }

  getEstadoColor(estado: string): string {
    const map: any = {
      'pendiente':  '#BA7517',
      'completado': '#3B6D11',
      'cancelado':  '#A32D2D'
    };
    return map[estado] || '#888';
  }

  showToast(msg: string): void {
    this.mensajeToast = msg;
    setTimeout(() => this.mensajeToast = '', 3000);
  }
}