"""
Cáncer de piel — InceptionV3 con transfer learning (benigno vs maligno)
=========================================================================
Misma receta que train_inception.py (acné), pero con el dataset de
data_split_cancer/. NO toca el modelo de acné: guarda en
models/cancer_inception.keras y los resultados en results_cancer/.

Requisitos previos:
    python prepare_dataset_cancer.py

Uso (con el venv activo, dentro de ml/):
    python train_inception_cancer.py

Prueba rápida (PowerShell):
    $env:EPOCHS_HEAD=3; $env:EPOCHS_FT=3; python train_inception_cancer.py
"""

import os
import time
from pathlib import Path

import tensorflow as tf

import evaluate_utils
import load_data
from evaluate_utils import evaluate_model

# Apuntar los módulos compartidos al dataset y a los resultados de cáncer
load_data.DATA_DIR = "data_split_cancer"
evaluate_utils.RESULTS_DIR = Path("results_cancer")

EPOCHS_HEAD = int(os.environ.get("EPOCHS_HEAD", 10))
EPOCHS_FT = int(os.environ.get("EPOCHS_FT", 10))
LR_HEAD = 1e-3
LR_FT = 1e-5
FINE_TUNE_FROM = 249
SEED = 42
MODEL_NAME = "cancer_inception"
_w = os.environ.get("WEIGHTS", "imagenet")
WEIGHTS = None if _w.lower() == "none" else _w

tf.keras.utils.set_random_seed(SEED)


def build_model(num_classes: int):
    base = tf.keras.applications.InceptionV3(
        include_top=False, weights=WEIGHTS, input_shape=(224, 224, 3)
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = tf.keras.layers.Rescaling(scale=2.0, offset=-1.0)(inputs)  # [0,1] -> [-1,1]
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs, name=MODEL_NAME), base


def make_callbacks(patience):
    return [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7),
    ]


class _History:
    def __init__(self, *hists):
        keys = ["accuracy", "val_accuracy", "loss", "val_loss"]
        self.history = {k: sum((h.history[k] for h in hists), []) for k in keys}


def main():
    train_ds, val_ds, test_ds, class_names = load_data.get_datasets()
    class_weight = load_data.get_class_weights() or None
    print("Clases:", class_names, "| pesos:", class_weight)

    model, base = build_model(len(class_names))
    Path("models").mkdir(exist_ok=True)
    start = time.time()

    print("\n=== Etapa 1: cabeza de clasificación (InceptionV3 congelada) ===")
    model.compile(optimizer=tf.keras.optimizers.Adam(LR_HEAD),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    h1 = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD,
                   class_weight=class_weight, callbacks=make_callbacks(4))
    best1 = min(h1.history["val_loss"])
    weights1 = model.get_weights()

    print("\n=== Etapa 2: fine-tuning de las últimas capas ===")
    base.trainable = True
    for layer in base.layers[:FINE_TUNE_FROM]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(LR_FT),
                  loss="categorical_crossentropy", metrics=["accuracy"])
    h2 = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FT,
                   class_weight=class_weight, callbacks=make_callbacks(4))
    best2 = min(h2.history["val_loss"])

    if best2 > best1:
        print(f"El fine-tuning no mejoró (val_loss {best2:.4f} > {best1:.4f}): se usa la etapa 1.")
        model.set_weights(weights1)

    elapsed = time.time() - start
    model.save(f"models/{MODEL_NAME}.keras")
    evaluate_model(model, test_ds, class_names, MODEL_NAME, _History(h1, h2), elapsed)


if __name__ == "__main__":
    main()
