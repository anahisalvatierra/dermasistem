"""
Backend — API para el módulo de IA de DermAsystem
Recibe una imagen (+ texto opcional), predice severidad con InceptionV3,
extrae datos con Gemini y devuelve recomendaciones.
"""

import os
import threading

from dotenv import load_dotenv
load_dotenv()  # lee .env si existe, antes de importar gemini_client

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from predict import predict_image, get_model
from gemini_client import extract_symptoms, get_recommendations

app = Flask(__name__)
CORS(app)  # permite llamadas desde el frontend Angular

# Precarga el modelo en segundo plano para que la primera petición no espere tanto
threading.Thread(target=get_model, daemon=True).start()

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