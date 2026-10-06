"""Constantes propias de IA/Sugerencias."""

from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_LEER,
    MODULO_IA_SUGERENCIAS,
    codigo_de,
)

# Códigos de permiso para `requiere_permiso(...)`. Coinciden con la matriz de
# `database/seeds/grupo-b.yaml` (crear, leer, actualizar).
PERMISO_IA_SUGERENCIAS_CREAR = codigo_de(MODULO_IA_SUGERENCIAS, ACCION_CREAR)
PERMISO_IA_SUGERENCIAS_LEER = codigo_de(MODULO_IA_SUGERENCIAS, ACCION_LEER)
PERMISO_IA_SUGERENCIAS_ACTUALIZAR = codigo_de(MODULO_IA_SUGERENCIAS, ACCION_ACTUALIZAR)

# Valor de `IA_SUGERENCIA.entidad` según a quién afecta el patrón. En minúscula y singular, igual
# que `EVENT_LOG.entidad`.
ENTIDAD_FAMILIA = "familia"
ENTIDAD_ALUMNO = "alumno"
# En una sugerencia de comunicación, la entidad es el evento para el que se redactó.
ENTIDAD_TIPO_EVENTO = "tipo_evento"

# Una ausencia pendiente todavía no fue justificada: cuenta igual que una injustificada.
TIPOS_AUSENCIA_SIN_JUSTIFICAR = ("ausente_injustificado", "ausente_pendiente")

TIPO_COMUNICACION = "comunicacion"

ESTADO_PENDIENTE = "pendiente_revision"
ESTADO_APROBADA = "aprobada"
ESTADO_RECHAZADA = "rechazada"
