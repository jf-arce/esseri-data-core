"""Vocabularios cerrados del motor de workflows (tipos de acción y eventos)."""

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
    "publicar_comunicacion",
]
TIPOS_ACCION: tuple[str, ...] = get_args(TipoAccion)

ERROR_ACCION_NO_IMPLEMENTADA = "La acción '{tipo_accion}' todavía no está implementada."

# Catálogo sembrado en database/seeds/grupo-a.yaml (`tipo_evento`). Al sumar un evento se
# agrega acá y en el seed.
TipoEventoNombre = Literal[
    "inasistencia.registrada",
    "inasistencia.justificada",
    "solicitud_ausencia_periodo.revocada",
    "factura.vencida",
    "inscripcion.cambio_matricula",
    "solicitud_inscripcion.aprobada",
    "pago.registrado",
    "pago.rechazado",
    "debito.resultado_registrado",
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
    "solicitud_ausencia_periodo.revocada": "solicitud_ausencia_periodo",
    "factura.vencida": "factura",
    "inscripcion.cambio_matricula": "inscripcion",
    "solicitud_inscripcion.aprobada": "solicitud_inscripcion",
    "pago.registrado": "pago",
    "pago.rechazado": "pago",
    "debito.resultado_registrado": "debito_cobranza",
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
    "publicar_comunicacion": frozenset({"debito.resultado_registrado"}),
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
    {
        "notificar",
        "alerta_interna",
        "generar_recordatorio",
        "generar_comunicacion",
        "publicar_comunicacion",
    }
)

# Estados a los que `cambiar_estado` puede llevar a cada entidad.
CAMBIOS_ESTADO_PERMITIDOS: dict[str, frozenset[str]] = {
    "factura": frozenset({"vencida"}),
}

Destinatario = Literal[
    "responsable_economico", "responsables_habilitados", "destinatarios_regla", "solicitante"
]
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

# Campos de texto con valores cerrados que emite el sistema: (evento, campo) -> (valor, etiqueta).
# El editor los muestra como lista y el backend rechaza cualquier otro valor. Los que salen de una
# tabla (método de pago, nivel educativo) se leen en `service.opciones_de_campos`.
OPCIONES_POR_CAMPO: dict[tuple[str, str], tuple[tuple[str, str], ...]] = {
    ("debito.resultado_registrado", "resultado"): (
        ("exitoso", "Acreditado"),
        ("rechazado", "Rechazado"),
    ),
    ("inasistencia.registrada", "tipo_asistencia"): (
        ("ausente_pendiente", "Ausente"),
        ("tardanza", "Tardanza"),
    ),
    ("inscripcion.cambio_matricula", "tipo_cambio"): (
        ("division", "Cambio de división"),
        ("nivel", "Cambio de nivel"),
    ),
    ("recepcion_compra.registrada", "tipo_recepcion"): (
        ("total", "Total"),
        ("parcial", "Parcial"),
    ),
    ("debito.resultado_registrado", "resultado"): (
        ("exitoso", "Exitoso"),
        ("rechazado", "Rechazado"),
    ),
}
# Campos cuyo valor es el nombre de una fila de tabla: (evento, campo) -> tabla.
CAMPOS_CON_OPCIONES_DE_TABLA: dict[
    tuple[str, str],
    Literal["metodo_pago", "nivel_educativo", "motivo_justificacion", "proveedor"],
] = {
    ("orden_compra.emitida", "proveedor_nombre"): "proveedor",
    ("recepcion_compra.registrada", "proveedor_nombre"): "proveedor",
    ("inasistencia.justificada", "motivo"): "motivo_justificacion",
    ("pago.registrado", "metodo_pago"): "metodo_pago",
    ("solicitud_inscripcion.aprobada", "nivel_educativo"): "nivel_educativo",
    ("inscripcion.confirmada", "nivel_educativo"): "nivel_educativo",
}
OPERADORES_CON_OPCIONES: frozenset[str] = frozenset({"==", "!="})

# Campos con muchos valores posibles (personas, artículos): el editor los busca por texto en
# `GET /workflows/campos-evento/{id}/opciones`. Cada fuente arma el texto igual que el módulo que
# emite el evento. El `bool` indica si además se admite un valor libre ("otro").
FuenteBusqueda = Literal[
    "alumno_apellido_nombre",
    "alumno_nombre_apellido",
    "familia_apellido_nombre",
    "familia_apellido",
    "producto",
]
BUSQUEDA_POR_CAMPO: dict[tuple[str, str], tuple[FuenteBusqueda, bool]] = {
    ("inasistencia.registrada", "alumno_nombre"): ("alumno_apellido_nombre", False),
    ("inasistencia.justificada", "alumno_nombre"): ("alumno_apellido_nombre", False),
    ("solicitud_ausencia_periodo.revocada", "alumno_nombre"): ("alumno_apellido_nombre", False),
    ("inscripcion.cambio_matricula", "alumno_nombre"): ("alumno_nombre_apellido", False),
    ("factura.vencida", "alumno_nombre"): ("alumno_nombre_apellido", False),
    ("factura.vencida", "nombre_familia"): ("familia_apellido_nombre", False),
    ("factura.vencida", "apellido_familia"): ("familia_apellido", False),
    ("solicitud_compra.aprobada", "item"): ("producto", True),
}

# Entidades de evento de las que se puede llegar a un alumno, necesario para los destinatarios
# `responsable_economico` y `responsables_habilitados`.
ENTIDADES_CON_ALUMNO: frozenset[str] = frozenset(
    {
        "debito_cobranza",
        "factura",
        "pago",
        "asistencia",
        "justificacion_inasistencia",
        "inscripcion",
        "solicitud_ausencia_periodo",
    }
)
DESTINATARIOS_FAMILIARES: frozenset[str] = frozenset(
    {"responsable_economico", "responsables_habilitados"}
)
# `solicitante` es el usuario que pidió la compra: se llega a él desde la solicitud, la orden o la
# recepción (#214).
ENTIDADES_CON_SOLICITANTE: frozenset[str] = frozenset(
    {"solicitud_compra", "orden_compra", "recepcion_compra"}
)

# Los envíos se hacen en serie dentro de la transacción del evento: este tope acota su duración.
MAX_DESTINATARIOS_POR_EJECUCION = 50

# Campos del payload que no se muestran en el resumen del historial (RNF-15): (evento, campo).
CAMPOS_RESERVADOS_RESUMEN: frozenset[tuple[str, str]] = frozenset(
    {("inasistencia.justificada", "motivo")}
)

# Botón opcional de los mails: clave -> (ruta de la app, texto del botón). El destino sale de acá,
# nunca de la configuración libre de la regla. Solo pantallas que funcionan hoy.
EnlaceMail = Literal["familia_justificar", "familia_facturacion", "ejecuciones", "tareas"]
ENLACES_MAIL: dict[EnlaceMail, tuple[str, str]] = {
    "familia_justificar": ("/familia/justificar-ausencia", "Justificar la inasistencia"),
    "familia_facturacion": ("/familia/facturacion", "Ver mis facturas"),
    "ejecuciones": ("/workflows/ejecuciones", "Revisar en ESSERI"),
    "tareas": ("/workflows/tareas", "Ver mis tareas"),
}

# Topes del árbol de una regla: lo que el editor puede dibujar sin volverse inmanejable.
MAX_NODOS_POR_REGLA = 30
MAX_PROFUNDIDAD_ARBOL = 6
MAX_COMPARACIONES = 5
# Bloques sin conectar que se guardan con la regla (no se ejecutan) y tamaño máximo en JSON.
MAX_BLOQUES_SUELTOS = 30
MAX_BYTES_BLOQUES_SUELTOS = 200_000
# Acciones de la allowlist que todavía no tienen ejecutor en `despacho_service.ACCIONES` (un test
# verifica que las dos listas coincidan). El editor las muestra como "todavía no disponible".
ACCIONES_NO_IMPLEMENTADAS: frozenset[str] = frozenset(
    {"registrar_pago", "actualizar_cuenta_corriente", "crear_registro_relacionado"}
)
