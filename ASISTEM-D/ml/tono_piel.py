"""
Estimación del TONO DE PIEL a partir de una foto del rostro (solo se usa en el escáner de acné).

Cómo funciona (sin IA externa, sin gastar cuota de Gemini, tarda milisegundos):
  1. Reduce la imagen y detecta los píxeles de piel (rango de color YCbCr).
     Si casi no encuentra piel, no devuelve ningún tono (categoria = None).
  2. Descarta sombras y reflejos, y toma el valor mediano de los píxeles de piel
     (la mediana evita que los granitos rojos cambien el resultado).
  3. Convierte ese color a CIELAB y calcula el ángulo ITA (Individual Typology Angle),
     una medida usada en dermatología para clasificar el tono de piel:
         ITA = arctan((L* - 50) / b*) en grados
  4. Según el ITA devuelve una categoría y el color promedio en formato hexadecimal.

Es una estimación aproximada: depende de la luz y de la cámara. No es un diagnóstico.
"""

import math

import numpy as np
from PIL import Image

# (límite inferior del ITA, nombre)
_CATEGORIAS = [
    (55, "Muy claro"),
    (41, "Claro"),
    (28, "Medio"),
    (10, "Trigueño"),
    (-30, "Moreno"),
]
_ULTIMA = "Oscuro"

_M_RGB_XYZ = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
])
_BLANCO_D65 = np.array([0.95047, 1.0, 1.08883])


def _rgb_a_lab(rgb):
    """rgb: arreglo (N, 3) con valores 0-255. Devuelve L*, a*, b*."""
    c = rgb / 255.0
    lineal = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = (lineal @ _M_RGB_XYZ.T) / _BLANCO_D65
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[:, 1] - 16
    a = 500 * (f[:, 0] - f[:, 1])
    b = 200 * (f[:, 1] - f[:, 2])
    return L, a, b


def _categoria(ita):
    for limite, nombre in _CATEGORIAS:
        if ita > limite:
            return nombre
    return _ULTIMA


def estimar_tono(image: Image.Image) -> dict:
    """Recibe una imagen PIL y devuelve el tono de piel estimado."""
    img = image.convert("RGB")
    img.thumbnail((160, 160))
    px = np.asarray(img, dtype="float32").reshape(-1, 3)
    R, G, B = px[:, 0], px[:, 1], px[:, 2]

    # Píxeles de piel (YCbCr)
    Y = 0.299 * R + 0.587 * G + 0.114 * B
    Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B
    Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B
    mascara = (Cb >= 77) & (Cb <= 127) & (Cr >= 133) & (Cr <= 173) & (Y >= 35) & (Y <= 245)

    if mascara.mean() < 0.08:
        # Casi no hay píxeles de piel: mejor no inventar un tono
        return {
            "categoria": None,
            "ita": None,
            "color_hex": None,
            "estimacion_confiable": False,
            "nota": "No se pudo detectar piel en la foto para estimar el tono.",
        }

    piel = px[mascara]
    L, a, b = _rgb_a_lab(piel)

    # Quita sombras y reflejos (se queda con el 15%-85% de luminosidad)
    lo, hi = np.percentile(L, [15, 85])
    keep = (L >= lo) & (L <= hi)
    if keep.sum() >= 20:
        piel, L, b = piel[keep], L[keep], b[keep]

    L_med = float(np.median(L))
    b_med = float(np.median(b))
    ita = math.degrees(math.atan2(L_med - 50.0, b_med))

    r, g, bl = (int(round(float(v))) for v in np.median(piel, axis=0))
    return {
        "categoria": _categoria(ita),
        "ita": round(ita, 1),
        "color_hex": f"#{r:02x}{g:02x}{bl:02x}",
        "estimacion_confiable": True,
        "nota": "Estimación aproximada a partir de la foto; puede variar con la iluminación.",
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python tono_piel.py ruta_a_imagen.jpg")
    else:
        print(estimar_tono(Image.open(sys.argv[1])))
