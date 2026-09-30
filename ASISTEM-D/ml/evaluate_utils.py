"""
Utilidades de evaluación compartidas (MLP, CNN, Inception)
===========================================================
Cada modelo llama a evaluate_model(...) al terminar de entrenar. Guarda en
results/: métricas (JSON), matriz de confusión (PNG) y curvas de
entrenamiento (PNG). Después se comparan los JSON para elegir el mejor modelo.

Requisitos: pip install matplotlib scikit-learn
"""

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # guarda imágenes sin abrir ventanas
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, f1_score,
)

RESULTS_DIR = Path("results")


def evaluate_model(model, test_ds, class_names, name, history=None, train_seconds=None):
    RESULTS_DIR.mkdir(exist_ok=True)

    # test_ds se creó con shuffle=False, así el orden de etiquetas coincide
    y_true = np.concatenate([np.argmax(y.numpy(), axis=1) for _, y in test_ds])
    y_prob = model.predict(test_ds, verbose=0)
    y_pred = np.argmax(y_prob, axis=1)

    metrics = {
        "modelo": name,
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro")), 4),
        "f1_ponderado": round(float(f1_score(y_true, y_pred, average="weighted")), 4),
        "parametros": int(model.count_params()),
        "tiempo_entrenamiento_seg": None if train_seconds is None else round(train_seconds, 1),
        "reporte_por_clase": classification_report(
            y_true, y_pred, target_names=class_names, output_dict=True, zero_division=0
        ),
    }
    (RESULTS_DIR / f"{name}_metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False))

    # Matriz de confusión
    cm = confusion_matrix(y_true, y_pred, labels=range(len(class_names)))
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(class_names)))
    ax.set_yticks(range(len(class_names)))
    short = [c.replace("nivel_", "").replace("_", " ") for c in class_names]
    ax.set_xticklabels(short, rotation=30, ha="right")
    ax.set_yticklabels(short)
    ax.set_xlabel("Predicho")
    ax.set_ylabel("Real")
    ax.set_title(f"Matriz de confusión — {name}")
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / f"{name}_confusion.png", dpi=130)
    plt.close(fig)

    # Curvas de entrenamiento
    if history is not None:
        h = history.history
        fig, axes = plt.subplots(1, 2, figsize=(10, 4))
        axes[0].plot(h["accuracy"], label="train")
        axes[0].plot(h["val_accuracy"], label="val")
        axes[0].set_title("Accuracy")
        axes[0].set_xlabel("Época")
        axes[0].legend()
        axes[1].plot(h["loss"], label="train")
        axes[1].plot(h["val_loss"], label="val")
        axes[1].set_title("Loss")
        axes[1].set_xlabel("Época")
        axes[1].legend()
        fig.suptitle(name)
        fig.tight_layout()
        fig.savefig(RESULTS_DIR / f"{name}_curves.png", dpi=130)
        plt.close(fig)

    print(f"\n=== {name} — resultados en test ===")
    print(f"Accuracy: {metrics['accuracy']}   F1 macro: {metrics['f1_macro']}")
    print(classification_report(y_true, y_pred, target_names=class_names, zero_division=0))
    print(f"Archivos guardados en {RESULTS_DIR.resolve()}")
    return metrics