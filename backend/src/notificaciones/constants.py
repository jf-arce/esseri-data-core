"""Vocabularios cerrados de las notificaciones internas.

Un tipo o contexto fuera de estos valores se rechaza por defecto: la tabla es genérica, pero
cada combinación (tipo, destino) tiene un esquema estricto y un significado de negocio.
"""

AMBITO_ACADEMICO = "academico"
AMBITOS_VALIDOS = frozenset({AMBITO_ACADEMICO})

TIPO_INASISTENCIA_REGISTRADA = "academico.inasistencia_registrada"
TIPO_JUSTIFICACION_APROBADA = "academico.justificacion_aprobada"
TIPO_JUSTIFICACION_RECHAZADA = "academico.justificacion_rechazada"

DESTINO_ASISTENCIA = "asistencia"
DESTINO_JUSTIFICACION_INDIVIDUAL = "justificacion_individual"
DESTINO_SOLICITUD_PERIODO = "solicitud_ausencia_periodo"

DESTINOS_VALIDOS = frozenset(
    {DESTINO_ASISTENCIA, DESTINO_JUSTIFICACION_INDIVIDUAL, DESTINO_SOLICITUD_PERIODO}
)

# Clave lógica de la tabla. El nombre es estable porque el productor lo usa para distinguir el
# choque esperado de cualquier otra violación de integridad.
NOMBRE_UNICO_CLAVE = "uq_notificacion_interna_usuario_ambito_clave"

ROL_FAMILIA = "familia"
