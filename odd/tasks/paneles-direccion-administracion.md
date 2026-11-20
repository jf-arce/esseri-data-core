# Separación funcional de paneles Dirección / Administración

Objective: separar autorización y contenido de `/panel` (Dirección) y `/admin` (Personal Administrativo), corregir el cálculo de los indicadores existentes y completar RF-31 sin tocar el modelo de datos.
Branch: feat/paneles-rol (desde `main`). Delivery: feature-branch-chain.
Verification: `backend/venv/bin/pytest` focalizado + Ruff; frontend Vitest focalizado + ESLint + build.

## Specs

S1. Dirección conserva los indicadores RF-31 y completa "tareas pendientes/escaladas" (`TAREA WHERE estado IN ('pendiente','escalada')`).
S2. Dirección conserva gráficos financiero y de asistencia, altas y bajas, actividad reciente y desgloses.
S3. Dirección suma una sección compacta de "situaciones para revisar" con justificaciones pendientes, sugerencias de IA pendientes y workflows con errores. User: "no convertir todas las justificaciones ordinarias ni todos los errores técnicos en tareas que Dirección necesariamente deba resolver."
S4. Administración conserva sus accesos rápidos y suma exactamente tres indicadores: cantidad de facturas vencidas, monto cobrado durante el mes y cantidad de solicitudes de compra pendientes. Cada uno abre el módulo cuando el rol tiene permiso.
S5. Administración no suma gráficos. Suma "Requiere tu atención" y "Actividad reciente" reutilizando las consultas y componentes existentes, y una fila de justificaciones pendientes; no se crean endpoints ni bandejas nuevas. Cada KPI abre su módulo ya filtrado.
S13. Las justificaciones pendientes las resuelve Administración, no Dirección: el permiso tipado se mueve en la matriz y la ruta de la bandeja deja de exigir `academico.leer`.
S14. La actividad reciente enlaza al registro exacto cuando el feed trae `entidad_id` (factura vencida → ficha de la factura). "Workflows con errores" cuenta ejecuciones fallidas, no reglas, para coincidir con la bandeja de ejecuciones.
S15. "Sugerencias de IA" no aparece en "Situaciones para revisar".
S6. La autorización de ambos paneles se separa en backend: `/panel-admin/indicadores-direccion` y `/panel-admin/actividad-reciente` quedan restringidos a roles de Dirección; `/panel-admin/evolucion-financiera` conserva `facturacion.leer` porque alimenta ambos paneles.
S7. La deuda se calcula desde `cuenta_corriente_service` (libro `Movimiento` debe/haber), sin duplicar la regla y sin sumar listas paginadas.
S8. Las fechas operativas de los indicadores usan la fecha argentina (`fecha_operativa_argentina`), no `date.today()`.
S9. El ciclo lectivo global se aplica solo a los indicadores que tienen ciclo: deuda (Factura→Inscripcion), inasistencias (Asistencia→Inscripcion) y altas/bajas (Inscripcion). No se aplica a `alumnos_activos`, solicitudes ni tareas.
S10. "Facturas vencidas" usa saldo impago + `fecha_vencimiento < fecha_referencia`, no `Factura.estado` (columna potencialmente desactualizada).
S11. Todo enlace de detalle debe abrir una pantalla que el rol pueda consultar; ningún bloque se muestra sin permiso.
S12. Sin migraciones, sin cambios de modelo, sin permisos nuevos, sin datos simulados en producción.

## Tasks

- T1 | S6 | inline | Autorización por rol en backend + tests. RED: 200 en indicadores para Administración; GREEN: 403 y suite panel_admin 20 tests.
- T2 | S7-S10 | inline | Deuda canónica, fecha operativa, tareas y ciclo en `panel_admin`. RED: `total_deuda` inexistente y deuda vieja 60 vs libro 70; GREEN: 25 tests de panel + 224 de facturación.
- T3 | S4 | inline | Endpoint de indicadores de Administración + ciclo en `/deudas/familias`. Tests: bloques por permiso, 403 de Dirección, semántica saldo+fecha.
- T4 | S1-S3,S11 | inline | Frontend Dirección: quinto indicador, etiquetas, ciclo y situaciones para revisar. Verificado: 48 tests del módulo, suite completa 1314, ESLint y build.
- T5 | S4-S5,S11 | inline | Frontend Administración: tres indicadores sobre endpoints existentes; bloques nulos ocultos.
- T6 | S12 | inline | Verificación: `test_sin_permiso_de_workflows_solo_se_ven_las_tareas_propias` cubre la autorización de `/workflows/tareas` para Administración; no requiere cambios.

## Log

L1. Request verbatim (decisiones finales): "Vamos a avanzar con tu propuesta de distribución, realizando estos ajustes finales: Panel Dirección (`/panel`): Conservar los indicadores existentes de RF-31, completar tareas pendientes/escaladas y corregir los cálculos inconsistentes. Mantener los gráficos financieros y de asistencia, altas y bajas, actividad reciente y los desgloses útiles. Agregar una sección compacta de situaciones para revisar, reutilizando información de justificaciones, sugerencias de IA y workflows. Importante: no convertir todas las justificaciones ordinarias ni todos los errores técnicos en tareas que Dirección necesariamente deba resolver. Panel Administrativo (`/admin`): Conservar los accesos rápidos implementados y agregar solamente tres indicadores: 1. Cantidad de facturas vencidas. 2. Monto cobrado durante el mes. 3. Cantidad de solicitudes de compra pendientes. Los indicadores deben permitir abrir el módulo correspondiente cuando el rol tenga permiso. No agregar gráficos complejos, bandejas universales ni nuevos procesos. Correcciones técnicas obligatorias: Separar la autorización real de ambos paneles en backend. Reutilizar `cuenta_corriente_service` como fuente de verdad para la deuda, respetando el cálculo de saldos y las reglas del dominio. Corregir las fechas operativas para Argentina. Incorporar el ciclo lectivo global a los indicadores que correspondan. Verificar la autorización real de `/workflows/tareas` para Administración. Verificar que las consultas de facturas vencidas utilicen la semántica correcta del estado, no una condición potencialmente desactualizada. Verificar que los enlaces de detalle sean accesibles para el rol correspondiente. Restricciones: Respetar ARCHITECTURE.md y DESIGN.md. Mantener el diseño visual existente de ESSERI. Reutilizar componentes, hooks y servicios. Evitar migraciones y cambios de modelo si no son imprescindibles. No duplicar reglas de negocio. No introducir indicadores ficticios ni datos simulados en producción."

L2. Evidencia inicial: `panel_admin/service.py` calcula deuda como `SUM(Factura.monto_total) - SUM(Pago aprobado)`; su docstring ya declara que debe migrar al saldo de `CuentaCorriente`/`Movimiento`. `cuenta_corriente_service` no tiene total agregado. `familias_en_mora` usa una definición propia distinta de `listar_deuda_por_familia(estado='vencida')`. `inasistencias_hoy` usa `date.today()`. `TAREA` existe con estados `pendiente/en_progreso/completada/escalada`. `/workflows/tareas` usa `AlcanceTareas`: sin `workflows.leer` solo devuelve las propias (Administración no tiene `workflows.leer`). Ambos paneles comparten `panel_administrativo.leer`; la separación actual es solo `RoleRoute` en frontend.

L3. Decisión: `requiere_rol` en `auth/dependencies.py` con códigos `direccion` / `administracion` / `administrador_del_sistema` (los códigos salen de `slug_ascii(nombre)`). No se toca la matriz de permisos.

L4. Decisión: `total_deuda()` en `cuenta_corriente_service` construido sobre el mismo subquery de saldo por factura que `listar_deuda_por_familia`; `familias_en_mora` = familias distintas con saldo vencido > 0; `facturas_vencidas` = facturas con saldo > 0 y vencimiento anterior a la referencia.

L5. Límite conocido: el detalle de deuda del hover usa `/facturas/deudas/familias`; se le agrega `ciclo_lectivo` opcional para que el detalle no contradiga al indicador.

L6. Implementado T1: `requiere_rol` en `auth/dependencies.py`; `indicadores-direccion` y `actividad-reciente` exigen rol `direccion`/`administrador_del_sistema` además de `panel_administrativo.leer`. `evolucion-financiera` queda con `facturacion.leer` porque alimenta los dos paneles. Tests: 403 para Administración, 200 para Dirección y administrador del sistema.

L7. Implementado T2: `_saldos_por_factura` + `total_deuda` en `cuenta_corriente_service`; `panel_admin` usa el libro, fecha operativa argentina, quinto indicador (`tareas_pendientes`/`tareas_escaladas`) y filtro de ciclo. `listar_deuda_por_familia` acepta `ciclo_lectivo` sin duplicar la consulta. Tests: equivalencia total vs lista por familia, semántica saldo+fecha para vencidas, ciclo sin tocar alumnos activos, fecha operativa con monkeypatch, tareas por estado.

L8. Implementado T3-T5: `/panel-admin/indicadores-administracion` con bloques por permiso de módulo (`None` sin permiso); `/deudas/familias` acepta `ciclo_lectivo`; frontend: quinto indicador con enlace a `/workflows/tareas`, hero "Deuda pendiente" con vencida en el desglose, "altas nuevas", sección "Situaciones para revisar" con justificaciones/sugerencias/workflows, tres tarjetas en `/admin`, `useConsulta` extraído a `use-recurso.ts`.

L9. Verificación observada: backend panel_admin 31 tests + facturación 224; frontend 174 archivos / 1314 tests; ESLint sin hallazgos; `tsc -b && vite build` OK con el aviso preexistente de tamaño de bundle. `/workflows/tareas` ya está cubierto por `tests/workflows/test_tareas.py::test_sin_permiso_de_workflows_solo_se_ven_las_tareas_propias` (ruta de la secretaría: solo propias, ajenas 404), así que no requiere cambios.

L10. Suite completa de backend: 2114 passed, 40 skipped (9m42s). Prueba en navegador contra una base demo aislada (`esseri_paneles_preview`, puerto 8110): login demo.admin, `/panel` con deuda $7.080.000 y 12 familias en mora, ciclo 2025 cambia la deuda a $0,00 sin tocar alumnos activos ni tareas, `/admin` con 30 facturas vencidas y 3 solicitudes. El cambio de ciclo destapó un anidado HTML inválido preexistente en `Estado` (`<p>` envolviendo el bloque de `VacioBueno`); se corrigió el wrapper a `<div>` y se verificó que la consola queda sin errores. Límite conocido: el gráfico financiero sigue siendo por año calendario y no acompaña al ciclo seleccionado.

L11. Corrección verbatim: "para mi lo de requiere tu atencion ya ctividad reciente deberia aparecer en el administrativo tambien". Se extrajo `PanelActividadReciente` y `Panel` a componentes propios; `/admin` suma `AtencionDireccion`, el feed compartido y el permiso de rol para `actividad-reciente` (con las categorías todavía filtradas por módulo).

L12. Corrección verbatim: "el modulo sugerencias de ia que ni aparezca en situaciones para revisar, despues cuando apretas en ver ejeciuciones de workflows con errores q ue ya te lo filten". Se quitó la fila de IA y el link de ejecuciones abre con `?estado=fallido`.

L13. Corrección verbatim: "en el de adminstrtatiov cuando apretas en solicitudes pendientes, que ya te la filtre de una". `/solicitudes-compra` ahora lee `?estado=` y el KPI enlaza con `estado=pendiente`.

L14. Corrección verbatim: "las justificaciones pendientes las tiene que aprobar administracion no direccion". Matriz: se quitó `academico.actualizar:justificaciones` de dirección y se agregó a administración. La ruta de la bandeja se movió fuera del paraguas de `academico.leer` para no ampliar permisos de lectura; el panel de Dirección ya no muestra la fila y el de Administración sí. El administrador del sistema no necesitó un permiso tipado nuevo: su `academico.actualizar` sin tipo ya satisface los pedidos tipados (`_condicion_codigo`), así que una entrada extra habría sido redundante.

L15. Corrección verbatim: "el ver detalle de la factura reciente, que te lleve a esa factura". El feed expone `entidad_id`; una factura vencida enlaza a `/facturacion/{id}` y el resto conserva el link al módulo.

L16. Pregunta/corrección verbatim: "porque aparecen workflow con errores 2 y en ver ejecuciones me muestra como 20". `con_errores` cuenta reglas con fallas en 7 días; la bandeja cuenta ejecuciones. El badge pasó a `actual.fallido` (30 días); verificado en el preview: badge 60 y total de la bandeja 60, con `con_errores` seguía en 2.

L17. Pendiente anotado para la base demo (verbatim: "anotalo el punto 3 para cuando creemos la base para la demo"). Si la base demo se crea **desde cero** (migraciones + `01`, `02`, `03`, `06` + demo), la matriz nueva ya deja el permiso tipado `academico.actualizar:justificaciones` en `administracion` y `secretaria`, y Dirección no lo tiene: no hay nada que revocar. El administrador del sistema no aparece en ese código tipado pero igual resuelve la bandeja por su `academico.actualizar` sin tipo. Si en cambio se **restaura o copia** una base sembrada antes de este cambio, `03_seed_grupo_b.py` no revoca: hay que quitarle el permiso a `dirección` desde el ABM de roles. Verificación rápida: `select r.codigo from rol r join rol_permiso rp on rp.rol_id=r.id join permiso p on p.id=rp.permiso_id where p.codigo='academico.actualizar:justificaciones';` no debe devolver `direccion`.

L18. Cierre de verificación: suite completa de backend **2116 passed, 40 skipped** (10m48s); frontend 1318; ESLint y build en verde. Preview aislado (`5190`/`8110`, base `esseri_paneles_preview`) con los flujos nuevos verificados en navegador. Sin pendientes de implementación.
