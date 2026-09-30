import requests

FOTO = r"data_split\test\nivel_1_moderado"  # carpeta con imágenes reales del dataset
import os
foto = next(os.path.join(FOTO, f) for f in os.listdir(FOTO) if f.endswith(".jpg"))
print("Usando imagen:", foto)

with open(foto, "rb") as f:
    resp = requests.post(
        "http://localhost:5000/predecir",
        files={"imagen": f},
        data={"texto": "Tengo granos en la frente hace 3 semanas, piel grasa"},
    )

print("status:", resp.status_code)
print(resp.json())