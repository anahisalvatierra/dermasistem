"""
Predicción de riesgo de cáncer de piel (benigno vs maligno) con InceptionV3 en TFLite.
Usa models/cancer_inception.tflite (entrenado en Colab).

Preprocesado igual que en el entrenamiento: RGB, 224x224, valores en [0, 1]
(el reescalado a [-1, 1] ya va dentro del modelo).
Clases: indice 0 = benigno, indice 1 = maligno.

Niveles según la probabilidad de maligno (p):
    p >= UMBRAL_ALTO    -> riesgo_alto
    p >= UMBRAL_DUDOSO  -> riesgo_dudoso
    p <  UMBRAL_DUDOSO  -> riesgo_bajo
Los umbrales se pueden cambiar con variables de entorno, sin tocar el código:
    CANCER_UMBRAL_DUDOSO (por defecto 0.30)
    CANCER_UMBRAL_ALTO   (por defecto 0.50)
"""

import os
import threading

import numpy as np
from PIL import Image, ImageOps
from ai_edge_litert.interpreter import Interpreter

IMG_SIZE = (224, 224)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "cancer_inception.tflite")
CLASS_NAMES = ["benigno", "maligno"]

UMBRAL_DUDOSO = float(os.environ.get("CANCER_UMBRAL_DUDOSO", 0.30))
UMBRAL_ALTO = float(os.environ.get("CANCER_UMBRAL_ALTO", 0.50))

ETIQUETAS = {
    "riesgo_bajo": "Riesgo bajo",
    "riesgo_dudoso": "Dudoso",
    "riesgo_alto": "Riesgo alto",
}

_interpreter = None
_lock = threading.Lock()        # para cargar el modelo una sola vez
_infer_lock = threading.Lock()  # el intérprete no es thread-safe


def get_model_cancer():
    global _interpreter
    if _interpreter is None:
        with _lock:
            if _interpreter is None:
                print(f"Cargando modelo de cáncer desde {MODEL_PATH} ...", flush=True)
                interp = Interpreter(model_path=MODEL_PATH, num_threads=2)
                interp.allocate_tensors()
                _interpreter = interp
                print("Modelo de cáncer listo.", flush=True)
    return _interpreter


def clasificar_nivel(p_maligno: float) -> str:
    if p_maligno >= UMBRAL_ALTO:
        return "riesgo_alto"
    if p_maligno >= UMBRAL_DUDOSO:
        return "riesgo_dudoso"
    return "riesgo_bajo"


def predict_cancer(image: Image.Image) -> dict:
    """Recibe una imagen PIL y devuelve el nivel de riesgo y las probabilidades."""
    image = ImageOps.exif_transpose(image)  # fotos de celular que vienen rotadas
    image = image.convert("RGB").resize(IMG_SIZE, Image.BILINEAR)
    arr = np.asarray(image, dtype="float32") / 255.0
    arr = np.expand_dims(arr, axis=0)

    interp = get_model_cancer()
    with _infer_lock:
        inp = interp.get_input_details()[0]
        out = interp.get_output_details()[0]
        interp.set_tensor(inp["index"], arr.astype(inp["dtype"]))
        interp.invoke()
        probs = interp.get_tensor(out["index"])[0]

    p_maligno = float(probs[1])
    nivel = clasificar_nivel(p_maligno)
    return {
        "nivel": nivel,
        "etiqueta": ETIQUETAS[nivel],
        "probabilidad_maligno": round(p_maligno, 4),
        "probabilidades": {CLASS_NAMES[i]: round(float(p), 4) for i, p in enumerate(probs)},
        "umbrales": {"dudoso": UMBRAL_DUDOSO, "alto": UMBRAL_ALTO},
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python predict_cancer.py ruta_a_imagen.jpg")
    else:
        print(predict_cancer(Image.open(sys.argv[1])))
