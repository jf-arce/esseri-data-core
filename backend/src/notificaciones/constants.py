"""Vocabularios cerrados de las notificaciones internas.

Un tipo o contexto fuera de estos valores se rechaza por defecto: la tabla es genérica, pero
cada combinación (tipo, destino) tiene un esquema estricto y un significado de negocio.
"""

AMBITO_ACADEMICO = "academico"
AMBITO_COMUNICACIONES = "comunicaciones"
AMBITO_FACTURACION = "facturacion"
AMBITOS_VALIDOS = frozenset({AMBITO_ACADEMICO, AMBITO_COMUNICACIONES, AMBITO_FACTURACION})

TIPO_INASISTENCIA_REGISTRADA = "academico.inasistencia_registrada"
TIPO_JUSTIFICACION_APROBADA = "academico.justificacion_aprobada"
TIPO_JUSTIFICACION_RECHAZADA = "academico.justificacion_rechazada"
TIPO_COMUNICACION_PUBLICADA = "comunicaciones.institucional_publicada"
TIPO_RESPUESTA_CONVERSACION = "comunicaciones.respuesta_conversacion"
TIPO_FACTURA_EMITIDA = "facturacion.factura_emitida"
TIPO_PAGO_REGISTRADO = "facturacion.pago_registrado"
TIPO_PROXIMO_VENCIMIENTO = "facturacion.proximo_vencimiento"

DESTINO_ASISTENCIA = "asistencia"
DESTINO_JUSTIFICACION_INDIVIDUAL = "justificacion_individual"
DESTINO_SOLICITUD_PERIODO = "solicitud_ausencia_periodo"
DESTINO_COMUNICACION = "comunicacion"
DESTINO_CONVERSACION = "conversacion"
DESTINO_FACTURA = "factura"
DESTINO_PAGO = "pago"

DESTINOS_VALIDOS = frozenset(
    {
        DESTINO_ASISTENCIA,
        DESTINO_JUSTIFICACION_INDIVIDUAL,
        DESTINO_SOLICITUD_PERIODO,
        DESTINO_COMUNICACION,
        DESTINO_CONVERSACION,
        DESTINO_FACTURA,
        DESTINO_PAGO,
    }
)

AMBITO_POR_TIPO = {
    TIPO_INASISTENCIA_REGISTRADA: AMBITO_ACADEMICO,
    TIPO_JUSTIFICACION_APROBADA: AMBITO_ACADEMICO,
    TIPO_JUSTIFICACION_RECHAZADA: AMBITO_ACADEMICO,
    TIPO_COMUNICACION_PUBLICADA: AMBITO_COMUNICACIONES,
    TIPO_RESPUESTA_CONVERSACION: AMBITO_COMUNICACIONES,
    TIPO_FACTURA_EMITIDA: AMBITO_FACTURACION,
    TIPO_PAGO_REGISTRADO: AMBITO_FACTURACION,
    TIPO_PROXIMO_VENCIMIENTO: AMBITO_FACTURACION,
}

# Clave lógica de la tabla. El nombre es estable porque el productor lo usa para distinguir el
# choque esperado de cualquier otra violación de integridad.
NOMBRE_UNICO_CLAVE = "uq_notificacion_interna_usuario_ambito_clave"

ROL_FAMILIA = "familia"
