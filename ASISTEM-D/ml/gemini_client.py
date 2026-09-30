"""
Fase 5 (NLP) y Fase 6 (recomendaciones) — integración con la API de Gemini.
============================================================================
Requiere la variable de entorno GEMINI_API_KEY.
Crea tu clave gratis en: https://aistudio.google.com/apikey

En PowerShell, antes de correr la app (o en un archivo .env, ver app.py):
    $env:GEMINI_API_KEY="tu_clave_aqui"

Requisitos:
    pip install google-genai pydantic
"""

import json
import time
from typing import List, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

MODEL_NAME = "gemini-3.8-flash"

_client = None


def _generate_with_retry(client, model, contents, config, max_retries=4):
    """Reintenta con espera creciente si el modelo está saturado (503) o
    hay un límite de uso temporal (429)."""
    last_error = None
    for attempt in range(max_retries):
        try:
            return client.models.generate_content(model=model, contents=contents, config=config)
        except Exception as e:
            last_error = e
            msg = str(e)
            if "503" in msg or "UNAVAILABLE" in msg or "429" in msg:
                wait = 2 ** attempt  # 1, 2, 4, 8 segundos
                print(f"Gemini ocupado, reintentando en {wait}s (intento {attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue
            raise  # otro tipo de error: no tiene sentido reintentar igual
    raise last_error


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()  # lee GEMINI_API_KEY del entorno
    return _client


# ---------------------------------------------------------------------------
# Fase 5 — NLP: extraer datos estructurados de lo que escribe el usuario
# ---------------------------------------------------------------------------
class SintomasAcne(BaseModel):
    zona_afectada: Optional[str] = Field(
        None, description="Zona del rostro/cuerpo afectada, ej. frente, mejillas, espalda"
    )
    duracion: Optional[str] = Field(None, description="Cuánto tiempo lleva con el problema")
    tipo_piel: Optional[str] = Field(
        None, description="Tipo de piel mencionado: grasa, seca, mixta, sensible, etc."
    )
    habitos_productos: List[str] = Field(
        default_factory=list,
        description="Hábitos o productos que menciona (maquillaje, protector solar, dieta, estrés, etc.)",
    )
    dolor_o_inflamacion: Optional[bool] = Field(
        None, description="True si menciona dolor, inflamación o picazón"
    )
    resumen: str = Field(description="Resumen breve del caso en una oración")


def extract_symptoms(texto_usuario: str) -> dict:
    """Extrae información estructurada del texto libre que escribe el usuario."""
    client = get_client()
    prompt = (
        "Extrae la información relevante del siguiente relato de un usuario sobre su piel. "
        "Si un dato no se menciona, déjalo vacío o null. No inventes información que no esté "
        f"en el texto.\n\nTexto del usuario:\n{texto_usuario}"
    )
    response = _generate_with_retry(
        client, MODEL_NAME, prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SintomasAcne,
        ),
    )
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Fase 6 — Recomendaciones de prevención y cuidado según el resultado
# ---------------------------------------------------------------------------
class Recomendacion(BaseModel):
    resumen_situacion: str = Field(description="Resumen breve y empático de la situación (1-2 oraciones)")
    recomendaciones_prevencion: List[str] = Field(
        description="3 a 5 recomendaciones concretas de prevención y cuidado diario"
    )
    cuando_consultar_dermatologo: str = Field(
        description="En qué casos conviene acudir a un dermatólogo, según el nivel"
    )
    aviso: str = Field(description="Aviso de que esto no reemplaza un diagnóstico médico profesional")


def get_recommendations(nivel_severidad: str, datos_nlp: dict) -> dict:
    """Combina la predicción del modelo (Fase 4) + los datos extraídos del texto
    (Fase 5) y pide a Gemini recomendaciones de prevención y cuidado."""
    client = get_client()
    prompt = (
        "Un modelo de visión por computadora clasificó una imagen de piel con acné "
        f"en el nivel de severidad: {nivel_severidad}.\n\n"
        f"Datos adicionales que reportó el usuario:\n{json.dumps(datos_nlp, ensure_ascii=False, indent=2)}\n\n"
        "Genera recomendaciones de prevención y cuidado de la piel apropiadas para este "
        "nivel de severidad, en tono cercano y claro, en español boliviano. No receta "
        "medicamentos ni tratamientos que requieran receta médica. Incluye siempre cuándo "
        "conviene ver a un dermatólogo, y un aviso de que esto no es un diagnóstico médico."
    )
    response = _generate_with_retry(
        client, MODEL_NAME, prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=Recomendacion,
        ),
    )
    return json.loads(response.text)
