"""
Predicción de severidad de acné con el modelo InceptionV3 entrenado.
======================================================================
Usa el modelo guardado en la Fase 4 (models/inception_v3.keras).
"""

import numpy as np
import tensorflow as tf
from PIL import Image

IMG_SIZE = (224, 224)
MODEL_PATH = "models/inception_v3.keras"
CLASS_NAMES = [
    "nivel_0_leve",
    "nivel_1_moderado",
    "nivel_2_severo",
    "nivel_3_muy_severo",
]

_model = None  # se carga una sola vez y se reutiliza


def get_model():
    global _model
    if _model is None:
        print(f"Cargando modelo desde {MODEL_PATH} ...")
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model


def predict_image(image: Image.Image) -> dict:
    """Recibe una imagen PIL ya abierta y devuelve el nivel de severidad."""
    image = image.convert("RGB").resize(IMG_SIZE)
    arr = np.asarray(image, dtype="float32") / 255.0
    arr = np.expand_dims(arr, axis=0)

    model = get_model()
    probs = model.predict(arr, verbose=0)[0]
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
        result = predict_image(Image.open(sys.argv[1]))
        print(result)