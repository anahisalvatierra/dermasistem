import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import {
  MatrizNotas, Preocupacion, ProductoRec, Recomendacion, TipoPiel,
  normalizarTipoPiel, nivelDesdeEtiqueta, preocupacionesDesdeEscaneo, recomendar,
} from './recomendador';

/** Clave donde el modal "Escanea tu piel" guarda el último resultado */
export const CLAVE_ESCANEO = 'dermasistem_ultimo_escaneo';

interface UltimoEscaneo {
  nivel: string;               // p. ej. "nivel_1_moderado"
  confianza: number | null;    // 0..1
  tipo_piel: string | null;    // texto extraído por el NLP (puede ser null)
  fecha: string;
}

@Component({
  selector: 'app-recomendaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './recomendaciones.html',
  styleUrls: ['./recomendaciones.css']
})
export class RecomendacionesComponent implements OnInit {

  cargando = true;
  mensajeToast = '';

  // Datos
  usuarioId: string | null = null;
  productos: ProductoRec[] = [];
  notas: MatrizNotas = {};
  favoritosIds: Set<string> = new Set();
  comprasIds: string[] = [];

  // Perfil de piel (lo que alimenta la recomendación)
  escaneo: UltimoEscaneo | null = null;
  nivelAcne: number | null = null;
  tipoPiel: TipoPiel | null = null;
  preocupaciones: Preocupacion[] = [];

  // Resultado
  recomendaciones: Recomendacion[] = [];
  usaColaborativo = false;
  avisoDermatologo: string | null = null;

  readonly tiposPiel: TipoPiel[] = ['Grasa', 'Seca', 'Mixta', 'Normal', 'Sensible'];
  readonly opcionesPreocupacion: { id: Preocupacion; label: string }[] = [
    { id: 'acne',         label: 'Acné' },
    { id: 'poros',        label: 'Poros' },
    { id: 'hidratacion',  label: 'Hidratación' },
    { id: 'manchas',      label: 'Manchas y tono' },
    { id: 'sensibilidad', label: 'Piel sensible' },
    { id: 'proteccion',   label: 'Protección solar' },
    { id: 'limpieza',     label: 'Limpieza' },
    { id: 'cobertura',    label: 'Maquillaje' },
  ];
  readonly niveles = [
    { valor: 0, label: 'Leve' },
    { valor: 1, label: 'Moderado' },
    { valor: 2, label: 'Severo' },
    { valor: 3, label: 'Muy severo' },
  ];
  readonly estrellasRating = [1, 2, 3, 4, 5];

  constructor(
    private supabase: SupabaseService,
    private cd: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const { session } = await this.supabase.getSession();
      this.usuarioId = session?.user?.id ?? null;

      const [prods, califs, favs, compras, perfil] = await Promise.all([
        this.supabase.getProductos(),
        this.supabase.getCalificaciones(),
        this.supabase.getFavoritos(),
        this.supabase.getMisComprasIds(),
        this.supabase.getPerfil(),
      ]);

      this.productos = (prods.data ?? []).map((p: any): ProductoRec => ({
        id: p.id,
        nombre: p.nombre,
        marca: p.marca,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        categoria: p.categorias?.nombre ?? '',
        piel: Array.isArray(p.piel) ? p.piel : [],
        preocupaciones: Array.isArray(p.preocupaciones) ? p.preocupaciones : [],
        estrellas: p.estrellas || 4,
        emoji: p.emoji || '✨',
        color: p.color || '#F9E4D4',
        badge: p.badge || undefined,
      }));

      for (const c of (califs.data ?? []) as any[]) {
        (this.notas[c.usuario_id] ??= {})[c.producto_id] = c.nota;
      }
      this.favoritosIds = new Set(((favs.data ?? []) as any[]).map(f => f.producto_id));
      this.comprasIds = Array.from(new Set(
        ((compras.data ?? []) as any[]).flatMap(p => (p.pedido_items ?? []).map((i: any) => i.producto_id))
      ));

      // Perfil guardado + último escaneo
      this.tipoPiel = normalizarTipoPiel((perfil.data as any)?.tipo_piel);
      this.escaneo = this.leerEscaneo();
      if (this.escaneo) {
        this.nivelAcne = nivelDesdeEtiqueta(this.escaneo.nivel);
        this.preocupaciones = preocupacionesDesdeEscaneo(this.nivelAcne);
        this.tipoPiel = this.tipoPiel ?? normalizarTipoPiel(this.escaneo.tipo_piel);
      }
    } catch (e) {
      console.error('Error cargando recomendaciones:', e);
      this.showToast('⚠️ No se pudieron cargar algunos datos');
    }

    this.zone.run(() => {
      this.recalcular();
      this.cargando = false;
      this.cd.detectChanges();
    });
  }

  // ── Perfil ──────────────────────────────────────────

  private leerEscaneo(): UltimoEscaneo | null {
    try {
      const raw = sessionStorage.getItem(CLAVE_ESCANEO);
      return raw ? (JSON.parse(raw) as UltimoEscaneo) : null;
    } catch {
      return null;
    }
  }

  seleccionarTipo(t: TipoPiel): void {
    this.tipoPiel = this.tipoPiel === t ? null : t;
    this.recalcular();
  }

  togglePreocupacion(c: Preocupacion): void {
    this.preocupaciones = this.preocupaciones.includes(c)
      ? this.preocupaciones.filter(x => x !== c)
      : [...this.preocupaciones, c];
    this.recalcular();
  }

  seleccionarNivel(n: number | null): void {
    this.nivelAcne = this.nivelAcne === n ? null : n;
    if (this.nivelAcne !== null && this.preocupaciones.length === 0) {
      this.preocupaciones = preocupacionesDesdeEscaneo(this.nivelAcne);
    }
    this.recalcular();
  }

  quitarEscaneo(): void {
    try { sessionStorage.removeItem(CLAVE_ESCANEO); } catch { /* sin acceso a sessionStorage */ }
    this.escaneo = null;
    this.nivelAcne = null;
    this.recalcular();
  }

  // ── Recomendación ───────────────────────────────────

  recalcular(): void {
    const r = recomendar(
      this.productos,
      { tipoPiel: this.tipoPiel, preocupaciones: this.preocupaciones, nivelAcne: this.nivelAcne },
      {
        usuarioId: this.usuarioId,
        notas: this.notas,
        favoritosIds: Array.from(this.favoritosIds),
        comprasIds: this.comprasIds,
        limite: 12,
      }
    );
    this.recomendaciones = r.recomendaciones;
    this.usaColaborativo = r.usaColaborativo;
    this.avisoDermatologo = r.avisoDermatologo;
    this.cd.detectChanges();
  }

  // ── Interacción con los productos ───────────────────

  miNota(productoId: string): number {
    return (this.usuarioId && this.notas[this.usuarioId]?.[productoId]) || 0;
  }

  async calificar(p: ProductoRec, nota: number): Promise<void> {
    if (!this.usuarioId) return;
    const { error } = await this.supabase.guardarCalificacion(p.id, nota);
    if (error) {
      this.showToast('⚠️ No se pudo guardar tu calificación');
      return;
    }
    this.zone.run(() => {
      (this.notas[this.usuarioId!] ??= {})[p.id] = nota;
      this.recalcular();
    });
    this.showToast(`★ Calificaste "${p.nombre}" con ${nota}`);
  }

  esFavorito(productoId: string): boolean {
    return this.favoritosIds.has(productoId);
  }

  async toggleFavorito(p: ProductoRec): Promise<void> {
    const { accion, error } = await this.supabase.toggleFavoritoDb(p.id);
    if (error) {
      this.showToast('⚠️ No se pudo actualizar favoritos');
      return;
    }
    this.zone.run(() => {
      if (accion === 'agregado') this.favoritosIds.add(p.id);
      else this.favoritosIds.delete(p.id);
      this.recalcular();
    });
    this.showToast(accion === 'agregado' ? '❤️ Añadido a favoritos' : 'Eliminado de favoritos');
  }

  // ── Utilidades de la vista ──────────────────────────

  etiquetaNivel(n: number | null): string {
    return this.niveles.find(x => x.valor === n)?.label ?? '';
  }

  getEstrellas(n: number, total = 5): string[] {
    return Array(total).fill(0).map((_, i) => (i < n ? '★' : '☆'));
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
}
