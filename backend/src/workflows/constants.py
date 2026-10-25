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

ERROR_ACCION_NO_IMPLEMENTADA = "La acción '{tipo_accion}' todavía no está implementada."

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
    "orden_compra.emitida",
    "recepcion_compra.registrada",
    "inscripcion.confirmada",
    "solicitud_compra.aprobada",
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
    "orden_compra.emitida": "orden_compra",
    "recepcion_compra.registrada": "recepcion_compra",
    "inscripcion.confirmada": "inscripcion",
    "solicitud_compra.aprobada": "solicitud_compra",
}

# Allowlist de eventos por acción (Pregunta #16). `None` = cualquier evento: solo las acciones
# que crean filas propias del motor (notificaciones, tareas).
EVENTOS_POR_ACCION: dict[str, frozenset[str] | None] = {
    "notificar": None,
    "alerta_interna": None,
    "generar_recordatorio": None,
    "generar_comunicacion": None,
    "crear_tarea": None,
    "escalar_caso": None,
    "cambiar_estado": frozenset({"factura.vencida"}),
    "generar_cargo": frozenset({"inscripcion.confirmada", "pago.rechazado"}),
    "aplicar_vencimiento": frozenset({"factura.vencida"}),
    "aplicar_penalidad": frozenset({"factura.vencida"}),
    "registrar_pago": frozenset({"pago.registrado"}),
    "registrar_rechazo": frozenset({"pago.rechazado"}),
    "actualizar_cuenta_corriente": frozenset(
        {"pago.registrado", "pago.rechazado", "factura.vencida"}
    ),
    "crear_registro_relacionado": frozenset({"solicitud_inscripcion.aprobada"}),
    "generar_orden_compra": frozenset({"solicitud_compra.aprobada"}),
}

# Acciones que no corren cuando llega el evento sino `dias_despues` días más tarde: el despachador
# las saltea y las toma `procesar_recordatorios_vencidos`.
ACCIONES_DIFERIDAS: frozenset[str] = frozenset({"generar_recordatorio"})
# Cuántos días después de cumplirse `dias_despues` se sigue buscando eventos sin recordar: un evento
# más viejo (el backend estuvo caído, la regla estuvo apagada) ya no se recuerda, y la búsqueda
# de cada pasada queda acotada.
VENTANA_RECORDATORIOS_DIAS = 7

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
EstadoTarea = Literal["pendiente", "en_progreso", "completada", "escalada"]
ESTADOS_TAREA: tuple[str, ...] = get_args(EstadoTarea)
# Una tarea abierta es la que todavía tiene responsable activo: `escalada` ya pasó a otra persona y
# `completada` está cerrada, así que solo estas dos se pueden escalar o cambiar de estado.
ESTADOS_TAREA_ABIERTA: tuple[str, ...] = ("pendiente", "en_progreso")
# Cambios de estado que puede hacer una persona desde la bandeja. `escalada` solo la pone el motor.
TRANSICIONES_TAREA: dict[str, frozenset[str]] = {
    "pendiente": frozenset({"en_progreso", "completada"}),
    "en_progreso": frozenset({"completada"}),
}

Operador = Literal["==", "!=", ">", ">=", "<", "<=", "contiene"]
OPERADORES_POR_TIPO_DATO: dict[str, frozenset[str]] = {
    "numero": frozenset({"==", "!=", ">", ">=", "<", "<="}),
    "fecha": frozenset({"==", "!=", ">", ">=", "<", "<="}),
    "texto": frozenset({"==", "!=", "contiene"}),
}

# Entidades de evento de las que se puede llegar a un alumno, necesario para los destinatarios
# `responsable_economico` y `responsables_habilitados`.
ENTIDADES_CON_ALUMNO: frozenset[str] = frozenset(
    {"factura", "pago", "asistencia", "justificacion_inasistencia", "inscripcion"}
)
DESTINATARIOS_FAMILIARES: frozenset[str] = frozenset(
    {"responsable_economico", "responsables_habilitados"}
)

# Los envíos se hacen en serie dentro de la transacción del evento: este tope acota su duración.
MAX_DESTINATARIOS_POR_EJECUCION = 50
