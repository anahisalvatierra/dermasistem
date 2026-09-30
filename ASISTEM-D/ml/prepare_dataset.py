"""
Fase 1 — Preparación del dataset de ACNÉ (ACNE04 / Classification)
==================================================================
Estructura de entrada (la que tienes):
   data_raw/Classification/JPEGImages/levle0_0.jpg, levle1_5.jpg, ...
   (el número después de "levle" es el nivel de severidad: 0 a 3)
   Los .txt (NNEW_test_*.txt, NNEW_trainval_*.txt) se ignoran.

Niveles:
   0 = leve, 1 = moderado, 2 = severo, 3 = muy severo

Qué hace:
   - Lee el nivel desde el nombre de cada archivo.
   - Descarta imágenes corruptas y reduce las muy grandes (lado mayor = 512 px).
   - Split estratificado 70/15/15 (train / val / test).
   - Deja todo en data_split/{train,val,test}/{clase}/ para load_data.py.
   - Guarda data_split/class_weights.json (el dataset está desbalanceado).

Requisitos:
   pip install scikit-learn pillow
"""

import json
import re
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------------------------
# CONFIGURACIÓN
# ---------------------------------------------------------------------------
RAW_DIR = Path("data_raw")
OUTPUT_DIR = Path("data_split")
TRAIN_RATIO, VAL_RATIO, TEST_RATIO = 0.70, 0.15, 0.15
RANDOM_SEED = 42
MAX_SIDE = 512  # las imágenes más grandes se reducen a este lado mayor

CLASS_NAMES = {
    0: "nivel_0_leve",
    1: "nivel_1_moderado",
    2: "nivel_2_severo",
    3: "nivel_3_muy_severo",
}

# "levle0_12.jpg" -> nivel 0   (también acepta "level0_12.jpg")
LEVEL_RE = re.compile(r"^lev[a-z]*(\d)_", re.IGNORECASE)


def collect_items():
    items, skipped = [], 0
    for f in RAW_DIR.rglob("*"):
        if not f.is_file() or f.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        m = LEVEL_RE.match(f.name)
        if not m or int(m.group(1)) not in CLASS_NAMES:
            skipped += 1
            continue
        items.append((f, int(m.group(1))))
    if skipped:
        print(f"Aviso: {skipped} imágenes ignoradas (nombre sin nivel reconocible).")
    return items


def save_resized(src: Path, dest: Path) -> bool:
    """Copia la imagen reduciéndola si es muy grande. False si está corrupta."""
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "JPEG", quality=95)
        return True
    except Exception:
        return False


def main():
    if not RAW_DIR.exists():
        print(f"No existe {RAW_DIR.resolve()}.")
        return

    items = collect_items()
    if not items:
        print("No encontré imágenes con nombre tipo 'levle0_0.jpg' dentro de data_raw/.")
        return
    print(f"Imágenes encontradas: {len(items)}")
    print("Por nivel:", dict(sorted(Counter(l for _, l in items).items())))

    labels = [l for _, l in items]
    train_items, temp = train_test_split(
        items, test_size=(VAL_RATIO + TEST_RATIO), stratify=labels, random_state=RANDOM_SEED
    )
    val_items, test_items = train_test_split(
        temp,
        test_size=TEST_RATIO / (VAL_RATIO + TEST_RATIO),
        stratify=[l for _, l in temp],
        random_state=RANDOM_SEED,
    )

    if OUTPUT_DIR.exists():
        print(f"Borrando {OUTPUT_DIR}/ anterior para regenerarla limpia...")
        shutil.rmtree(OUTPUT_DIR)

    corrupt = 0
    for name, split in [("train", train_items), ("val", val_items), ("test", test_items)]:
        for src, level in split:
            dest = OUTPUT_DIR / name / CLASS_NAMES[level] / (src.stem + ".jpg")
            if not save_resized(src, dest):
                corrupt += 1
        print(f"{name}: {len(split)} imágenes -> {dict(sorted(Counter(l for _, l in split).items()))}")
    if corrupt:
        print(f"Aviso: {corrupt} imágenes corruptas descartadas.")

    # Pesos por clase (orden alfabético de carpetas = orden de los niveles 0..3)
    counts = Counter(l for _, l in train_items)
    total, n_classes = sum(counts.values()), len(CLASS_NAMES)
    weights = {str(i): round(total / (n_classes * counts[i]), 4) for i in sorted(CLASS_NAMES)}
    (OUTPUT_DIR / "class_weights.json").write_text(json.dumps(weights, indent=2))
    print("Pesos por clase (para el entrenamiento):", weights)

    print(f"\nListo. Dataset en: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()