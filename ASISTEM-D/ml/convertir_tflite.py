"""
Convierte un modelo Keras (.keras) a TensorFlow Lite (.tflite) y comprueba que da casi lo mismo.

Uso (desde la carpeta ml, con el venv activado):
    python convertir_tflite.py                      -> convierte models/inception_v3.keras (acné)
    python convertir_tflite.py cancer_inception     -> convierte models/cancer_inception.keras (cáncer)
"""
import os
import sys

import numpy as np
import tensorflow as tf

nombre = sys.argv[1] if len(sys.argv) > 1 else "inception_v3"
SRC = os.path.join("models", f"{nombre}.keras")
DST = os.path.join("models", f"{nombre}.tflite")

if not os.path.exists(SRC):
    sys.exit(f"No encuentro {SRC}. Ejecuta el script desde la carpeta ml.")

model = tf.keras.models.load_model(SRC, compile=False)
print(f"Entrada del modelo: {model.input_shape}   Salida: {model.output_shape}")

converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]   # reduce el tamaño a la mitad
tflite_model = converter.convert()

with open(DST, "wb") as f:
    f.write(tflite_model)
print(f"Listo: {DST} ({os.path.getsize(DST) / 1024 / 1024:.1f} MB)")

# --- Verificación: Keras vs TFLite con imágenes aleatorias ---
interp = tf.lite.Interpreter(model_path=DST)
interp.allocate_tensors()
entrada = interp.get_input_details()[0]
salida = interp.get_output_details()[0]

rng = np.random.default_rng(0)
dif_max = 0.0
for _ in range(5):
    x = rng.random(size=(1, *model.input_shape[1:])).astype("float32")
    ref = model(x, training=False).numpy()
    interp.set_tensor(entrada["index"], x.astype(entrada["dtype"]))
    interp.invoke()
    got = interp.get_tensor(salida["index"])
    dif_max = max(dif_max, float(np.abs(ref - got).max()))

print(f"Diferencia máxima Keras vs TFLite: {dif_max:.6f}")
print("OK: la conversión es fiel." if dif_max < 0.02 else "ATENCIÓN: la diferencia es alta, avísame antes de usarlo.")
