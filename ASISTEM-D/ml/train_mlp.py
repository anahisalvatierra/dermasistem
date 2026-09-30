"""
Fase 2 — MLP baseline (perceptrón multicapa)
=============================================
Punto de comparación para la CNN (Fase 3) y Inception (Fase 4).
Las imágenes se reducen a 64x64 y se aplanan; el MLP no "ve" la estructura
espacial, por eso se espera que rinda peor que las CNN.

Uso (con el venv activo, dentro de ml/):
    pip install matplotlib
    python train_mlp.py
"""

import os
import time
from pathlib import Path

import tensorflow as tf

from evaluate_utils import evaluate_model
from load_data import get_datasets, get_class_weights

EPOCHS = int(os.environ.get("EPOCHS", 40))
LEARNING_RATE = 1e-3
MLP_IMG_SIZE = 64
SEED = 42

tf.keras.utils.set_random_seed(SEED)


def build_mlp(num_classes: int) -> tf.keras.Model:
    return tf.keras.Sequential([
        tf.keras.layers.Input(shape=(224, 224, 3)),
        tf.keras.layers.Resizing(MLP_IMG_SIZE, MLP_IMG_SIZE),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(512, activation="relu"),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.Dense(num_classes, activation="softmax"),
    ], name="mlp")


def main():
    train_ds, val_ds, test_ds, class_names = get_datasets()
    model = build_mlp(len(class_names))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(LEARNING_RATE),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    Path("models").mkdir(exist_ok=True)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=8, restore_best_weights=True
        ),
        tf.keras.callbacks.ModelCheckpoint("models/mlp.keras", monitor="val_loss", save_best_only=True),
    ]

    start = time.time()
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        class_weight=get_class_weights() or None,
        callbacks=callbacks,
    )
    elapsed = time.time() - start

    evaluate_model(model, test_ds, class_names, "mlp", history, elapsed)


if __name__ == "__main__":
    main()