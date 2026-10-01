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

# Entidad que cada tipo de evento tiene que informar en `EVENT_LOG.entidad`. Las acciones operan
# sobre esa entidad, así que `emit_event()` y el despachador la exigen. Al sumar un evento se
# agrega acá, en `TipoEventoNombre` y en el seed.
ENTIDAD_POR_EVENTO: dict[TipoEventoNombre, str] = {
    "inasistencia.registrada": "asistencia",
    "inasistencia.justificada": "justificacion_inasistencia",
    "factura.vencida": "factura",
    "inscripcion.cambio_matricula": "inscripcion",
    "solicitud_inscripcion.aprobada": "solicitud_inscripcion",
    "pago.registrado": "pago",
    "pago.rechazado": "pago",
}

# Allowlist de eventos por acción (Pregunta #16). `None` = cualquier evento: solo las acciones
# que crean filas propias del motor (notificaciones, tareas). Vacío = todavía no se puede
# configurar (no hay un evento de Compras que la dispare).
EVENTOS_POR_ACCION: dict[str, frozenset[str] | None] = {
    "notificar": None,
    "alerta_interna": None,
    "generar_recordatorio": None,
    "generar_comunicacion": None,
    "crear_tarea": None,
    "escalar_caso": None,
    "cambiar_estado": frozenset({"factura.vencida"}),
    "generar_cargo": frozenset({"solicitud_inscripcion.aprobada", "pago.rechazado"}),
    "aplicar_vencimiento": frozenset({"factura.vencida"}),
    "aplicar_penalidad": frozenset({"factura.vencida"}),
    "registrar_pago": frozenset({"pago.registrado"}),
    "registrar_rechazo": frozenset({"pago.rechazado"}),
    "actualizar_cuenta_corriente": frozenset(
        {"pago.registrado", "pago.rechazado", "factura.vencida"}
    ),
    "crear_registro_relacionado": frozenset({"solicitud_inscripcion.aprobada"}),
    "generar_orden_compra": frozenset(),
}

# Acciones que arman un mensaje: son las únicas que admiten `notificacion_template_id`.
ACCIONES_CON_PLANTILLA: frozenset[str] = frozenset(
    {"notificar", "alerta_interna", "generar_recordatorio", "generar_comunicacion"}
)

# Estados a los que `cambiar_estado` puede llevar a cada entidad.
CAMBIOS_ESTADO_PERMITIDOS: dict[str, frozenset[str]] = {
    "factura": frozenset({"vencida"}),
}

Destinatario = Literal["responsable_economico", "responsables_habilitados", "destinatarios_regla"]
PrioridadTarea = Literal["baja", "media", "alta"]

Operador = Literal["==", "!=", ">", ">=", "<", "<=", "contiene"]
OPERADORES_POR_TIPO_DATO: dict[str, frozenset[str]] = {
    "numero": frozenset({"==", "!=", ">", ">=", "<", "<="}),
    "fecha": frozenset({"==", "!=", ">", ">=", "<", "<="}),
    "texto": frozenset({"==", "!=", "contiene"}),
}
