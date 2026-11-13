# Trazabilidad entre el modelo de clases y el modelo de datos

Ambos documentos se generan de la misma fuente (`database/schema/generator/model.json`),
por lo que la correspondencia entre clase y tabla es **uno a uno y verificable**: no hay
entidades de un lado sin contraparte del otro, ni nombres que haya que interpretar.

## 1. Regla de conversión

| Documento | Convención | Ejemplo |
|---|---|---|
| DER | tabla en `snake_case` singular | `familia_alumno` |
| Diagrama de clases | clase en `CamelCase` singular | `FamiliaAlumno` |

La conversión es mecánica: se capitaliza cada segmento separado por `_` y se eliminan los guiones bajos.
No hay abreviaturas ni excepciones.

Además, **ambos documentos comparten la misma paginación**: la página *N* del DER y la página *N*
del diagrama de clases tratan el mismo módulo. Eso permite pasar de uno al otro por número de página.

## 2. Matriz de trazabilidad

| # | Módulo | Clase | Tabla | Página | Relaciones |
|---|---|---|---|---|---|
| 1 | Autenticación y Roles | `LogAcceso` | `log_acceso` | 2 | 1 |
| 2 | Autenticación y Roles | `Permiso` | `permiso` | 2 | 1 |
| 3 | Autenticación y Roles | `Rol` | `rol` | 2 | 3 |
| 4 | Autenticación y Roles | `RolPermiso` | `rol_permiso` | 2 | 2 |
| 5 | Autenticación y Roles | `Usuario` | `usuario` | 2 | 25 |
| 6 | Autenticación y Roles | `UsuarioRol` | `usuario_rol` | 2 | 2 |
| 7 | Familias y Alumnos | `Alumno` | `alumno` | 3 | 6 |
| 8 | Familias y Alumnos | `Familia` | `familia` | 3 | 9 |
| 9 | Familias y Alumnos | `FamiliaAlumno` | `familia_alumno` | 3 | 2 |
| 10 | Académico | `Anio` | `anio` | 4 | 3 |
| 11 | Académico | `ArchivoJustificacionInasistencia` | `archivo_justificacion_inasistencia` | 4 | 1 |
| 12 | Académico | `AsignacionDocente` | `asignacion_docente` | 5 | 2 |
| 13 | Académico | `Division` | `division` | 4 | 4 |
| 14 | Académico | `Docente` | `docente` | 4 | 2 |
| 15 | Académico | `HorarioMateriaCurso` | `horario_materia_curso` | 5 | 1 |
| 16 | Académico | `JustificacionInasistencia` | `justificacion_inasistencia` | 4 | 5 |
| 17 | Académico | `Materia` | `materia` | 4 | 1 |
| 18 | Académico | `MateriaCurso` | `materia_curso` | 4 | 4 |
| 19 | Académico | `MotivoJustificacion` | `motivo_justificacion` | 4 | 2 |
| 20 | Académico | `NivelEducativo` | `nivel_educativo` | 4 | 3 |
| 21 | Académico | `SolicitudAusenciaPeriodo` | `solicitud_ausencia_periodo` | 4 | 6 |
| 22 | Inscripciones | `Asistencia` | `asistencia` | 6 | 3 |
| 23 | Inscripciones | `DocumentoSolicitud` | `documento_solicitud` | 6 | 2 |
| 24 | Inscripciones | `EtapaSolicitud` | `etapa_solicitud` | 6 | 2 |
| 25 | Inscripciones | `Inscripcion` | `inscripcion` | 6 | 6 |
| 26 | Inscripciones | `SolicitudInscripcion` | `solicitud_inscripcion` | 6 | 7 |
| 27 | Facturación y Cobranza | `ArchivoComprobantePago` | `archivo_comprobante_pago` | 8 | 1 |
| 28 | Facturación y Cobranza | `CargoFacturacionGenerado` | `cargo_facturacion_generado` | 8 | 5 |
| 29 | Facturación y Cobranza | `ConceptoCobro` | `concepto_cobro` | 7 | 5 |
| 30 | Facturación y Cobranza | `CuentaCorriente` | `cuenta_corriente` | 7 | 2 |
| 31 | Facturación y Cobranza | `DebitoCobranza` | `debito_cobranza` | 8 | 4 |
| 32 | Facturación y Cobranza | `DetalleFactura` | `detalle_factura` | 8 | 3 |
| 33 | Facturación y Cobranza | `EjecucionFacturacion` | `ejecucion_facturacion` | 7 | 3 |
| 34 | Facturación y Cobranza | `EjecucionFacturacionRegla` | `ejecucion_facturacion_regla` | 8 | 2 |
| 35 | Facturación y Cobranza | `ExcepcionVencimiento` | `excepcion_vencimiento` | 7 | 3 |
| 36 | Facturación y Cobranza | `Factura` | `factura` | 7 | 9 |
| 37 | Facturación y Cobranza | `FacturaCobranzaDemo` | `factura_cobranza_demo` | 8 | 1 |
| 38 | Facturación y Cobranza | `ImportacionCobranza` | `importacion_cobranza` | 7 | 3 |
| 39 | Facturación y Cobranza | `ImportacionCobranzaDetalle` | `importacion_cobranza_detalle` | 9 | 4 |
| 40 | Facturación y Cobranza | `LoteCobranza` | `lote_cobranza` | 7 | 4 |
| 41 | Facturación y Cobranza | `MetodoPago` | `metodo_pago` | 7 | 1 |
| 42 | Facturación y Cobranza | `Movimiento` | `movimiento` | 8 | 6 |
| 43 | Facturación y Cobranza | `Pago` | `pago` | 8 | 7 |
| 44 | Facturación y Cobranza | `ReglaFacturacion` | `regla_facturacion` | 7 | 6 |
| 45 | Facturación y Cobranza | `ReglaPenalidad` | `regla_penalidad` | 7 | 1 |
| 46 | Facturación y Cobranza | `ResponsableEconomico` | `responsable_economico` | 7 | 3 |
| 47 | Proveedores y Compras | `OrdenCompra` | `orden_compra` | 10 | 4 |
| 48 | Proveedores y Compras | `OrdenCompraDetalle` | `orden_compra_detalle` | 10 | 3 |
| 49 | Proveedores y Compras | `OrdenCompraSolicitud` | `orden_compra_solicitud` | 10 | 2 |
| 50 | Proveedores y Compras | `PrecioProducto` | `precio_producto` | 10 | 2 |
| 51 | Proveedores y Compras | `ProductoProveedor` | `producto_proveedor` | 10 | 2 |
| 52 | Proveedores y Compras | `ProductoServicio` | `producto_servicio` | 10 | 4 |
| 53 | Proveedores y Compras | `Proveedor` | `proveedor` | 10 | 3 |
| 54 | Proveedores y Compras | `RecepcionCompra` | `recepcion_compra` | 10 | 3 |
| 55 | Proveedores y Compras | `RecepcionCompraDetalle` | `recepcion_compra_detalle` | 10 | 2 |
| 56 | Proveedores y Compras | `SolicitudCompra` | `solicitud_compra` | 10 | 3 |
| 57 | Motor de Workflows y Notificaciones | `CampoEvento` | `campo_evento` | 11 | 1 |
| 58 | Motor de Workflows y Notificaciones | `EnvioNotificacion` | `envio_notificacion` | 11 | 3 |
| 59 | Motor de Workflows y Notificaciones | `Notificacion` | `notificacion` | 11 | 4 |
| 60 | Motor de Workflows y Notificaciones | `NotificacionTemplate` | `notificacion_template` | 11 | 2 |
| 61 | Motor de Workflows y Notificaciones | `ReglaDestinatario` | `regla_destinatario` | 11 | 3 |
| 62 | Motor de Workflows y Notificaciones | `Tarea` | `tarea` | 11 | 4 |
| 63 | Motor de Workflows y Notificaciones | `TipoEvento` | `tipo_evento` | 11 | 3 |
| 64 | Motor de Workflows y Notificaciones | `WorkflowExecution` | `workflow_execution` | 11 | 4 |
| 65 | Motor de Workflows y Notificaciones | `WorkflowRule` | `workflow_rule` | 11 | 4 |
| 66 | Comunicaciones | `Comunicacion` | `comunicacion` | 12 | 4 |
| 67 | Comunicaciones | `ComunicacionAdjunto` | `comunicacion_adjunto` | 12 | 2 |
| 68 | Comunicaciones | `ComunicacionAdjuntoContenido` | `comunicacion_adjunto_contenido` | 12 | 1 |
| 69 | Comunicaciones | `ReciboComunicacion` | `recibo_comunicacion` | 12 | 2 |
| 70 | Núcleo compartido e IA | `AuditLog` | `audit_log` | 13 | 1 |
| 71 | Núcleo compartido e IA | `EventLog` | `event_log` | 13 | 4 |
| 72 | Núcleo compartido e IA | `IaSugerencia` | `ia_sugerencia` | 13 | 2 |
| 73 | Núcleo compartido e IA | `Persona` | `persona` | 13 | 6 |

## 3. Verificación de equivalencia

| Control | DER | Diagrama de clases |
|---|---|---|
| Entidades | 73 | 73 |
| Relaciones | 128 | 128 |
| Módulos | 9 | 9 |
| Páginas | 13 | 13 |
| Entidades sin contraparte | 0 | 0 |

## 4. Cómo regenerar

```bash
backend/venv/bin/python database/schema/generator/build_model.py
python3 database/schema/generator/render.py
# Chrome headless, A3 horizontal:
#   --print-to-pdf=der.pdf    database/schema/generator/der.html
#   --print-to-pdf=clases.pdf database/schema/generator/clases.html
```

`build_model.py` lee los modelos SQLAlchemy; `render.py` produce el HTML de ambos documentos.
Cambiar una entidad en el código y volver a correr ambos pasos mantiene la equivalencia por construcción.
