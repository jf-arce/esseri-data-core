# Diagnóstico: modelo de clases vs. modelo de datos

Contraste entre `Diagrama-Clases-Esseri V1.pdf` y `database/schema/DER-Esseri.drawio`.

## 1. Resumen

| | DER | Diagrama de clases |
|---|---|---|
| Entidades | 54 tablas | 55 clases |
| Nomenclatura | `snake_case` plural (`alumnos`, `familias_alumnos`) | `CamelCase` singular (`Alumno`, `FamiliaAlumno`) |
| Entidades equivalentes | 50 | 50 |
| Sin contraparte | 5 clases sin tabla · 4 tablas sin clase | — |
| Entidades del sistema ausentes en **ambos** | 14 | 14 |

El diagrama de clases declara en su portada "55 clases · 8 módulos · 96 relaciones", pero el sistema tiene 73 entidades. **Ninguno de los dos documentos está completo**, y por eso no pueden ser equivalentes: la equivalencia exige que ambos cubran el mismo conjunto.

## 2. Clases sin tabla en el DER

Existen en el diagrama de clases y en el sistema, pero el DER no las tiene:

| Clase | Tabla esperada | Módulo |
|---|---|---|
| `ArchivoComprobantePago` | `archivo_comprobante_pago` | Facturación y Cobranza |
| `ArchivoJustificacionInasistencia` | `archivo_justificacion_inasistencia` | Académico |
| `CargoFacturacionGenerado` | `cargo_facturacion_generado` | Facturación y Cobranza |
| `EjecucionFacturacion` | `ejecucion_facturacion` | Facturación y Cobranza |
| `ReglaFacturacion` | `regla_facturacion` | Facturación y Cobranza |

## 3. Tablas sin clase en el diagrama

| Tabla DER | Tabla real | Módulo | Naturaleza |
|---|---|---|---|
| `ordenes_compra_solicitudes` | `orden_compra_solicitud` | Proveedores y Compras | Tabla puente N:M |
| `productos_proveedores` | `producto_proveedor` | Proveedores y Compras | Tabla puente N:M |
| `roles_permisos` | `rol_permiso` | Autenticación y Roles | Tabla puente N:M |
| `usuarios_roles` | `usuario_rol` | Autenticación y Roles | Tabla puente N:M |

Las cuatro son tablas puente. En UML se resuelven como **clase asociativa**, que es el recurso que el diagrama ya usa para `FamiliaAlumno`. No son entidades faltantes: son un problema de **notación**, no de modelo.

## 4. Entidades ausentes en ambos documentos

| Tabla | Clase esperada | Módulo |
|---|---|---|
| `comunicacion` | `Comunicacion` | Comunicaciones |
| `comunicacion_adjunto` | `ComunicacionAdjunto` | Comunicaciones |
| `comunicacion_adjunto_contenido` | `ComunicacionAdjuntoContenido` | Comunicaciones |
| `debito_cobranza` | `DebitoCobranza` | Facturación y Cobranza |
| `ejecucion_facturacion_regla` | `EjecucionFacturacionRegla` | Facturación y Cobranza |
| `envio_notificacion` | `EnvioNotificacion` | Motor de Workflows y Notificaciones |
| `factura_cobranza_demo` | `FacturaCobranzaDemo` | Facturación y Cobranza |
| `horario_materia_curso` | `HorarioMateriaCurso` | Académico |
| `importacion_cobranza` | `ImportacionCobranza` | Facturación y Cobranza |
| `importacion_cobranza_detalle` | `ImportacionCobranzaDetalle` | Facturación y Cobranza |
| `lote_cobranza` | `LoteCobranza` | Facturación y Cobranza |
| `materia_curso` | `MateriaCurso` | Académico |
| `recibo_comunicacion` | `ReciboComunicacion` | Comunicaciones |
| `solicitud_ausencia_periodo` | `SolicitudAusenciaPeriodo` | Académico |

## 5. Matriz de trazabilidad completa

Una fila por entidad del sistema. `—` marca ausencia en ese documento.

| # | Módulo | Clase (UML) | Tabla (DER) | Tabla (real) | Estado |
|---|---|---|---|---|---|
| 1 | Familias y Alumnos | `Alumno` | `alumnos` | `alumno` | ✅ equivalente |
| 2 | Académico | `Anio` | `anios` | `anio` | ✅ equivalente |
| 3 | Facturación y Cobranza | `ArchivoComprobantePago` | — | `archivo_comprobante_pago` | ⚠️ falta en DER |
| 4 | Académico | `ArchivoJustificacionInasistencia` | — | `archivo_justificacion_inasistencia` | ⚠️ falta en DER |
| 5 | Académico | `AsignacionDocente` | `asignaciones_docente` | `asignacion_docente` | ✅ equivalente |
| 6 | Inscripciones | `Asistencia` | `asistencias` | `asistencia` | ✅ equivalente |
| 7 | Núcleo compartido e IA | `AuditLog` | `audit_logs` | `audit_log` | ✅ equivalente |
| 8 | Motor de Workflows y Notificaciones | `CampoEvento` | `campos_evento` | `campo_evento` | ✅ equivalente |
| 9 | Facturación y Cobranza | `CargoFacturacionGenerado` | — | `cargo_facturacion_generado` | ⚠️ falta en DER |
| 10 | Comunicaciones | — | — | `comunicacion` | ❌ falta en ambos |
| 11 | Comunicaciones | — | — | `comunicacion_adjunto` | ❌ falta en ambos |
| 12 | Comunicaciones | — | — | `comunicacion_adjunto_contenido` | ❌ falta en ambos |
| 13 | Facturación y Cobranza | `ConceptoCobro` | `conceptos_cobro` | `concepto_cobro` | ✅ equivalente |
| 14 | Facturación y Cobranza | `CuentaCorriente` | `cuentas_corrientes` | `cuenta_corriente` | ✅ equivalente |
| 15 | Facturación y Cobranza | — | — | `debito_cobranza` | ❌ falta en ambos |
| 16 | Facturación y Cobranza | `DetalleFactura` | `detalles_factura` | `detalle_factura` | ✅ equivalente |
| 17 | Académico | `Division` | `divisiones` | `division` | ✅ equivalente |
| 18 | Académico | `Docente` | `docentes` | `docente` | ✅ equivalente |
| 19 | Inscripciones | `DocumentoSolicitud` | `documentos_solicitud` | `documento_solicitud` | ✅ equivalente |
| 20 | Facturación y Cobranza | `EjecucionFacturacion` | — | `ejecucion_facturacion` | ⚠️ falta en DER |
| 21 | Facturación y Cobranza | — | — | `ejecucion_facturacion_regla` | ❌ falta en ambos |
| 22 | Motor de Workflows y Notificaciones | — | — | `envio_notificacion` | ❌ falta en ambos |
| 23 | Inscripciones | `EtapaSolicitud` | `etapas_solicitud` | `etapa_solicitud` | ✅ equivalente |
| 24 | Núcleo compartido e IA | `EventLog` | `event_logs` | `event_log` | ✅ equivalente |
| 25 | Facturación y Cobranza | `ExcepcionVencimiento` | `excepciones_vencimiento` | `excepcion_vencimiento` | ✅ equivalente |
| 26 | Facturación y Cobranza | `Factura` | `facturas` | `factura` | ✅ equivalente |
| 27 | Facturación y Cobranza | — | — | `factura_cobranza_demo` | ❌ falta en ambos |
| 28 | Familias y Alumnos | `Familia` | `familias` | `familia` | ✅ equivalente |
| 29 | Familias y Alumnos | `FamiliaAlumno` | `familias_alumnos` | `familia_alumno` | ✅ equivalente |
| 30 | Académico | — | — | `horario_materia_curso` | ❌ falta en ambos |
| 31 | Núcleo compartido e IA | `IaSugerencia` | `ia_sugerencias` | `ia_sugerencia` | ✅ equivalente |
| 32 | Facturación y Cobranza | — | — | `importacion_cobranza` | ❌ falta en ambos |
| 33 | Facturación y Cobranza | — | — | `importacion_cobranza_detalle` | ❌ falta en ambos |
| 34 | Inscripciones | `Inscripcion` | `inscripciones` | `inscripcion` | ✅ equivalente |
| 35 | Académico | `JustificacionInasistencia` | `justificaciones_inasistencia` | `justificacion_inasistencia` | ✅ equivalente |
| 36 | Autenticación y Roles | `LogAcceso` | `logs_acceso` | `log_acceso` | ✅ equivalente |
| 37 | Facturación y Cobranza | — | — | `lote_cobranza` | ❌ falta en ambos |
| 38 | Académico | `Materia` | `materias` | `materia` | ✅ equivalente |
| 39 | Académico | — | — | `materia_curso` | ❌ falta en ambos |
| 40 | Facturación y Cobranza | `MetodoPago` | `metodos_pago` | `metodo_pago` | ✅ equivalente |
| 41 | Académico | `MotivoJustificacion` | `motivos_justificacion` | `motivo_justificacion` | ✅ equivalente |
| 42 | Facturación y Cobranza | `Movimiento` | `movimientos` | `movimiento` | ✅ equivalente |
| 43 | Académico | `NivelEducativo` | `niveles_educativos` | `nivel_educativo` | ✅ equivalente |
| 44 | Motor de Workflows y Notificaciones | `Notificacion` | `notificaciones` | `notificacion` | ✅ equivalente |
| 45 | Motor de Workflows y Notificaciones | `NotificacionTemplate` | `notificacion_templates` | `notificacion_template` | ✅ equivalente |
| 46 | Proveedores y Compras | `OrdenCompra` | `ordenes_compra` | `orden_compra` | ✅ equivalente |
| 47 | Proveedores y Compras | `OrdenCompraDetalle` | `ordenes_compra_detalle` | `orden_compra_detalle` | ✅ equivalente |
| 48 | Proveedores y Compras | — | `ordenes_compra_solicitudes` | `orden_compra_solicitud` | ⚠️ falta en diagrama |
| 49 | Facturación y Cobranza | `Pago` | `pagos` | `pago` | ✅ equivalente |
| 50 | Autenticación y Roles | `Permiso` | `permisos` | `permiso` | ✅ equivalente |
| 51 | Núcleo compartido e IA | `Persona` | `personas` | `persona` | ✅ equivalente |
| 52 | Proveedores y Compras | `PrecioProducto` | `precios_producto` | `precio_producto` | ✅ equivalente |
| 53 | Proveedores y Compras | — | `productos_proveedores` | `producto_proveedor` | ⚠️ falta en diagrama |
| 54 | Proveedores y Compras | `ProductoServicio` | `productos_servicio` | `producto_servicio` | ✅ equivalente |
| 55 | Proveedores y Compras | `Proveedor` | `proveedores` | `proveedor` | ✅ equivalente |
| 56 | Proveedores y Compras | `RecepcionCompra` | `recepciones_compra` | `recepcion_compra` | ✅ equivalente |
| 57 | Proveedores y Compras | `RecepcionCompraDetalle` | `recepciones_compra_detalle` | `recepcion_compra_detalle` | ✅ equivalente |
| 58 | Comunicaciones | — | — | `recibo_comunicacion` | ❌ falta en ambos |
| 59 | Motor de Workflows y Notificaciones | `ReglaDestinatario` | `reglas_destinatario` | `regla_destinatario` | ✅ equivalente |
| 60 | Facturación y Cobranza | `ReglaFacturacion` | — | `regla_facturacion` | ⚠️ falta en DER |
| 61 | Facturación y Cobranza | `ReglaPenalidad` | `reglas_penalidad` | `regla_penalidad` | ✅ equivalente |
| 62 | Facturación y Cobranza | `ResponsableEconomico` | `responsables_economicos` | `responsable_economico` | ✅ equivalente |
| 63 | Autenticación y Roles | `Rol` | `roles` | `rol` | ✅ equivalente |
| 64 | Autenticación y Roles | — | `roles_permisos` | `rol_permiso` | ⚠️ falta en diagrama |
| 65 | Académico | — | — | `solicitud_ausencia_periodo` | ❌ falta en ambos |
| 66 | Proveedores y Compras | `SolicitudCompra` | `solicitudes_compra` | `solicitud_compra` | ✅ equivalente |
| 67 | Inscripciones | `SolicitudInscripcion` | `solicitudes_inscripcion` | `solicitud_inscripcion` | ✅ equivalente |
| 68 | Motor de Workflows y Notificaciones | `Tarea` | `tareas` | `tarea` | ✅ equivalente |
| 69 | Motor de Workflows y Notificaciones | `TipoEvento` | `tipos_evento` | `tipo_evento` | ✅ equivalente |
| 70 | Autenticación y Roles | `Usuario` | `usuarios` | `usuario` | ✅ equivalente |
| 71 | Autenticación y Roles | — | `usuarios_roles` | `usuario_rol` | ⚠️ falta en diagrama |
| 72 | Motor de Workflows y Notificaciones | `WorkflowExecution` | `workflow_executions` | `workflow_execution` | ✅ equivalente |
| 73 | Motor de Workflows y Notificaciones | `WorkflowRule` | `workflow_rules` | `workflow_rule` | ✅ equivalente |

## 6. Inconsistencia de nomenclatura

Es la causa más visible del "no son equivalentes". La misma entidad se llama distinto en cada documento:

| Concepto | DER | Diagrama |
|---|---|---|
| alumnos | `alumnos` | `Alumno` |
| familias alumnos | `familias_alumnos` | `FamiliaAlumno` |
| ordenes compra detalle | `ordenes_compra_detalle` | `OrdenCompraDetalle` |
| ia sugerencias | `ia_sugerencias` | `IaSugerencia` |
| niveles educativos | `niveles_educativos` | `NivelEducativo` |
| logs acceso | `logs_acceso` | `LogAcceso` |

Sin una convención única no hay trazabilidad posible: para emparejar `ordenes_compra_detalle` con `OrdenCompraDetalle` hay que aplicar una regla mental que ningún documento declara.

## 7. Relaciones

El diagrama declara 96 relaciones; el DER tiene 84 claves foráneas. La notación del diagrama es coherente: multiplicidad en ambos extremos, cajas grises punteadas para clases de otros módulos, clase asociativa para las tablas puente.

El problema no es cómo están dibujadas las relaciones, sino que **las dos redes no conectan el mismo conjunto de entidades**. Ejemplo verificable en la página 2: `EjecucionFacturacion` aparece como caja de referencia asociada a `Usuario` con multiplicidad `0..*`, pero el DER no tiene tabla `ejecucion_facturacion`. Es una asociación que apunta a una tabla inexistente en el modelo de datos.

Lo mismo ocurre con las otras cuatro clases sin tabla (`ArchivoComprobantePago`, `ArchivoJustificacionInasistencia`, `CargoFacturacionGenerado`, `ReglaFacturacion`) y, en sentido inverso, con las cuatro tablas puente, que el diagrama no representa.

No se auditó multiplicidad por multiplicidad contra cada FK: no es lo que exige la equivalencia. Lo que la rompe es que el conjunto de entidades difiera.

## 8. Qué exige la equivalencia

1. **Mismo conjunto de entidades** en ambos documentos (hoy: 50 en común, 5 y 4 sin contraparte, 14 ausentes en ambos).
2. **Una convención de nombres declarada**, con la regla de conversión explícita (p. ej. tabla `snake_case` singular ↔ clase `CamelCase`).
3. **Mismas relaciones**: toda FK del DER es una asociación en el diagrama, con la misma multiplicidad.
4. **Trazabilidad explícita**: cada clase anotada con su tabla, o una matriz como la de la sección 5 adjunta a la entrega.

---

*Diagnóstico generado a partir de los PDFs y del `.drawio` versionados en el repositorio.*

## 9. Resolución

Los dos documentos se regeneraron desde una fuente única (`database/schema/generator/model.json`),
derivada de los modelos SQLAlchemy. El estado final está en
[`trazabilidad-modelo-clases-der.md`](trazabilidad-modelo-clases-der.md):

| Control | Antes | Ahora |
|---|---|---|
| Entidades en el DER | 54 | 73 |
| Entidades en el diagrama de clases | 55 | 73 |
| Entidades equivalentes | 50 | 73 |
| Entidades sin contraparte | 9 | 0 |
| Relaciones | 84 / 96 (distintas) | 128 / 128 (las mismas) |
| Nomenclatura | plural vs CamelCase | singular vs CamelCase, regla declarada |
| Paginación | distinta | idéntica, módulo por módulo |

Las cinco clases que no tenían tabla (`ArchivoComprobantePago`, `ArchivoJustificacionInasistencia`,
`CargoFacturacionGenerado`, `EjecucionFacturacion`, `ReglaFacturacion`) ya tienen su tabla en el DER.
Las cuatro tablas puente se representan como clase con el estereotipo «tabla puente», de modo que
también tienen contraparte uno a uno. Las catorce entidades que faltaban en ambos documentos
(Comunicaciones, Cobranzas, `materia_curso`, `horario_materia_curso`, `solicitud_ausencia_periodo`)
están incorporadas en los dos.

`persona` se unificó en el módulo Núcleo compartido e IA: en el DER anterior figuraba bajo
Autenticación y Roles mientras el diagrama la ubicaba en Núcleo.

Se auditó la geometría de las 205 aristas dibujadas en cada documento (las 128 relaciones, más
las que se repiten como referencia en cada página): ninguna cruza una tarjeta. La verificación es
reproducible con `database/schema/generator/audit.py`.
