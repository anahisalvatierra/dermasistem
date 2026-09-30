"""
Backend — API para el módulo de IA de DermAsystem
====================================================
Une las Fases 4, 5 y 6: recibe una imagen (+ opcionalmente texto del
usuario), predice el nivel de severidad de acné con InceptionV3, extrae
datos del texto con Gemini (NLP) y devuelve recomendaciones de prevención
y cuidado.

Uso:
    pip install flask flask-cors google-genai pydantic python-dotenv
    $env:GEMINI_API_KEY="tu_clave_aqui"     (o crea un archivo .env, ver abajo)
    python app.py

Prueba rápida sin frontend (PowerShell):
    curl.exe -F "imagen=@ruta\a_una_foto.jpg" -F "texto=Tengo granos en la frente hace 3 semanas" http://localhost:5000/predecir

Archivo .env opcional (en la misma carpeta ml/), en vez de $env:
    GEMINI_API_KEY=tu_clave_aqui
"""

import os

from dotenv import load_dotenv
load_dotenv()  # lee .env si existe, antes de importar gemini_client

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from predict import predict_image
from gemini_client import extract_symptoms, get_recommendations

app = Flask(__name__)
CORS(app)  # permite llamadas desde el frontend Angular (localhost:4200, etc.)

ALLOWED_EXT = {"jpg", "jpeg", "png"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


@app.route("/salud", methods=["GET"])
def salud():
    return jsonify({"status": "ok"})


@app.route("/predecir", methods=["POST"])
def predecir():
    if "imagen" not in request.files:
        return jsonify({"error": "Falta el archivo 'imagen' en el form-data"}), 400

    file = request.files["imagen"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Imagen no válida (usa jpg, jpeg o png)"}), 400

    texto_usuario = request.form.get("texto", "").strip()

    try:
        image = Image.open(file.stream)
        prediccion = predict_image(image)
    except Exception as e:
        return jsonify({"error": f"No se pudo procesar la imagen: {e}"}), 400

    datos_nlp = {}
    if texto_usuario:
        try:
            datos_nlp = extract_symptoms(texto_usuario)
        except Exception as e:
            # si falla el NLP, seguimos solo con la predicción de imagen
            datos_nlp = {"error_nlp": str(e)}

    try:
        recomendacion = get_recommendations(prediccion["nivel"], datos_nlp)
    except Exception as e:
        recomendacion = {"error_recomendacion": str(e)}

    return jsonify({
        "prediccion": prediccion,
        "datos_extraidos": datos_nlp,
        "recomendacion": recomendacion,
    })


if __name__ == "__main__":
    if not os.environ.get("GEMINI_API_KEY"):
        print("Aviso: no está definida GEMINI_API_KEY. Las rutas de NLP y recomendación fallarán.")
    app.run(debug=True, port=5000)