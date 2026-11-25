"""
Cáncer de piel — Preparación del dataset (benigno vs maligno)
==============================================================
Dataset: https://www.kaggle.com/fanconic/skin-cancer-malignant-vs-benign
(descarga con el botón Download y descomprime dentro de ml/data_raw_cancer/)

Estructura esperada (el script la detecta solo, aunque haya carpetas extra):
   data_raw_cancer/
     train/benign/*.jpg
     train/malignant/*.jpg
     test/benign/*.jpg
     test/malignant/*.jpg

Qué hace:
   - Busca las carpetas train/ y test/ dentro de data_raw_cancer/.
   - Descarta imágenes corruptas.
   - Separa 15% de train como validación (estratificado).
   - Deja todo en data_split_cancer/{train,val,test}/{benigno,maligno}/.
   - Guarda data_split_cancer/class_weights.json.

No toca data_split/ (el dataset de acné).

Requisitos: pip install scikit-learn pillow
"""

import json
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

RAW_DIR = Path("data_raw_cancer")
OUTPUT_DIR = Path("data_split_cancer")
VAL_RATIO_OF_TRAIN = 0.15
RANDOM_SEED = 42
IMG_EXTS = {".jpg", ".jpeg", ".png"}
CLASS_NAMES = {"benign": "benigno", "malignant": "maligno"}  # orden alfabético: benigno=0, maligno=1


def has_images(folder: Path) -> bool:
    return any(f.suffix.lower() in IMG_EXTS for f in folder.iterdir() if f.is_file())


def looks_like_split_dir(folder: Path) -> bool:
    subdirs = [d for d in folder.iterdir() if d.is_dir()]
    return len(subdirs) >= 2 and all(has_images(d) for d in subdirs)


def find_split_dir(name: str):
    candidates = [
        p for p in RAW_DIR.rglob("*")
        if p.is_dir() and p.name.lower() == name and looks_like_split_dir(p)
    ]
    candidates.sort(key=lambda p: len(p.parts))
    return candidates[0] if candidates else None


def is_valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as im:
            im.verify()
        return True
    except Exception:
        return False


def collect_items(split_dir: Path):
    items, corrupt = [], 0
    for class_dir in sorted(d for d in split_dir.iterdir() if d.is_dir()):
        for f in class_dir.iterdir():
            if f.is_file() and f.suffix.lower() in IMG_EXTS:
                if is_valid_image(f):
                    items.append((f, class_dir.name.lower()))
                else:
                    corrupt += 1
    if corrupt:
        print(f"Aviso: {corrupt} imágenes corruptas descartadas en {split_dir.name}/")
    return items


def copy_items(items, split_name: str):
    for path, label in items:
        dest = OUTPUT_DIR / split_name / CLASS_NAMES.get(label, label)
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, dest / path.name)


def summarize(items, title: str):
    print(f"{title}: {len(items)} imágenes -> {dict(Counter(l for _, l in items))}")


def show_tree(root: Path, max_depth: int = 2):
    print(f"\nContenido de {root.resolve()}:")
    for p in sorted(root.rglob("*")):
        depth = len(p.relative_to(root).parts)
        if depth <= max_depth and p.is_dir():
            print("  " * depth + p.name + "/")


def main():
    if not RAW_DIR.exists():
        print(f"No existe {RAW_DIR.resolve()}. Créala y descomprime ahí el dataset.")
        return

    train_dir = find_split_dir("train")
    test_dir = find_split_dir("test")
    if train_dir is None:
        print("No encontré una carpeta 'train' con subcarpetas de clase.")
        show_tree(RAW_DIR)
        print("\nPégame esta estructura y ajusto el script.")
        return

    print(f"Train encontrado en: {train_dir}")
    train_items = collect_items(train_dir)

    if test_dir is not None:
        print(f"Test encontrado en: {test_dir}")
        test_items = collect_items(test_dir)
        train_items, val_items = train_test_split(
            train_items, test_size=VAL_RATIO_OF_TRAIN,
            stratify=[l for _, l in train_items], random_state=RANDOM_SEED,
        )
    else:
        print("No hay carpeta 'test': se hará split 70/15/15 desde train.")
        train_items, temp = train_test_split(
            train_items, test_size=0.30,
            stratify=[l for _, l in train_items], random_state=RANDOM_SEED,
        )
        val_items, test_items = train_test_split(
            temp, test_size=0.50, stratify=[l for _, l in temp], random_state=RANDOM_SEED,
        )

    if OUTPUT_DIR.exists():
        print(f"Borrando {OUTPUT_DIR}/ anterior para regenerarla limpia...")
        shutil.rmtree(OUTPUT_DIR)

    print()
    for name, items in [("train", train_items), ("val", val_items), ("test", test_items)]:
        summarize(items, name)
        copy_items(items, name)

    # Pesos por clase (orden alfabético de carpetas: benigno=0, maligno=1)
    counts = Counter(CLASS_NAMES.get(l, l) for _, l in train_items)
    ordered = sorted(counts)
    total, n = sum(counts.values()), len(ordered)
    weights = {str(i): round(total / (n * counts[c]), 4) for i, c in enumerate(ordered)}
    (OUTPUT_DIR / "class_weights.json").write_text(json.dumps(weights, indent=2))
    print("Pesos por clase:", dict(zip(ordered, weights.values())))
    print(f"\nListo. Dataset en: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
