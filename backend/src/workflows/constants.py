"""Vocabularios cerrados del motor de workflows (tipos de acción, criticidad, eventos)."""

from typing import Literal, get_args

TipoAccion = Literal[
    "notificar",
    "alerta_interna",
    "cambiar_estado",
    "crear_tarea",
    "generar_cargo",
    "aplicar_vencimiento",
    "aplicar_penalidad",
    "registrar_pago",
    "registrar_rechazo",
    "actualizar_cuenta_corriente",
    "generar_recordatorio",
    "escalar_caso",
    "crear_registro_relacionado",
    "generar_orden_compra",
    "generar_comunicacion",
]
TIPOS_ACCION: tuple[str, ...] = get_args(TipoAccion)

Criticidad = Literal["baja", "media", "alta", "critica"]
CRITICIDADES: tuple[str, ...] = get_args(Criticidad)

# Catálogo sembrado en database/seeds/grupo-a.yaml (`tipo_evento`). Al sumar un evento se
# agrega acá y en el seed.
TipoEventoNombre = Literal[
    "inasistencia.registrada",
    "inasistencia.justificada",
    "factura.vencida",
    "inscripcion.cambio_matricula",
    "solicitud_inscripcion.aprobada",
    "pago.registrado",
    "pago.rechazado",
]

# Acciones que mueven dinero o escalan un caso: la regla nace con aprobación humana (Pregunta #15).
ACCIONES_CON_APROBACION_POR_DEFECTO: frozenset[str] = frozenset(
    {
        "generar_cargo",
        "aplicar_penalidad",
        "registrar_pago",
        "registrar_rechazo",
        "escalar_caso",
        "generar_orden_compra",
    }
)
