"""
Prueba rápida de la ruta /predecir-cancer (sin curl).

Uso (con la app corriendo en otra terminal y el venv activo, dentro de ml/):
    python test_cancer_api.py
    python test_cancer_api.py "data_split_cancer\\test\\benigno\\1003.jpg" "tengo un lunar que no ha cambiado"
"""

import json
import sys

import requests

URL = "http://localhost:5000/predecir-cancer"

imagen = sys.argv[1] if len(sys.argv) > 1 else r"data_split_cancer\test\maligno\1.jpg"
texto = sys.argv[2] if len(sys.argv) > 2 else "tengo un lunar en la espalda que me pica"

with open(imagen, "rb") as f:
    respuesta = requests.post(
        URL,
        files={"imagen": (imagen.split("\\")[-1], f, "image/jpeg")},
        data={"texto": texto},
        timeout=120,
    )

print("Código HTTP:", respuesta.status_code)
try:
    print(json.dumps(respuesta.json(), indent=2, ensure_ascii=False))
except Exception:
    print(respuesta.text)
