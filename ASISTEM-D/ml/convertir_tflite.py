"""
Convierte models/inception_v3.keras -> models/inception_v3.tflite
Uso (desde la carpeta ml, con tu entorno donde tienes TensorFlow):
    python convertir_tflite.py
"""
import os
import tensorflow as tf

SRC = os.path.join("models", "inception_v3.keras")
DST = os.path.join("models", "inception_v3.tflite")

model = tf.keras.models.load_model(SRC, compile=False)
converter = tf.lite.TFLiteConverter.from_keras_model(model)
# float16: reduce el tamaño a ~la mitad casi sin perder precisión
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]
tflite_model = converter.convert()

with open(DST, "wb") as f:
    f.write(tflite_model)

print(f"Listo: {DST} ({os.path.getsize(DST) / 1024 / 1024:.1f} MB)")