import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../supabase.service';
import { Router, RouterModule, ActivatedRoute } from '@angular/router'

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

export type TipoEscaneo = 'acne' | 'cancer';

@Component({
  selector: 'app-productos',
  standalone: true,
   imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './productos.html',
  styleUrls: ['./productos.css']
})
export class ProductosComponent implements OnInit, OnDestroy {

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

  // ── Escaneo con IA ──
  // ⚠️ true  = usa el backend en tu PC (http://localhost:5000, hay que correr `python app.py`)
  //    false = usa el backend de Render (producción)
  //    Ponlo en FALSE antes de subir el front a Vercel.
  private readonly USAR_BACKEND_LOCAL = false;
  readonly API_URL = this.USAR_BACKEND_LOCAL
    ? 'http://localhost:5000'
    : 'https://dermasistem.onrender.com';

  tipoEscaneo: TipoEscaneo = 'acne';
  imagenSeleccionada: File | null = null;
  previewUrl: string | null = null;
  textoDescripcion = '';
  analizando = false;
  resultado: any = null;
  errorAnalisis: string | null = null;

  // ── Cámara (solo escáner de acné) ──
  camaraActiva = false;
  camaraError: string | null = null;
  private streamCamara: MediaStream | null = null;

  // Pasos del escaneo de acné (rostro)
  pasos = [
    { titulo: 'Frente',           subtitulo: 'Mira directamente a la cámara',    por_que: 'Analizamos textura general, poros y manchas en toda la zona T.' },
    { titulo: 'Perfil derecho',   subtitulo: 'Gira tu rostro hacia la derecha',  por_que: 'Detectamos líneas de expresión y flacidez en el contorno facial.' },
    { titulo: 'Perfil izquierdo', subtitulo: 'Gira tu rostro hacia la izquierda',por_que: 'Comparamos simetría y estado de la piel en ambos lados.' },
    { titulo: 'Listo',            subtitulo: 'Análisis completado',               por_que: 'Te recomendaremos productos ideales para tu tipo de piel.' },
  ];

  // Pasos del escaneo de cáncer de piel (una lesión o lunar)
  pasosCancer = [
    { titulo: 'Foto de la lesión', subtitulo: 'Acércate al lunar o mancha con buena luz', por_que: 'Analizamos la forma, los bordes y el color. Una foto nítida y de cerca mejora el análisis.' },
    { titulo: 'Listo',             subtitulo: 'Análisis completado',                       por_que: 'Te daremos una orientación y te diremos cuándo conviene consultar a un dermatólogo.' },
  ];

  // ✅ Inyectar ChangeDetectorRef y NgZone
  constructor(
    private supabase: SupabaseService,
    private cd: ChangeDetectorRef,
    private zone: NgZone,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    this.calentarBackend();
    this.restaurarCarrito();
    console.log('ngOnInit iniciado');

    const session = await this.supabase.getSession();
    console.log('Sesión activa:', session.session?.user?.email);

    try {
      // ✅ Cargar en orden: primero favoritos, luego productos
      await this.cargarCategorias();
      await this.cargarFavoritos();
      await this.cargarProductos();
      this.agregarDesdeRecomendacion();
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

  // ── Carrito: se conserva al ir de "Productos" a "Para ti" y volver (mientras no cierres la pestaña) ──

  private readonly CLAVE_CARRITO = 'dermasistem_carrito';

  private guardarCarrito(): void {
    try {
      sessionStorage.setItem(this.CLAVE_CARRITO, JSON.stringify(this.carrito));
    } catch { /* sessionStorage no disponible */ }
  }

  private restaurarCarrito(): void {
    try {
      const guardado = sessionStorage.getItem(this.CLAVE_CARRITO);
      if (!guardado) return;
      const lista = JSON.parse(guardado);
      if (Array.isArray(lista)) this.carrito = lista;
    } catch { /* si está dañado, se empieza con el carrito vacío */ }
  }

  /** Si se llega desde "Para ti" con ?comprar=<id>, agrega ese producto al carrito y lo abre. */
  private agregarDesdeRecomendacion(): void {
    const id = this.route.snapshot.queryParamMap.get('comprar');
    if (!id) return;

    const producto = this.productos.find(p => String(p.id) === id);
    if (producto) {
      this.agregarAlCarrito(producto);
      this.mostrarCarrito = true;
    } else {
      this.showToast('⚠️ No encontramos ese producto en la tienda');
    }

    // Quita el parámetro de la dirección, para que al recargar no se agregue otra vez
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
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
    this.guardarCarrito();
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

  eliminarDelCarrito(i: number): void { this.carrito.splice(i, 1); this.guardarCarrito(); }
  aumentarCantidad(i: number):   void { this.carrito[i].cantidad = (this.carrito[i].cantidad || 1) + 1; this.guardarCarrito(); }
  disminuirCantidad(i: number):  void {
    if ((this.carrito[i].cantidad || 1) > 1) this.carrito[i].cantidad = (this.carrito[i].cantidad || 1) - 1;
    else this.eliminarDelCarrito(i);
    this.guardarCarrito();
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
      this.guardarCarrito();
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

  // ── Cámara (solo escáner de acné) ──

  ngOnDestroy(): void {
    this.detenerCamara();
  }

  /** true si el navegador permite usar la cámara (requiere https o localhost) */
  get camaraDisponible(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async abrirCamara(): Promise<void> {
    this.camaraError = null;
    this.detenerCamara();

    if (!this.camaraDisponible) {
      this.camaraError = 'Tu navegador no permite usar la cámara aquí. Sube una foto desde tu galería.';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      this.streamCamara = stream;

      // Se muestra el visor y, cuando ya existe en pantalla, se le conecta la cámara
      this.zone.run(() => {
        this.camaraActiva = true;
        this.cd.detectChanges();
      });
      const video = document.getElementById('videoCamara') as HTMLVideoElement | null;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
    } catch (e: any) {
      const nombre = e?.name || '';
      let msg = 'No se pudo abrir la cámara. Puedes subir una foto desde tu galería.';
      if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
        msg = 'No diste permiso para usar la cámara. Actívalo en el navegador o sube una foto.';
      } else if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
        msg = 'No se encontró ninguna cámara en este dispositivo.';
      } else if (nombre === 'NotReadableError') {
        msg = 'La cámara está siendo usada por otra aplicación.';
      }
      this.zone.run(() => {
        this.camaraError = msg;
        this.camaraActiva = false;
        this.cd.detectChanges();
      });
    }
  }

  capturarFoto(): void {
    const video = document.getElementById('videoCamara') as HTMLVideoElement | null;
    if (!video || !video.videoWidth) {
      this.showToast('⚠️ La cámara aún no está lista, espera un segundo');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const vistaPrevia = canvas.toDataURL('image/jpeg', 0.92);

    canvas.toBlob((blob) => {
      this.zone.run(() => {
        if (!blob) {
          this.showToast('⚠️ No se pudo tomar la foto, intenta de nuevo');
          return;
        }
        this.imagenSeleccionada = new File([blob], 'foto-camara.jpg', { type: 'image/jpeg' });
        this.previewUrl = vistaPrevia;
        this.detenerCamara();
        this.cd.detectChanges();
      });
    }, 'image/jpeg', 0.92);
  }

  /** Apaga la cámara (y su luz indicadora). Se llama al cancelar, al cerrar el escaneo y al salir de la página. */
  detenerCamara(): void {
    this.streamCamara?.getTracks().forEach((t) => t.stop());
    this.streamCamara = null;
    const video = document.getElementById('videoCamara') as HTMLVideoElement | null;
    if (video) video.srcObject = null;
    this.camaraActiva = false;
  }

  // ── Escaneo con IA ──

  /** Pasos según el tipo de escaneo elegido */
  get pasosActuales() {
    return this.tipoEscaneo === 'cancer' ? this.pasosCancer : this.pasos;
  }

  /** true cuando estamos en el último paso ("Listo") */
  get esPasoListo(): boolean {
    return this.pasoEscaneo === this.pasosActuales.length - 1;
  }

  /** true si el resultado que llegó es del módulo de cáncer */
  get esResultadoCancer(): boolean {
    return this.resultado?.tipo === 'cancer';
  }

  get placeholderDescripcion(): string {
    return this.tipoEscaneo === 'cancer'
      ? 'Cuéntanos más (opcional): zona del cuerpo, desde cuándo lo notas, si ha cambiado, pica o sangra...'
      : 'Cuéntanos más (opcional): zona afectada, hace cuánto tiempo, tipo de piel...';
  }

  escanearPiel(): void {
    this.calentarBackend();
    this.mostrarEscaneo = true;
    this.tipoEscaneo = 'acne';
    this.pasoEscaneo = 0;
    this.imagenSeleccionada = null;
    this.previewUrl = null;
    this.textoDescripcion = '';
    this.resultado = null;
    this.errorAnalisis = null;
    this.analizando = false;
    this.detenerCamara();
    this.camaraError = null;
  }
  private calentarBackend(): void {  // ← pega la definición aquí, fuera de escanearPiel
    fetch(`${this.API_URL}/salud`).catch(() => {});
  }
  private async reducirImagen(file: File, maxLado = 800, calidad = 0.85): Promise<Blob> {
    try {
      const bitmap = await createImageBitmap(file);
      const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', calidad));
      return blob ?? file;
    } catch {
      return file; // si algo falla, se envía la original
    }
  }

  cerrarEscaneo(): void {
    this.detenerCamara();
    this.mostrarEscaneo = false;
  }

  /** Cambia entre acné y cáncer de piel (solo disponible en el primer paso) */
  seleccionarTipo(tipo: TipoEscaneo): void {
    if (this.tipoEscaneo === tipo) return;
    this.detenerCamara();
    this.camaraError = null;
    this.tipoEscaneo = tipo;
    this.pasoEscaneo = 0;
    // La foto de un tipo no sirve para el otro: se limpia todo
    this.imagenSeleccionada = null;
    this.previewUrl = null;
    this.textoDescripcion = '';
    const input = document.getElementById('inputFotoPiel') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const tiposValidos = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!tiposValidos.includes(file.type)) {
      this.showToast('⚠️ Usa una imagen JPG o PNG');
      return;
    }

    this.imagenSeleccionada = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.zone.run(() => {
        this.previewUrl = reader.result as string;
        this.cd.detectChanges();
      });
    };
    reader.readAsDataURL(file);
  }

  siguientePaso(): void {
    if (this.camaraActiva) {
      this.showToast('📸 Captura la foto o cancela la cámara');
      return;
    }
    if (this.pasoEscaneo === 0 && !this.imagenSeleccionada) {
      this.showToast('⚠️ Sube una foto para continuar');
      return;
    }
    if (this.pasoEscaneo < this.pasosActuales.length - 1) {
      this.pasoEscaneo++;
    } else {
      this.enviarAnalisis();
    }
  }

  async enviarAnalisis(): Promise<void> {
    if (!this.imagenSeleccionada) {
      this.showToast('⚠️ Sube una foto para continuar');
      return;
    }

    this.zone.run(() => {
      this.analizando = true;
      this.errorAnalisis = null;
      this.resultado = null;
      this.cd.detectChanges();
    });

    const formData = new FormData();
    const imagen = await this.reducirImagen(this.imagenSeleccionada);
    formData.append('imagen', imagen, 'foto.jpg');

    if (this.textoDescripcion.trim()) {
      formData.append('texto', this.textoDescripcion.trim());
    }


    const ruta = this.tipoEscaneo === 'cancer' ? '/predecir-cancer' : '/predecir';

    try {
      const resp = await fetch(`${this.API_URL}${ruta}`, {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();

      this.zone.run(() => {
        if (resp.ok) {
          this.resultado = data;
          this.guardarEscaneo(data);
        } else {
          this.errorAnalisis = data?.error || 'No se pudo analizar la imagen.';
        }
        this.analizando = false;
        this.cd.detectChanges();
      });
    } catch (e) {
      this.zone.run(() => {
        this.errorAnalisis = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
        this.analizando = false;
        this.cd.detectChanges();
      });
    }
  }

    private guardarEscaneo(data: any): void {
    try {
      sessionStorage.setItem('dermasistem_ultimo_escaneo', JSON.stringify({
        nivel: data?.prediccion?.nivel ?? null,
        confianza: data?.prediccion?.confianza ?? null,
        tipo_piel: data?.datos_extraidos?.tipo_piel ?? null,
        fecha: new Date().toISOString(),
      }));
    } catch { /* sessionStorage no disponible */ }
  }

  verRecomendaciones(): void {
    this.cerrarEscaneo();
    this.router.navigate(['/recomendaciones']);
  }

  reintentarAnalisis(): void {
    this.errorAnalisis = null;
    this.enviarAnalisis();
  }

  nivelLegible(nivel: string | undefined): string {
    if (!nivel) return '';
    const mapa: Record<string, string> = {
      nivel_0_leve: 'Leve',
      nivel_1_moderado: 'Moderado',
      nivel_2_severo: 'Severo',
      nivel_3_muy_severo: 'Muy severo',
    };
    return mapa[nivel] || nivel;
  }

  nivelClase(nivel: string | undefined): string {
    if (!nivel) return '';
    const mapa: Record<string, string> = {
      nivel_0_leve: 'leve',
      nivel_1_moderado: 'moderado',
      nivel_2_severo: 'severo',
      nivel_3_muy_severo: 'muy-severo',
    };
    return mapa[nivel] || '';
  }

  /** Clase de color para el riesgo de cáncer: bajo | dudoso | alto */
  riesgoClase(nivel: string | undefined): string {
    const mapa: Record<string, string> = {
      riesgo_bajo: 'bajo',
      riesgo_dudoso: 'dudoso',
      riesgo_alto: 'alto',
    };
    return nivel ? (mapa[nivel] || '') : '';
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