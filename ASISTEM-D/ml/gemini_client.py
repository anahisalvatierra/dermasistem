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

MODEL_NAME = "gemini-3.5-flash-lite"
_client = None


def _generate_with_retry(client, model, contents, config, max_retries=2):
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


# ===========================================================================
# CÁNCER DE PIEL — NLP y recomendaciones (módulo nuevo)
# ===========================================================================
class SintomasLesion(BaseModel):
    zona_afectada: Optional[str] = Field(
        None, description="Zona del cuerpo donde está la lesión o lunar, ej. espalda, brazo, rostro"
    )
    duracion: Optional[str] = Field(None, description="Cuánto tiempo lleva la lesión o desde cuándo la notó")
    cambios_recientes: Optional[str] = Field(
        None, description="Cambios en tamaño, color, forma o bordes que menciona el usuario"
    )
    sintomas: List[str] = Field(
        default_factory=list,
        description="Síntomas que menciona: picazón, sangrado, dolor, costra, herida que no cierra, etc.",
    )
    exposicion_solar: Optional[str] = Field(
        None, description="Exposición al sol o uso de protector solar que menciona"
    )
    antecedentes: Optional[str] = Field(
        None, description="Antecedentes personales o familiares de lesiones de piel que el usuario mencione"
    )
    resumen: str = Field(description="Resumen breve del caso en una oración")


def extract_symptoms_cancer(texto_usuario: str) -> dict:
    """Extrae datos estructurados del relato del usuario sobre una lesión o lunar."""
    client = get_client()
    prompt = (
        "Extrae la información relevante del siguiente relato de un usuario sobre un lunar o "
        "lesión en su piel. Si un dato no se menciona, déjalo vacío o null. No inventes "
        f"información que no esté en el texto.\n\nTexto del usuario:\n{texto_usuario}"
    )
    response = _generate_with_retry(
        client, MODEL_NAME, prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SintomasLesion,
        ),
    )
    return json.loads(response.text)


class RecomendacionCancer(BaseModel):
    resumen_situacion: str = Field(description="Resumen breve y empático de la situación (1-2 oraciones)")
    recomendaciones_prevencion: List[str] = Field(
        description="3 a 5 recomendaciones concretas de cuidado y prevención (protección solar, autoexamen, etc.)"
    )
    senales_de_alarma: List[str] = Field(
        description="3 a 5 señales por las que debe consultar sin demora (cambios de tamaño, color, bordes, sangrado...)"
    )
    cuando_consultar_dermatologo: str = Field(
        description="Cuándo y con qué urgencia debe consultar a un dermatólogo, según el nivel de riesgo"
    )
    aviso: str = Field(description="Aviso de que esto no es un diagnóstico y no reemplaza a un médico")


_CONTEXTO_NIVEL_CANCER = {
    "riesgo_alto": (
        "RIESGO ALTO: el modelo detectó características compatibles con una lesión maligna. "
        "Indica que debe consultar a un dermatólogo pronto, idealmente en los próximos días."
    ),
    "riesgo_dudoso": (
        "DUDOSO: el modelo no pudo descartar una lesión maligna. "
        "Indica que conviene que un dermatólogo la revise en las próximas semanas."
    ),
    "riesgo_bajo": (
        "RIESGO BAJO: el modelo no detectó señales claras de malignidad, pero esto NO descarta nada. "
        "Indica que, si la lesión cambia o aparece alguna señal de alarma, debe consultar de todos modos, "
        "y que lo ideal es un chequeo dermatológico de rutina."
    ),
}


def get_recommendations_cancer(nivel: str, probabilidad_maligno: float, datos_nlp: dict) -> dict:
    """Pide a Gemini recomendaciones prudentes según el nivel de riesgo del modelo de cáncer."""
    client = get_client()
    contexto = _CONTEXTO_NIVEL_CANCER.get(nivel, _CONTEXTO_NIVEL_CANCER["riesgo_dudoso"])
    prompt = (
        "Un modelo de visión por computadora analizó una foto de una lesión o lunar en la piel. "
        f"Resultado: {contexto} (probabilidad estimada de lesión maligna: {probabilidad_maligno:.0%}).\n\n"
        f"Datos adicionales que reportó el usuario:\n{json.dumps(datos_nlp, ensure_ascii=False, indent=2)}\n\n"
        "Genera una respuesta en tono cercano, claro y tranquilo, en español boliviano. Reglas estrictas:\n"
        "- NUNCA afirmes que la persona tiene o no tiene cáncer. Eres una herramienta de orientación, no un diagnóstico.\n"
        "- No receta medicamentos, cremas ni tratamientos, y no sugieras tratar la lesión por cuenta propia.\n"
        "- Aunque el riesgo sea bajo, nunca digas que está sana ni que no debe preocuparse.\n"
        "- Menciona la regla ABCDE (asimetría, bordes, color, diámetro, evolución) como señales de alarma.\n"
        "- Incluye cuidados de prevención: protector solar, evitar el sol fuerte del mediodía, "
        "revisar la piel periódicamente.\n"
        "- Ajusta la urgencia a lo indicado en el resultado, y recuerda siempre que las fotos de celular "
        "son menos fiables que un examen con dermatoscopio."
    )
    response = _generate_with_retry(
        client, MODEL_NAME, prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RecomendacionCancer,
        ),
    )
    return json.loads(response.text)
