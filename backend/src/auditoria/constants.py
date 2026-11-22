"""Catálogo de entidades que el sistema registra en `AUDIT_LOG`.

El listado global arma el filtro de entidades con este catálogo unido a los valores
que ya existen en la tabla. Así el administrador ve todas las entidades auditables
del sistema aunque todavía no tengan registros, y no se pierde ningún valor histórico
que no esté en el catálogo (por ejemplo, una entidad renombrada).
"""

ENTIDADES_AUDITABLES: tuple[str, ...] = (
    # Autenticación y roles
    "USUARIO",
    "ROL",
    "PERMISO",
    "ROL_PERMISO",
    # Familias y alumnos
    "FAMILIA",
    "ALUMNO",
    "FAMILIA_ALUMNO",
    # Académico
    "ANIO",
    "DIVISION",
    "MATERIA",
    "MATERIA_CURSO",
    "DOCENTE",
    "ASIGNACION_DOCENTE",
    "SOLICITUD_AUSENCIA_PERIODO",
    "JUSTIFICACION_INASISTENCIA",
    "ASISTENCIA",
    # Inscripciones
    "SOLICITUD_ADMISION",
    "DOCUMENTO_SOLICITUD",
    "INSCRIPCION",
    # Facturación
    "CONCEPTO_COBRO",
    "RESPONSABLE_ECONOMICO",
    "FACTURA",
    "PAGO",
    "REGLA_FACTURACION",
    "REGLA_PENALIDAD",
    "EXCEPCION_VENCIMIENTO",
    "LOTE_COBRANZA",
    "DEBITO_COBRANZA",
    "IMPORTACION_COBRANZA",
    # Proveedores y compras
    "PROVEEDOR",
    "PRODUCTO_SERVICIO",
    "PRODUCTO_PROVEEDOR",
    "PRECIO_PRODUCTO",
    "SOLICITUD_COMPRA",
    "ORDEN_COMPRA",
    "RECEPCION_COMPRA",
    # Workflows
    "WORKFLOW_RULE",
    "WORKFLOW_NODO",
    "WORKFLOW_EXECUTION",
    "NOTIFICACION_TEMPLATE",
    "NOTIFICACION",
    "TAREA",
    "REGLA_DESTINATARIO",
    # Comunicaciones
    "COMUNICACION",
    "COMUNICACION_ADJUNTO",
    # IA
    "IA_SUGERENCIA",
)
