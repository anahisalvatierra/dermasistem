"""
Fase 4 — Transfer learning con InceptionV3 (preentrenada en ImageNet)
======================================================================
Etapa 1: se congela InceptionV3 y solo se entrena la cabeza de clasificación.
Etapa 2 (fine-tuning): se descongelan las últimas capas con una tasa de
aprendizaje muy baja para afinarlas con las imágenes de acné.

La primera vez descarga los pesos de ImageNet (~90 MB): necesita internet.

Uso (con el venv activo, dentro de ml/):
    python train_inception.py

Opcional (menos épocas para una prueba rápida, en PowerShell):
    $env:EPOCHS_HEAD=5; $env:EPOCHS_FT=5; python train_inception.py
"""

import os
import time
from pathlib import Path

import numpy as np
import tensorflow as tf

from evaluate_utils import evaluate_model
from load_data import get_datasets, get_class_weights

EPOCHS_HEAD = int(os.environ.get("EPOCHS_HEAD", 12))
EPOCHS_FT = int(os.environ.get("EPOCHS_FT", 12))
LR_HEAD = 1e-3
LR_FT = 1e-5
FINE_TUNE_FROM = 249  # capas desde este índice se descongelan (recomendado para InceptionV3)
SEED = 42
_w = os.environ.get("WEIGHTS", "imagenet")
WEIGHTS = None if _w.lower() == "none" else _w

tf.keras.utils.set_random_seed(SEED)


def build_model(num_classes: int):
    base = tf.keras.applications.InceptionV3(
        include_top=False, weights=WEIGHTS, input_shape=(224, 224, 3)
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=(224, 224, 3))
    # load_data.py entrega píxeles en [0, 1]; InceptionV3 espera [-1, 1]
    x = tf.keras.layers.Rescaling(scale=2.0, offset=-1.0)(inputs)
    x = base(x, training=False)  # mantiene BatchNorm en modo inferencia
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs, name="inception_v3"), base


def make_callbacks(patience):
    return [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=patience, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7
        ),
    ]


class _History:
    """Une los historiales de las dos etapas para las curvas."""
    def __init__(self, *hists):
        keys = ["accuracy", "val_accuracy", "loss", "val_loss"]
        self.history = {k: sum((h.history[k] for h in hists), []) for k in keys}


def main():
    train_ds, val_ds, test_ds, class_names = get_datasets()
    class_weight = get_class_weights() or None
    model, base = build_model(len(class_names))
    Path("models").mkdir(exist_ok=True)

    start = time.time()

    # ---- Etapa 1: entrenar solo la cabeza ----
    print("\n=== Etapa 1: cabeza de clasificación (InceptionV3 congelada) ===")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(LR_HEAD),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    h1 = model.fit(
        train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD,
        class_weight=class_weight, callbacks=make_callbacks(patience=4),
    )
    best1 = min(h1.history["val_loss"])
    weights1 = model.get_weights()

    # ---- Etapa 2: fine-tuning de las últimas capas ----
    print("\n=== Etapa 2: fine-tuning de las últimas capas ===")
    base.trainable = True
    for layer in base.layers[:FINE_TUNE_FROM]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False
    model.compile(  # hay que recompilar tras cambiar trainable
        optimizer=tf.keras.optimizers.Adam(LR_FT),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    h2 = model.fit(
        train_ds, validation_data=val_ds, epochs=EPOCHS_FT,
        class_weight=class_weight, callbacks=make_callbacks(patience=4),
    )
    best2 = min(h2.history["val_loss"])

    # Si el fine-tuning no mejoró la validación, se conserva la etapa 1
    if best2 > best1:
        print(f"El fine-tuning no mejoró (val_loss {best2:.4f} > {best1:.4f}): se usa la etapa 1.")
        model.set_weights(weights1)

    elapsed = time.time() - start
    model.save("models/inception_v3.keras")
    evaluate_model(model, test_ds, class_names, "inception_v3", _History(h1, h2), elapsed)


if __name__ == "__main__":
    main()