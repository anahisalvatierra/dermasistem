"""
Fase 3 — CNN entrenada desde cero
==================================
Arquitectura propia: 4 bloques convolucionales (Conv + BatchNorm + ReLU +
MaxPooling), pooling global, dropout y capa densa de salida (4 niveles).
Usa los mismos datos y la misma evaluación que el MLP para poder comparar.

Uso (con el venv activo, dentro de ml/, cuando el MLP ya terminó):
    python train_cnn.py
"""

import os
import time
from pathlib import Path

import tensorflow as tf

from evaluate_utils import evaluate_model
from load_data import get_datasets, get_class_weights

EPOCHS = int(os.environ.get("EPOCHS", 50))
LEARNING_RATE = 1e-3
SEED = 42

tf.keras.utils.set_random_seed(SEED)


def conv_block(x, filters, convs=1):
    for _ in range(convs):
        x = tf.keras.layers.Conv2D(filters, 3, padding="same", use_bias=False)(x)
        x = tf.keras.layers.BatchNormalization()(x)
        x = tf.keras.layers.ReLU()(x)
    return tf.keras.layers.MaxPooling2D()(x)


def build_cnn(num_classes: int) -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = conv_block(inputs, 32)
    x = conv_block(x, 64)
    x = conv_block(x, 128, convs=2)
    x = conv_block(x, 256, convs=2)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs, name="cnn_scratch")


def main():
    train_ds, val_ds, test_ds, class_names = get_datasets()
    model = build_cnn(len(class_names))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(LEARNING_RATE),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    Path("models").mkdir(exist_ok=True)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=10, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=4, min_lr=1e-5
        ),
        tf.keras.callbacks.ModelCheckpoint(
            "models/cnn_scratch.keras", monitor="val_loss", save_best_only=True
        ),
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

    evaluate_model(model, test_ds, class_names, "cnn_scratch", history, elapsed)


if __name__ == "__main__":
    main()