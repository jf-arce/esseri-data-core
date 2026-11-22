"""Etiquetas legibles de los motivos de justificación.

El nombre guardado en `MOTIVO_JUSTIFICACION` es un código (`motivo_familiar_personal`).
Todo texto que vea una persona —incluidas las tablas del Asistente— usa esta etiqueta.
"""

import unicodedata

ETIQUETAS = {
    "enfermedad": "Enfermedad",
    "certificado_medico": "Certificado médico",
    "turno_estudio_medico": "Turno/estudio médico",
    "viaje_familiar": "Viaje familiar",
    "motivo_familiar_personal": "Motivo familiar/personal",
    "actividad_autorizada_esseri": "Actividad autorizada ESSERI",
    "otro": "Otro",
}


def _humanizar(valor: str) -> str:
    texto = valor.replace("_", " ").replace("-", " ")
    texto = " ".join(texto.split())
    return texto[:1].upper() + texto[1:]


def etiqueta_motivo(nombre: str | None) -> str:
    """Etiqueta conocida o, para un valor nuevo, el código humanizado."""

    if not nombre:
        return "Otro"
    clave = "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", nombre.strip().casefold())
        if unicodedata.category(caracter) != "Mn"
    )
    return ETIQUETAS.get(clave, _humanizar(nombre))
