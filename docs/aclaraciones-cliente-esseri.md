**1. Si un alumno tiene más de un responsable, ¿quién recibe y asume la facturación? ¿Hay un responsable económico fijo por alumno o se puede elegir en cada factura?**

Cada alumno puede tener más de un responsable parental, pero debe tener **un responsable económico/de pago definido** a cuyo nombre se emite la facturación.

Ese responsable queda fijo hasta que la familia solicite un cambio. No se selecciona nuevamente en cada factura. Los cambios de responsable/facturación deben informarse antes del día 10 y se aplican a partir del período siguiente.

La designación de un responsable económico no libera a los demás responsables parentales de las obligaciones asumidas con ESSERI.

**2. ¿Las materias son iguales para todas las divisiones de un mismo año o puede haber materias distintas según división/orientación?**

El sistema debe permitir que las materias puedan configurarse **por nivel, año y división/orientación**, sin obligar a que todas las divisiones tengan exactamente las mismas materias.

De esta manera podemos tener una base común y, cuando corresponda, materias, talleres o propuestas específicas para una determinada división/orientación.

**3. Además de la cuota mensual, ¿qué otros conceptos cobran actualmente?**

Actualmente necesitamos contemplar como conceptos de cobro:

* Cuota educativa.
* Matrícula / reserva de vacante.
* Servicio Nutricional.
* ESSERI Experience (viajes y salidas).
* ESSERI Conecta, donde corresponda.
* Transporte, cuando corresponda.
* Penalidades por mora/pago tardío.
* Penalidad por stop debit.
* Daños, reparaciones o reposiciones a cargo de una familia.
* Actividades, materiales, plataformas, campamentos, viajes, eventos u otros conceptos extraordinarios que puedan generarse.

El sistema debe permitir además **crear nuevos conceptos de cobro sin necesidad de desarrollo**.

El uniforme actualmente se compra directamente al proveedor autorizado, por lo que no se factura desde ESSERI.

**4. ¿Qué métodos de pago aceptan actualmente? ¿En cuáles necesitan guardar comprobante?**

Los medios ordinarios son:

* Débito directo en cuenta bancaria.
* Tarjeta de débito.
* Tarjeta de crédito.

La transferencia se utiliza únicamente en casos habilitados o excepcionales. Actualmente, por ejemplo, se utiliza para la matrícula de alumnos nuevos.

Cuando el pago sea por transferencia, necesitamos **guardar el comprobante asociado al pago/alumno/familia**.

Para débitos y tarjetas necesitamos guardar el resultado de la operación: aprobado, rechazado, fecha, importe, medio utilizado y referencia de la transacción.

**5. ¿A partir de cuántos días después del vencimiento consideran que una deuda está en mora?**

La cuota vence el **día 5 de cada mes**. Vencido ese plazo sin pago, la obligación debe quedar en estado de mora, salvo que exista una fecha excepcional previamente autorizada por ESSERI para esa familia.

Actualmente:

* Hasta el día 5: valor normal.
* Después del día 5 y hasta el 15: penalidad del 20%.
* Después del 15 y hasta el 30: penalidad del 30%.
* Si pasa al mes siguiente, continúa como deuda vencida con las penalidades correspondientes.

Por lo tanto, el sistema debe tomar el vencimiento configurado para cada obligación y cambiar automáticamente su estado cuando vence.

**6. ¿Cuál es la estructura académica actual? Niveles, años, divisiones y materias de cada año/división.**

Los niveles actuales son:

* Nivel Inicial.
* Nivel Primario.
* Nivel Secundario.

La estructura del sistema debería ser:

**Nivel → Año/Sala → División/Orientación → Materias/Talleres → Docentes.**

El detalle de años/salas, divisiones, materias y docentes se los vamos a entregar como tabla maestra para la carga inicial, ya que esa información no está detallada en los documentos administrativos enviados.

**7. Para un alumno nuevo, ¿cuáles son exactamente las etapas que siguen antes de que quede inscripto?**

Para el sistema queremos manejar el siguiente circuito:

**Consulta/Lead → Entrevista → Postulación → Evaluación/Aprobación → Reserva de vacante/Matrícula → Documentación y contrato → Inscripción confirmada/Alumno activo.**

El alumno no debe considerarse definitivamente inscripto solamente por haber realizado una consulta o entrevista. Debe existir una aprobación y luego completarse las condiciones de matriculación correspondientes.

Cada etapa debe quedar registrada con fecha, estado y responsable.

**8. Cuando aprueban una admisión, ¿qué debería pasar después?**

Sí. Queremos que la aprobación de una admisión dispare el workflow automáticamente.

Una vez aprobada:

**Crear persona/alumno → crear/vincular familia y responsables → asignar responsable económico → generar inscripción → generar cargo de matrícula/reserva → solicitar/validar documentación y contrato → registrar pago → confirmar inscripción → enviar comunicación de bienvenida.**

La creación puede ser automática, pero la inscripción debe quedar definitivamente confirmada cuando se cumplan las condiciones administrativas/documentales y de pago correspondientes.

Todo el proceso debe quedar trazado.

**9. Cuando un alumno falta, ¿el docente solamente marca presente/ausente y después la familia presenta la justificación? ¿Quién aprueba o rechaza esa justificación?**

Sí. El docente registra la asistencia de la clase: **presente, ausente o tardanza**.

Ante una ausencia, el sistema notifica automáticamente a la familia y permite que esta informe el motivo y, cuando corresponda, adjunte documentación.

La justificación no debe ser aprobada automáticamente por el docente. Debe quedar pendiente de validación por el **rol institucional autorizado (Secretaría/Dirección según corresponda)**.

El sistema debe conservar tanto el registro original de ausencia como la justificación posterior.

**10. ¿Qué tipos de justificación de inasistencia manejan? ¿Permiten adjuntar certificados o archivos?**

Sí, necesitamos permitir archivos adjuntos.

Como categorías iniciales:

* Enfermedad.
* Certificado médico.
* Turno/estudio médico.
* Viaje familiar.
* Motivo familiar/personal.
* Actividad autorizada por ESSERI.
* Otro.

El listado debe ser configurable.

La familia debe poder adjuntar certificados/documentación y el sistema debe registrar fecha de presentación, archivo, motivo, estado de validación y quién lo validó.

**11. Cuando un alumno falta, ¿a quién se le debería enviar la notificación?**

La notificación debe enviarse a **todos los responsables parentales habilitados para recibir comunicaciones del alumno**, no solamente al responsable económico.

El responsable económico es una condición administrativa y no debe determinar por sí solo quién recibe comunicaciones académicas o de asistencia.

**12. ¿Una orden de compra puede agrupar varias solicitudes de compra o cada solicitud genera su propia orden?**

Una orden de compra **puede agrupar varias solicitudes de compra**, siempre que corresponda al mismo proveedor y resulte compatible agruparlas.

Cada solicitud original debe conservar su ID y quedar vinculada a la orden de compra para mantener trazabilidad.

Una solicitud no necesariamente debe generar una orden independiente.

**13. Cuando reciben una compra, ¿cómo registran actualmente la recepción?**

Para el nuevo sistema queremos una recepción completa, no solamente un estado “recibida”.

Debe registrar:

* Fecha de recepción.
* Productos/servicios recibidos.
* Cantidad pedida.
* Cantidad recibida.
* Recepción total o parcial.
* Diferencias/faltantes.
* Observaciones.
* Responsable que recibe.
* Orden de compra relacionada.
* Posibilidad de adjuntar remito/documentación.

Una recepción parcial debe dejar pendiente automáticamente la cantidad restante.

**14. ¿Tienen actualmente algún catálogo/listado de productos y servicios que suelen comprar o habría que armarlo desde cero?**

Tenemos información de proveedores y compras, pero no un catálogo único y normalizado listo para utilizar como maestro del nuevo sistema.

Por lo tanto, hay que **construir/normalizar el catálogo inicial** a partir de la información existente.

Cada producto/servicio debería tener un ID propio y poder relacionarse con uno o varios proveedores, categorías, precios históricos y compras.

**15. Cuando ocurre una alerta importante, por ejemplo una deuda o un error en una automatización, ¿alcanza con mostrarla en el panel de Dirección o quieren además recibir un aviso activo por email?**

Queremos **ambas cosas**.

Toda alerta debe quedar registrada y visible en el dashboard, pero las alertas relevantes/críticas deben además generar una notificación activa por email al responsable correspondiente.

El nivel de criticidad y los destinatarios deben ser configurables.

**16. ¿Qué acciones les gustaría que el sistema haga automáticamente además de enviar avisos?**

Queremos que las automatizaciones puedan, según las reglas de cada proceso:

* Cambiar estados.
* Crear tareas y asignar responsables.
* Generar cargos/facturas.
* Aplicar vencimientos y penalidades.
* Registrar pagos y rechazos.
* Actualizar cuentas corrientes.
* Generar recordatorios.
* Escalar casos por falta de respuesta.
* Crear registros relacionados entre módulos.
* Generar órdenes/sugerencias de compra cuando corresponda.
* Actualizar dashboards y métricas.
* Generar comunicaciones.
* Registrar cada acción en el historial/auditoría.

Las decisiones sensibles, disciplinarias, legales o excepciones económicas deben mantener intervención/aprobación humana.

**17. Si una persona tiene más de un rol, por ejemplo es docente y además padre/madre, ¿quieren que use una sola cuenta y pueda cambiar entre los dos perfiles?**

Sí.

Queremos **una única identidad/cuenta por persona**, a la cual se le puedan asignar múltiples roles.

Por ejemplo, una persona puede ser simultáneamente docente y responsable de un alumno. Al ingresar debe poder acceder a las funciones correspondientes a cada rol, respetando estrictamente sus permisos.

No queremos duplicar a la misma persona en la base por tener diferentes roles.

**18. ¿Además de Dirección, Administración, Docente y Familia hay algún otro perfil que necesiten sí o sí?**

Sí. Como mínimo el sistema debe contemplar:

* Dirección.
* Administración.
* Docente.
* Familia/Responsable.
* Secretaría.
* Coordinación Académica.
* Equipo de Bienestar/Orientación.
* Admisiones/Comercial.
* Compras.
* Administrador del sistema.

Los permisos deben ser configurables por rol y, cuando corresponda, por módulo o tipo de información.

**19. Datos de ejemplo para configurar el sistema**

Sí. Vamos a entregar información real o anonimizada para realizar la configuración y las pruebas iniciales.

Vamos a preparar:

* Niveles.
* Años/salas.
* Divisiones/orientaciones.
* Materias.
* Docentes.
* Alumnos/familias de prueba.
* Conceptos de cobro.
* Métodos de pago.
* Proveedores.
* Productos/servicios habituales.

La idea es que estos datos permitan probar los workflows completos con casos representativos antes de pasar a producción.

**Criterio general para toda la implementación**

Siempre que sea posible, necesitamos que las reglas de negocio sean **parametrizables y no queden hardcodeadas**: vencimientos, porcentajes de penalidad, conceptos de cobro, estados, tipos de justificación, roles, destinatarios, alertas, niveles de aprobación y automatizaciones.

También necesitamos trazabilidad: cada modificación o acción relevante debe registrar **qué ocurrió, cuándo, quién la realizó —usuario o automatización— y cuál fue el resultado**.

Saludos.