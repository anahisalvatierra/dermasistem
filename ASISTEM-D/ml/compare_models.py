"""
Comparación de modelos (MLP vs CNN vs Inception)
=================================================
Lee results/*_metrics.json y muestra una tabla ordenada por F1 macro.
Guarda results/comparacion.png y results/comparacion.csv para la documentación.

Uso:
    python compare_models.py
"""

import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RESULTS_DIR = Path("results")


def main():
    rows = []
    for f in sorted(RESULTS_DIR.glob("*_metrics.json")):
        m = json.loads(f.read_text())
        rows.append({
            "modelo": m["modelo"],
            "accuracy": m["accuracy"],
            "f1_macro": m["f1_macro"],
            "parametros": m["parametros"],
            "minutos": None if m["tiempo_entrenamiento_seg"] is None
                       else round(m["tiempo_entrenamiento_seg"] / 60, 1),
        })
    if not rows:
        print("No hay resultados en results/. Entrena primero algún modelo.")
        return
    rows.sort(key=lambda r: r["f1_macro"], reverse=True)

    print(f"\n{'modelo':<16}{'accuracy':>10}{'F1 macro':>10}{'parámetros':>14}{'minutos':>9}")
    for r in rows:
        print(f"{r['modelo']:<16}{r['accuracy']:>10}{r['f1_macro']:>10}{r['parametros']:>14,}{str(r['minutos']):>9}")
    print(f"\nMejor modelo (por F1 macro): {rows[0]['modelo']}")

    with open(RESULTS_DIR / "comparacion.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    names = [r["modelo"] for r in rows]
    x = range(len(rows))
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar([i - 0.2 for i in x], [r["accuracy"] for r in rows], width=0.4, label="Accuracy")
    ax.bar([i + 0.2 for i in x], [r["f1_macro"] for r in rows], width=0.4, label="F1 macro")
    ax.set_xticks(list(x))
    ax.set_xticklabels(names)
    ax.set_ylim(0, 1)
    ax.set_title("Comparación de modelos en el conjunto de test")
    ax.legend()
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "comparacion.png", dpi=130)
    print(f"Guardado: {RESULTS_DIR / 'comparacion.png'} y comparacion.csv")


if __name__ == "__main__":
    main()