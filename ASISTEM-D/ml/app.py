"""
Backend — API para el módulo de IA de DermAsystem
Recibe una imagen (+ texto opcional), predice severidad con InceptionV3,
extrae datos con Gemini y devuelve recomendaciones.

Rutas:
    GET  /salud            -> estado del servicio
    POST /predecir         -> acné (severidad)
    POST /predecir-cancer  -> cáncer de piel (riesgo)

Mejoras de velocidad:
    - Cronómetros: cada petición imprime en la terminal cuánto tardó cada paso ([TIEMPOS]).
    - Lectura rápida de fotos JPEG grandes (Image.draft) y corrección de orientación EXIF (fotos del celular).
    - La extracción del texto (Gemini) corre EN PARALELO con la predicción de la imagen.
    - Caché en memoria (1 hora) de las respuestas de Gemini de acné: el mismo texto o el mismo
      nivel devuelven la respuesta al instante.
    - La respuesta incluye "tiempos_ms" y /salud indica si el modelo de acné ya cargó.
"""

import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturoTimeout

from dotenv import load_dotenv
load_dotenv()  # lee .env si existe, antes de importar gemini_client

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps

import predict as predict_mod
from predict import predict_image, get_model
from gemini_client import extract_symptoms, get_recommendations

# Estimación del tono de piel (solo para el escáner de acné). Es opcional: si el archivo
# tono_piel.py no está en el servidor, el escáner funciona igual y simplemente no muestra el tono.
try:
    from tono_piel import estimar_tono
except Exception as _e:
    estimar_tono = None
    print(f"Aviso: tono de piel no disponible ({_e}).", flush=True)

# El módulo de cáncer es opcional: si faltan sus archivos o su modelo (por ejemplo en Render,
# donde todavía no está publicado), el servidor igual arranca y el análisis de acné sigue funcionando.
try:
    from predict_cancer import predict_cancer
    from gemini_client import extract_symptoms_cancer, get_recommendations_cancer
    CANCER_DISPONIBLE = True
except Exception as _e:
    predict_cancer = extract_symptoms_cancer = get_recommendations_cancer = None
    CANCER_DISPONIBLE = False
    print(f"Aviso: módulo de cáncer no disponible en este servidor ({_e}).", flush=True)

app = Flask(__name__)
CORS(app)  # permite llamadas desde el frontend Angular

# Precarga el modelo de acné en segundo plano para que la primera petición no espere tanto.
# El modelo de cáncer se carga la primera vez que se usa (así Render no gasta memoria de más al arrancar).
threading.Thread(target=get_model, daemon=True).start()

ALLOWED_EXT = {"jpg", "jpeg", "png"}

AVISO_CANCER = (
    "Esta herramienta es solo orientativa y NO es un diagnóstico médico. "
    "Si tienes una lesión o lunar que te preocupa, consulta a un dermatólogo."
)

# Si Gemini falla, el usuario igual recibe un mensaje de seguridad
RECOMENDACION_CANCER_RESPALDO = {
    "resumen_situacion": "No pudimos generar recomendaciones personalizadas en este momento.",
    "recomendaciones_prevencion": [
        "Usa protector solar de amplio espectro con FPS 30 o más todos los días.",
        "Evita la exposición directa al sol fuerte, sobre todo al mediodía.",
        "Revisa tu piel con regularidad y fíjate en lunares nuevos o que cambien.",
    ],
    "senales_de_alarma": [
        "Un lunar asimétrico o con bordes irregulares",
        "Cambios de color, tamaño o forma",
        "Sangrado, picazón o una herida que no cierra",
    ],
    "cuando_consultar_dermatologo": "Consulta a un dermatólogo para que revise cualquier lesión que te preocupe.",
    "aviso": AVISO_CANCER,
}

AVISO_ACNE = (
    "Esta evaluación es únicamente informativa y de orientación; no reemplaza la consulta, "
    "valoración clínica ni el diagnóstico de un médico especialista."
)

# Si Gemini tarda demasiado o falla, el usuario igual recibe una descripción según su nivel.
RECOMENDACION_ACNE_RESPALDO = {
    "nivel_0_leve": {
        "resumen_situacion": "Tu piel muestra un acné leve, algo muy común que suele responder bien a una rutina básica y constante de cuidado facial.",
        "recomendaciones_prevencion": [
            "Lavate la cara dos veces al día, al despertar y antes de dormir, con un limpiador suave adecuado para tu tipo de piel.",
            "Usá una crema hidratante ligera, en gel o libre de aceites, para hidratar sin tapar los poros.",
            "Aplicá a diario protector solar con FPS 30 o más, de textura fluida o toque seco.",
            "Evitá tocar, pellizcar o reventar los granitos para no inflamarlos ni dejar marcas.",
        ],
        "cuando_consultar_dermatologo": "Conviene consultar a un dermatólogo si las lesiones aumentan, si aparecen nódulos dolorosos o si no ves mejoría tras varias semanas de cuidados constantes.",
        "aviso": AVISO_ACNE,
    },
    "nivel_1_moderado": {
        "resumen_situacion": "Tu piel muestra un acné moderado, con más lesiones y algo de inflamación. Con constancia en el cuidado y una buena orientación profesional suele mejorar.",
        "recomendaciones_prevencion": [
            "Lavate la cara dos veces al día con un limpiador suave y agua tibia, secándote con toques suaves.",
            "Evitá frotar fuerte o usar productos muy agresivos, porque pueden irritar y empeorar la inflamación.",
            "Usá a diario un protector solar no comedogénico, para proteger la piel y evitar manchas.",
            "No revientes los granitos y cambiá con frecuencia la funda de tu almohada.",
        ],
        "cuando_consultar_dermatologo": "Es recomendable consultar a un dermatólogo si no notás mejoría en unas semanas, para evaluar un tratamiento adecuado para tu piel.",
        "aviso": AVISO_ACNE,
    },
    "nivel_2_severo": {
        "resumen_situacion": "Tu piel muestra un acné severo, con lesiones inflamadas que conviene atender con acompañamiento profesional.",
        "recomendaciones_prevencion": [
            "Limpiá tu rostro dos veces al día con un limpiador suave, sin frotar.",
            "Evitá tocar o reventar las lesiones, ya que esto aumenta la inflamación y puede dejar cicatrices.",
            "Usá protector solar todos los días, de textura ligera y no comedogénica.",
            "Evitá cosméticos pesados o grasosos que puedan tapar los poros.",
        ],
        "cuando_consultar_dermatologo": "Te recomendamos consultar a un dermatólogo pronto, para recibir un tratamiento indicado según tu caso y reducir el riesgo de cicatrices.",
        "aviso": AVISO_ACNE,
    },
    "nivel_3_muy_severo": {
        "resumen_situacion": "Tu piel muestra un acné muy severo, con lesiones profundas que requieren atención profesional. Con el tratamiento adecuado se puede mejorar.",
        "recomendaciones_prevencion": [
            "Lavate el rostro con un limpiador suave y agua tibia, sin frotar, y secá con toques suaves.",
            "No toques, aprietes ni revientes las lesiones, para evitar infecciones y cicatrices.",
            "Usá a diario un protector solar ligero y no comedogénico.",
            "Evitá probar tratamientos por tu cuenta o productos agresivos que puedan irritar la piel.",
        ],
        "cuando_consultar_dermatologo": "Es prioritario que acudás a un dermatólogo lo antes posible, para recibir un tratamiento adecuado y prevenir cicatrices.",
        "aviso": AVISO_ACNE,
    },
}

# Tiempo máximo (segundos) que se espera a Gemini en cada llamada. Se puede cambiar con la variable GEMINI_TIMEOUT.
GEMINI_TIMEOUT = float(os.environ.get("GEMINI_TIMEOUT", 20))
_gemini_pool = ThreadPoolExecutor(max_workers=4)


def _con_limite(funcion, *args):
    """Ejecuta una llamada a Gemini y, si pasa de GEMINI_TIMEOUT segundos, lanza un error en vez de esperar."""
    futuro = _gemini_pool.submit(funcion, *args)
    return futuro.result(timeout=GEMINI_TIMEOUT)


def _respaldo_acne(nivel):
    return RECOMENDACION_ACNE_RESPALDO.get(nivel) or RECOMENDACION_ACNE_RESPALDO["nivel_0_leve"]


# Caché en memoria de las respuestas de Gemini para acné (clave -> (momento, valor)).
_CACHE = {}
_CACHE_TTL = 3600   # segundos
_CACHE_MAX = 200
_cache_lock = threading.Lock()


def _cache_get(clave):
    with _cache_lock:
        item = _CACHE.get(clave)
        if item and time.time() - item[0] < _CACHE_TTL:
            return item[1]
        _CACHE.pop(clave, None)
    return None


def _cache_set(clave, valor):
    with _cache_lock:
        if len(_CACHE) >= _CACHE_MAX:
            _CACHE.pop(next(iter(_CACHE)))   # descarta la entrada más antigua
        _CACHE[clave] = (time.time(), valor)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


def _abrir_imagen(file) -> Image.Image:
    """Abre la imagen, la decodifica a menor resolución si es un JPEG grande (más rápido) y
    la endereza según la orientación EXIF (las fotos tomadas con el celular suelen venir giradas)."""
    image = Image.open(file.stream)
    image.draft("RGB", (448, 448))  # no hace nada con PNG
    return ImageOps.exif_transpose(image)


def _extraer_nlp(texto):
    """Corre en un hilo aparte. Devuelve (datos, segundos). Usa la caché si el texto ya se analizó."""
    t0 = time.perf_counter()
    clave = ("nlp", texto)
    datos = _cache_get(clave)
    if datos is None:
        try:
            datos = extract_symptoms(texto)
            _cache_set(clave, datos)                  # solo se guardan respuestas buenas
        except Exception as e:
            datos = {"error_nlp": str(e)}
    return datos, time.perf_counter() - t0


def _recomendacion_acne(nivel, datos_nlp):
    """Devuelve (recomendación, vino_de_cache). Solo se guardan respuestas buenas."""
    clave = ("reco", nivel, json.dumps(datos_nlp, sort_keys=True, ensure_ascii=False))
    reco = _cache_get(clave)
    if reco is not None:
        return reco, True
    reco = _con_limite(get_recommendations, nivel, datos_nlp)
    _cache_set(clave, reco)
    return reco, False


def _tono_piel(image):
    """Devuelve el tono de piel estimado, o None si no se pudo calcular (nunca rompe el escaneo)."""
    if estimar_tono is None:
        return None
    try:
        return estimar_tono(image)
    except Exception as e:
        print(f"Aviso: no se pudo estimar el tono de piel ({type(e).__name__}): {e}", flush=True)
        return None


@app.route("/salud", methods=["GET"])
def salud():
    return jsonify({
        "status": "ok",
        "modelo_acne_listo": predict_mod._interpreter is not None,
        "cancer_disponible": CANCER_DISPONIBLE,
        "tono_piel_disponible": estimar_tono is not None,
    })


@app.route("/predecir", methods=["POST"])
def predecir():
    if "imagen" not in request.files:
        return jsonify({"error": "Falta el archivo 'imagen' en el form-data"}), 400

    file = request.files["imagen"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Imagen no válida (usa jpg, jpeg o png)"}), 400

    texto_usuario = request.form.get("texto", "").strip()

    # El NLP (Gemini) no depende de la imagen: arranca ya, mientras se predice
    pool = ThreadPoolExecutor(max_workers=1)
    futuro_nlp = pool.submit(_extraer_nlp, texto_usuario) if texto_usuario else None

    t0 = time.perf_counter()
    try:
        image = _abrir_imagen(file)
        prediccion = predict_image(image)
    except Exception as e:
        pool.shutdown(wait=False)
        return jsonify({"error": f"No se pudo procesar la imagen: {e}"}), 400
    tono_piel = _tono_piel(image)   # solo acné
    t1 = time.perf_counter()

    datos_nlp, t_nlp = {}, 0.0
    if futuro_nlp is not None:
        try:
            datos_nlp, t_nlp = futuro_nlp.result(timeout=GEMINI_TIMEOUT)
        except FuturoTimeout:
            print("Aviso: Gemini tardó demasiado en leer el texto; se sigue sin esos datos.", flush=True)
            datos_nlp, t_nlp = {}, GEMINI_TIMEOUT
    pool.shutdown(wait=False)
    t2 = time.perf_counter()

    desde_cache = False
    usa_respaldo = False
    try:
        recomendacion, desde_cache = _recomendacion_acne(prediccion["nivel"], datos_nlp)
    except Exception as e:
        print(f"Error en recomendaciones de acné ({type(e).__name__}): {e}", flush=True)
        recomendacion = _respaldo_acne(prediccion["nivel"])
        usa_respaldo = True
    t3 = time.perf_counter()

    tiempos = {
        "imagen": int((t1 - t0) * 1000),
        "nlp": int(t_nlp * 1000),
        "espera_nlp_extra": int((t2 - t1) * 1000),
        "recomendacion": int((t3 - t2) * 1000),
        "total": int((t3 - t0) * 1000),
    }
    print(
        f"[TIEMPOS acne] imagen={t1-t0:.2f}s  nlp={t_nlp:.2f}s (en paralelo, esperó {t2-t1:.2f}s)  "
        f"reco={t3-t2:.2f}s{' (cache)' if desde_cache else ''}  total={t3-t0:.2f}s",
        flush=True,
    )

    return jsonify({
        "prediccion": prediccion,
        "datos_extraidos": datos_nlp,
        "recomendacion": recomendacion,
        "tiempos_ms": tiempos,
        "desde_cache": desde_cache,
        "recomendacion_de_respaldo": usa_respaldo,
        "tono_piel": tono_piel,
    })


@app.route("/predecir-cancer", methods=["POST"])
def predecir_cancer():
    if not CANCER_DISPONIBLE:
        return jsonify({"error": "El análisis de cáncer de piel no está disponible en este servidor."}), 503

    if "imagen" not in request.files:
        return jsonify({"error": "Falta el archivo 'imagen' en el form-data"}), 400

    file = request.files["imagen"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Imagen no válida (usa jpg, jpeg o png)"}), 400

    texto_usuario = request.form.get("texto", "").strip()

    t0 = time.perf_counter()
    try:
        image = _abrir_imagen(file)
        prediccion = predict_cancer(image)
    except Exception as e:
        return jsonify({"error": f"No se pudo procesar la imagen: {e}"}), 400
    t1 = time.perf_counter()

    datos_nlp = {}
    if texto_usuario:
        try:
            datos_nlp = _con_limite(extract_symptoms_cancer, texto_usuario)
        except Exception as e:
            datos_nlp = {"error_nlp": str(e)}
    t2 = time.perf_counter()

    try:
        recomendacion = _con_limite(
            get_recommendations_cancer,
            prediccion["nivel"], prediccion["probabilidad_maligno"], datos_nlp,
        )
    except Exception as e:
        print(f"Error en recomendaciones de cáncer ({type(e).__name__}): {e}", flush=True)
        recomendacion = RECOMENDACION_CANCER_RESPALDO
    t3 = time.perf_counter()

    print(
        f"[TIEMPOS cancer] imagen={t1-t0:.2f}s  nlp={t2-t1:.2f}s  "
        f"reco={t3-t2:.2f}s  total={t3-t0:.2f}s",
        flush=True,
    )

    return jsonify({
        "tipo": "cancer",
        "prediccion": prediccion,
        "datos_extraidos": datos_nlp,
        "recomendacion": recomendacion,
        "aviso_legal": AVISO_CANCER,
    })


if __name__ == "__main__":
    if not os.environ.get("GEMINI_API_KEY"):
        print("Aviso: no está definida GEMINI_API_KEY. Las rutas de NLP y recomendación fallarán.")
    app.run(debug=True, port=5000)
