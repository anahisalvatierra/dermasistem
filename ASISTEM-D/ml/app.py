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
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
load_dotenv()  # lee .env si existe, antes de importar gemini_client

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps

import predict as predict_mod
from predict import predict_image, get_model
from predict_cancer import predict_cancer
from gemini_client import (
    extract_symptoms,
    get_recommendations,
    extract_symptoms_cancer,
    get_recommendations_cancer,
)

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
    reco = get_recommendations(nivel, datos_nlp)
    _cache_set(clave, reco)
    return reco, False


@app.route("/salud", methods=["GET"])
def salud():
    return jsonify({
        "status": "ok",
        "modelo_acne_listo": predict_mod._interpreter is not None,
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
    t1 = time.perf_counter()

    datos_nlp, t_nlp = {}, 0.0
    if futuro_nlp is not None:
        datos_nlp, t_nlp = futuro_nlp.result()
    pool.shutdown(wait=False)
    t2 = time.perf_counter()

    desde_cache = False
    try:
        recomendacion, desde_cache = _recomendacion_acne(prediccion["nivel"], datos_nlp)
    except Exception as e:
        recomendacion = {"error_recomendacion": str(e)}
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
    })


@app.route("/predecir-cancer", methods=["POST"])
def predecir_cancer():
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
            datos_nlp = extract_symptoms_cancer(texto_usuario)
        except Exception as e:
            datos_nlp = {"error_nlp": str(e)}
    t2 = time.perf_counter()

    try:
        recomendacion = get_recommendations_cancer(
            prediccion["nivel"], prediccion["probabilidad_maligno"], datos_nlp
        )
    except Exception as e:
        print(f"Error en recomendaciones de cáncer: {e}", flush=True)
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
