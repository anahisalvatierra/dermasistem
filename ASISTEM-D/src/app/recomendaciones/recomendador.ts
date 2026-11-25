/**
 * Motor de recomendación de productos — DermAsistem
 * ==================================================
 * Sistema HÍBRIDO:
 *  1) Basado en contenido: cruza el perfil de piel (resultado del escaneo +
 *     tipo de piel + preocupaciones) con las etiquetas de cada producto.
 *  2) Filtrado colaborativo basado en usuarios (el de la clase): similitud
 *     euclidiana entre usuarios y promedio ponderado de sus calificaciones.
 *
 * Sin dependencias de Angular: son funciones puras, fáciles de probar.
 */

// ───────────────────────── Tipos ─────────────────────────

export type TipoPiel = 'Grasa' | 'Seca' | 'Mixta' | 'Normal' | 'Sensible';
export type Preocupacion =
  | 'acne' | 'poros' | 'hidratacion' | 'manchas'
  | 'sensibilidad' | 'proteccion' | 'limpieza' | 'cobertura';

export interface ProductoRec {
  id: string;
  nombre: string;
  marca: string;
  descripcion?: string;
  precio: number;
  categoria: string;            // nombre de la categoría (Limpieza, Tratamiento...)
  piel: string[];               // columna "piel" de Supabase
  preocupaciones: string[];     // columna "preocupaciones" (SQL nuevo)
  estrellas: number;            // estrellas generales (1-5)
  emoji?: string;
  color?: string;
  badge?: string;
}

export interface PerfilPiel {
  tipoPiel: TipoPiel | null;
  preocupaciones: Preocupacion[];
  /** Nivel de acné del escaneo: 0 leve, 1 moderado, 2 severo, 3 muy severo; null = sin escaneo */
  nivelAcne: number | null;
}

/** usuarioId -> (productoId -> nota 1..5) */
export type MatrizNotas = Record<string, Record<string, number>>;

export interface Recomendacion {
  producto: ProductoRec;
  puntaje: number;              // 0..1
  puntajeContenido: number;     // 0..1
  puntajeColaborativo: number | null; // 0..1 (null si no hay datos suficientes)
  razones: string[];
  /** Aviso cuando el producto no está pensado para el tipo de piel del usuario */
  advertencia: string | null;
  coincidencias: number;        // cuántas preocupaciones del perfil cubre
}

export interface ResultadoRecomendacion {
  recomendaciones: Recomendacion[];
  usaColaborativo: boolean;
  usuariosSimilares: { usuario: string; similitud: number }[];
  avisoDermatologo: string | null;
}

// ─────────────────── Utilidades de perfil ───────────────────

const ETIQUETAS: Record<Preocupacion, string> = {
  acne: 'acné',
  poros: 'poros',
  hidratacion: 'hidratación',
  manchas: 'manchas y tono',
  sensibilidad: 'piel sensible',
  proteccion: 'protección solar',
  limpieza: 'limpieza',
  cobertura: 'maquillaje',
};

export function etiquetaPreocupacion(p: string): string {
  return (ETIQUETAS as Record<string, string>)[p] ?? p;
}

/** Convierte texto libre ("tengo piel grasa") en un tipo de piel conocido. */
export function normalizarTipoPiel(texto: string | null | undefined): TipoPiel | null {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (t.includes('sensib')) return 'Sensible';
  if (t.includes('mixt') || t.includes('combin')) return 'Mixta';
  if (t.includes('gras') || t.includes('oleos')) return 'Grasa';
  if (t.includes('sec')) return 'Seca';
  if (t.includes('normal')) return 'Normal';
  return null;
}

/** Preocupaciones sugeridas a partir del resultado del escaneo. */
export function preocupacionesDesdeEscaneo(nivelAcne: number | null): Preocupacion[] {
  return nivelAcne === null || nivelAcne === undefined ? [] : ['acne', 'poros'];
}

export function nivelDesdeEtiqueta(nivel: string | null | undefined): number | null {
  const m = /nivel_(\d)/.exec(nivel ?? '');
  return m ? Number(m[1]) : null;
}

// ──────────── Filtrado colaborativo (el de la clase) ────────────

/** Similitud euclidiana 0..1 entre dos usuarios (igual que en el ejercicio de clase). */
export function euclidiana(base: MatrizNotas, u1: string, u2: string): { sim: number; comunes: number } {
  let suma = 0;
  let comunes = 0;
  for (const item of Object.keys(base[u1] ?? {})) {
    if (item in (base[u2] ?? {})) {
      suma += Math.pow(base[u1][item] - base[u2][item], 2);
      comunes++;
    }
  }
  if (comunes === 0) return { sim: 0, comunes: 0 };
  return { sim: 1 / (1 + Math.sqrt(suma)), comunes };
}

export function getSimilares(base: MatrizNotas, usuario: string, top = 5) {
  return Object.keys(base)
    .filter(o => o !== usuario)
    .map(o => ({ usuario: o, ...euclidiana(base, usuario, o) }))
    .map(x => ({ ...x, simAjustada: x.sim * (x.comunes / (x.comunes + 2)) })) // confianza por ítems en común
    .filter(x => x.simAjustada > 0)
    .sort((a, b) => b.simAjustada - a.simAjustada)
    .slice(0, top);
}

/** Nota esperada (1..5) para los productos que el usuario aún no ha calificado. */
export function getRecomendacionesUsuario(base: MatrizNotas, usuario: string): Record<string, number> {
  const totales: Record<string, number> = {};
  const sumaSim: Record<string, number> = {};
  for (const otro of Object.keys(base)) {
    if (otro === usuario) continue;
    const { sim, comunes } = euclidiana(base, usuario, otro);
    const w = sim * (comunes / (comunes + 2));
    if (w <= 0) continue;
    for (const item of Object.keys(base[otro])) {
      if (item in (base[usuario] ?? {})) continue;
      totales[item] = (totales[item] ?? 0) + base[otro][item] * w;
      sumaSim[item] = (sumaSim[item] ?? 0) + w;
    }
  }
  const out: Record<string, number> = {};
  for (const item of Object.keys(totales)) out[item] = totales[item] / sumaSim[item];
  return out;
}

// ───────────────── Puntaje por contenido ─────────────────

const CATEGORIAS_BASICAS = ['limpieza', 'hidratación', 'hidratacion', 'protección', 'proteccion', 'tratamiento'];

function puntajeContenido(p: ProductoRec, perfil: PerfilPiel, razones: string[]): { score: number; coincidencias: number } {
  // a) Tipo de piel
  let piel = 0.5; // neutro si no se conoce el tipo
  if (perfil.tipoPiel) {
    if (p.piel.includes(perfil.tipoPiel)) {
      piel = 1;
      razones.push(`Apto para piel ${perfil.tipoPiel.toLowerCase()}`);
    } else if (p.piel.includes('Todo tipo')) {
      piel = 0.8;
      razones.push('Apto para todo tipo de piel');
    } else {
      piel = 0;
    }
  }

  // b) Preocupaciones
  const coinc = perfil.preocupaciones.filter(c => p.preocupaciones.includes(c));
  const denom = Math.max(1, Math.min(perfil.preocupaciones.length, 2));
  const preoc = perfil.preocupaciones.length ? Math.min(1, coinc.length / denom) : 0.5;
  if (coinc.length) razones.push(`Ayuda con: ${coinc.map(etiquetaPreocupacion).join(', ')}`);

  // c) Popularidad (estrellas generales): solo desempata
  const pop = Math.min(5, Math.max(0, p.estrellas)) / 5;

  // d) Ajuste por categoría según el resultado del escaneo
  let ajuste = 0.5;
  const cat = p.categoria.toLowerCase();
  if (perfil.nivelAcne !== null) {
    if (CATEGORIAS_BASICAS.includes(cat)) ajuste = 0.8;
    if (cat === 'maquillaje') ajuste = perfil.nivelAcne >= 2 ? 0.0 : 0.3; // con acné marcado, el maquillaje pasa a segundo plano
  }

  return { score: 0.4 * piel + 0.4 * preoc + 0.1 * pop + 0.1 * ajuste, coincidencias: coinc.length };
}

// ───────────────────── Motor híbrido ─────────────────────

export interface OpcionesRecomendar {
  usuarioId?: string | null;
  /** Notas de otros usuarios (reales + demo) */
  notas?: MatrizNotas;
  /** Señales del usuario actual: favoritos (nota 5) y compras (nota 4.5) */
  favoritosIds?: string[];
  comprasIds?: string[];
  /** Cuántos resultados devolver */
  limite?: number;
  /** Si es true, oculta los productos que el usuario ya tiene en favoritos o compró (por defecto se muestran) */
  ocultarYaTiene?: boolean;
}

const PESO_CONTENIDO = 0.65;
const PESO_COLABORATIVO = 0.35;

export function recomendar(
  productos: ProductoRec[],
  perfil: PerfilPiel,
  opciones: OpcionesRecomendar = {}
): ResultadoRecomendacion {
  const { usuarioId = null, notas = {}, favoritosIds = [], comprasIds = [], limite = 8, ocultarYaTiene = false } = opciones;

  // Matriz con el usuario actual: sus notas explícitas + favoritos/compras como señal implícita
  const yo = usuarioId ?? '__yo__';
  const base: MatrizNotas = {};
  for (const [u, r] of Object.entries(notas)) if (u !== yo) base[u] = { ...r };
  const mias: Record<string, number> = { ...(notas[yo] ?? {}) };
  for (const id of comprasIds) mias[id] = Math.max(mias[id] ?? 0, 4.5);
  for (const id of favoritosIds) mias[id] = Math.max(mias[id] ?? 0, 5);
  const tieneSenales = Object.keys(mias).length > 0;
  if (tieneSenales) base[yo] = mias;

  const esperadas = tieneSenales ? getRecomendacionesUsuario(base, yo) : {};
  const usaColaborativo = Object.keys(esperadas).length > 0;
  const similares = tieneSenales
    ? getSimilares(base, yo, 3).map(s => ({ usuario: s.usuario, similitud: Math.round(s.simAjustada * 100) / 100 }))
    : [];

  const recs: Recomendacion[] = productos.map(p => {
    const razones: string[] = [];
    const c = puntajeContenido(p, perfil, razones);
    let cf: number | null = null;
    if (p.id in mias) {
      // Señal propia: nota explícita, favorito o compra
      cf = Math.min(1, Math.max(0, (mias[p.id] - 1) / 4));
      if (notas[yo]?.[p.id] !== undefined) razones.push(`Lo calificaste con ${notas[yo][p.id]} ★`);
      else if (favoritosIds.includes(p.id)) razones.push('Está en tus favoritos');
      else razones.push('Ya lo compraste');
    } else if (usaColaborativo && p.id in esperadas) {
      cf = Math.min(1, Math.max(0, (esperadas[p.id] - 1) / 4));
      if (cf >= 0.7) razones.push('Les gustó a personas con gustos parecidos a los tuyos');
    }
    const puntaje = cf === null ? c.score : PESO_CONTENIDO * c.score + PESO_COLABORATIVO * cf;
    const noEsParaSuPiel =
      perfil.tipoPiel !== null && !p.piel.includes(perfil.tipoPiel) && !p.piel.includes('Todo tipo');
    const advertencia = noEsParaSuPiel
      ? `Pensado para piel ${p.piel.map(x => x.toLowerCase()).join(' o ')}: pruébalo primero en una zona pequeña`
      : null;
    return { producto: p, puntaje, puntajeContenido: c.score, puntajeColaborativo: cf, razones, advertencia, coincidencias: c.coincidencias };
  });

  const yaTiene = new Set([...favoritosIds, ...comprasIds]);
  const candidatos = ocultarYaTiene ? recs.filter(r => !yaTiene.has(r.producto.id)) : recs;

  candidatos.sort((a, b) => b.puntaje - a.puntaje);

  const aviso =
    perfil.nivelAcne !== null && perfil.nivelAcne >= 2
      ? 'Tu escaneo indica acné de nivel severo o muy severo. Estos productos son solo de apoyo para el cuidado diario: te recomendamos consultar a un dermatólogo.'
      : null;

  return { recomendaciones: candidatos.slice(0, limite), usaColaborativo, usuariosSimilares: similares, avisoDermatologo: aviso };
}
