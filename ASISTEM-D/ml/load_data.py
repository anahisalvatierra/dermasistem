"""
Carga de datos + augmentación (usar después de prepare_dataset.py)
====================================================================
Da los datasets de train/val/test listos para pasar directo al MLP,
CNN o al modelo con InceptionV3 (Fases 2, 3 y 4).

Uso:
    from load_data import get_datasets
    train_ds, val_ds, test_ds, class_names = get_datasets()
"""

import json
from pathlib import Path

import tensorflow as tf

DATA_DIR = "data_split"
IMG_SIZE = (224, 224)   # tamaño estándar, compatible con InceptionV3
BATCH_SIZE = 32
SEED = 42


def get_datasets(img_size=IMG_SIZE, batch_size=BATCH_SIZE):
    train_ds = tf.keras.utils.image_dataset_from_directory(
        f"{DATA_DIR}/train",
        image_size=img_size,
        batch_size=batch_size,
        seed=SEED,
        label_mode="categorical",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        f"{DATA_DIR}/val",
        image_size=img_size,
        batch_size=batch_size,
        seed=SEED,
        label_mode="categorical",
    )
    test_ds = tf.keras.utils.image_dataset_from_directory(
        f"{DATA_DIR}/test",
        image_size=img_size,
        batch_size=batch_size,
        seed=SEED,
        label_mode="categorical",
        shuffle=False,
    )

    class_names = train_ds.class_names
    print("Clases detectadas:", class_names)

    # --- Augmentación (solo se aplica al set de entrenamiento) ---
    augmentation = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.2),
        tf.keras.layers.RandomZoom(0.1),
        tf.keras.layers.RandomContrast(0.1),
    ])

    normalization = tf.keras.layers.Rescaling(1.0 / 255)

    def prep_train(x, y):
        x = augmentation(x, training=True)
        x = normalization(x)
        return x, y

    def prep_eval(x, y):
        x = normalization(x)
        return x, y

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.map(prep_train, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)
    val_ds = val_ds.map(prep_eval, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)
    test_ds = test_ds.map(prep_eval, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names


def get_class_weights():
    """Pesos por clase para model.fit(class_weight=...). Vacío si no existe el archivo."""
    path = Path(DATA_DIR) / "class_weights.json"
    if not path.exists():
        return {}
    return {int(k): v for k, v in json.loads(path.read_text()).items()}


if __name__ == "__main__":
    train_ds, val_ds, test_ds, class_names = get_datasets()
    print("Pesos por clase:", get_class_weights())
    print(f"\nBatches -> train: {len(train_ds)}, val: {len(val_ds)}, test: {len(test_ds)}")