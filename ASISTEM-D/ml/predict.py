"""
Predicción de severidad de acné con InceptionV3 convertido a TFLite.
Usa models/inception_v3.tflite (mucho más liviano que TensorFlow completo).
"""

import os
import threading

import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter

IMG_SIZE = (224, 224)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "inception_v3.tflite")
CLASS_NAMES = [
    "nivel_0_leve",
    "nivel_1_moderado",
    "nivel_2_severo",
    "nivel_3_muy_severo",
]

_interpreter = None
_lock = threading.Lock()       # para cargar el modelo una sola vez
_infer_lock = threading.Lock() # el intérprete no es thread-safe


def get_model():
    global _interpreter
    if _interpreter is None:
        with _lock:
            if _interpreter is None:
                print(f"Cargando modelo desde {MODEL_PATH} ...", flush=True)
                interp = Interpreter(model_path=MODEL_PATH, num_threads=2)
                interp.allocate_tensors()
                _interpreter = interp
                print("Modelo listo.", flush=True)
    return _interpreter


def predict_image(image: Image.Image) -> dict:
    """Recibe una imagen PIL ya abierta y devuelve el nivel de severidad."""
    image = image.convert("RGB").resize(IMG_SIZE)
    arr = np.asarray(image, dtype="float32") / 255.0
    arr = np.expand_dims(arr, axis=0)

    interp = get_model()
    with _infer_lock:
        inp = interp.get_input_details()[0]
        out = interp.get_output_details()[0]
        interp.set_tensor(inp["index"], arr.astype(inp["dtype"]))
        interp.invoke()
        probs = interp.get_tensor(out["index"])[0]

    idx = int(np.argmax(probs))
    return {
        "nivel": CLASS_NAMES[idx],
        "nivel_indice": idx,
        "confianza": round(float(probs[idx]), 4),
        "probabilidades": {
            CLASS_NAMES[i]: round(float(p), 4) for i, p in enumerate(probs)
        },
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python predict.py ruta_a_imagen.jpg")
    else:
        print(predict_image(Image.open(sys.argv[1])))