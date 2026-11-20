# Separación funcional de paneles Dirección / Administración

Objective: separar autorización y contenido de `/panel` (Dirección) y `/admin` (Personal Administrativo), corregir el cálculo de los indicadores existentes y completar RF-31 sin tocar el modelo de datos.
Branch: feat/paneles-rol (desde `main`). Delivery: feature-branch-chain.
Verification: `backend/venv/bin/pytest` focalizado + Ruff; frontend Vitest focalizado + ESLint + build.

## Specs

S1. Dirección conserva los indicadores RF-31 y completa "tareas pendientes/escaladas" (`TAREA WHERE estado IN ('pendiente','escalada')`).
S2. Dirección conserva gráficos financiero y de asistencia, altas y bajas, actividad reciente y desgloses.
S3. Dirección suma una sección compacta de "situaciones para revisar" con justificaciones pendientes, sugerencias de IA pendientes y workflows con errores. User: "no convertir todas las justificaciones ordinarias ni todos los errores técnicos en tareas que Dirección necesariamente deba resolver."
S4. Administración conserva sus accesos rápidos y suma exactamente tres indicadores: cantidad de facturas vencidas, monto cobrado durante el mes y cantidad de solicitudes de compra pendientes. Cada uno abre el módulo cuando el rol tiene permiso.
S5. Administración no suma gráficos, bandejas universales ni procesos nuevos.
S6. La autorización de ambos paneles se separa en backend: `/panel-admin/indicadores-direccion` y `/panel-admin/actividad-reciente` quedan restringidos a roles de Dirección; `/panel-admin/evolucion-financiera` conserva `facturacion.leer` porque alimenta ambos paneles.
S7. La deuda se calcula desde `cuenta_corriente_service` (libro `Movimiento` debe/haber), sin duplicar la regla y sin sumar listas paginadas.
S8. Las fechas operativas de los indicadores usan la fecha argentina (`fecha_operativa_argentina`), no `date.today()`.
S9. El ciclo lectivo global se aplica solo a los indicadores que tienen ciclo: deuda (Factura→Inscripcion), inasistencias (Asistencia→Inscripcion) y altas/bajas (Inscripcion). No se aplica a `alumnos_activos`, solicitudes ni tareas.
S10. "Facturas vencidas" usa saldo impago + `fecha_vencimiento < fecha_referencia`, no `Factura.estado` (columna potencialmente desactualizada).
S11. Todo enlace de detalle debe abrir una pantalla que el rol pueda consultar; ningún bloque se muestra sin permiso.
S12. Sin migraciones, sin cambios de modelo, sin permisos nuevos, sin datos simulados en producción.

## Tasks

- T1 | S6 | inline | Autorización por rol en backend + tests. RED: 200 en indicadores para Administración; GREEN: 403 y suite panel_admin 20 tests.
- T2 | S7-S10 | inline | Deuda canónica, fecha operativa, tareas y ciclo en `panel_admin`.
- T3 | S4 | inline | Endpoint de indicadores de Administración + ciclo en `/deudas/familias`.
- T4 | S1-S3,S11 | inline | Frontend Dirección: quinto indicador, etiquetas, ciclo y situaciones para revisar.
- T5 | S4-S5,S11 | inline | Frontend Administración: tres indicadores.
- T6 | S12 | inline | Verificación: suites focalizadas, lint, build.

## Log

L1. Request verbatim (decisiones finales): "Vamos a avanzar con tu propuesta de distribución, realizando estos ajustes finales: Panel Dirección (`/panel`): Conservar los indicadores existentes de RF-31, completar tareas pendientes/escaladas y corregir los cálculos inconsistentes. Mantener los gráficos financieros y de asistencia, altas y bajas, actividad reciente y los desgloses útiles. Agregar una sección compacta de situaciones para revisar, reutilizando información de justificaciones, sugerencias de IA y workflows. Importante: no convertir todas las justificaciones ordinarias ni todos los errores técnicos en tareas que Dirección necesariamente deba resolver. Panel Administrativo (`/admin`): Conservar los accesos rápidos implementados y agregar solamente tres indicadores: 1. Cantidad de facturas vencidas. 2. Monto cobrado durante el mes. 3. Cantidad de solicitudes de compra pendientes. Los indicadores deben permitir abrir el módulo correspondiente cuando el rol tenga permiso. No agregar gráficos complejos, bandejas universales ni nuevos procesos. Correcciones técnicas obligatorias: Separar la autorización real de ambos paneles en backend. Reutilizar `cuenta_corriente_service` como fuente de verdad para la deuda, respetando el cálculo de saldos y las reglas del dominio. Corregir las fechas operativas para Argentina. Incorporar el ciclo lectivo global a los indicadores que correspondan. Verificar la autorización real de `/workflows/tareas` para Administración. Verificar que las consultas de facturas vencidas utilicen la semántica correcta del estado, no una condición potencialmente desactualizada. Verificar que los enlaces de detalle sean accesibles para el rol correspondiente. Restricciones: Respetar ARCHITECTURE.md y DESIGN.md. Mantener el diseño visual existente de ESSERI. Reutilizar componentes, hooks y servicios. Evitar migraciones y cambios de modelo si no son imprescindibles. No duplicar reglas de negocio. No introducir indicadores ficticios ni datos simulados en producción."

L2. Evidencia inicial: `panel_admin/service.py` calcula deuda como `SUM(Factura.monto_total) - SUM(Pago aprobado)`; su docstring ya declara que debe migrar al saldo de `CuentaCorriente`/`Movimiento`. `cuenta_corriente_service` no tiene total agregado. `familias_en_mora` usa una definición propia distinta de `listar_deuda_por_familia(estado='vencida')`. `inasistencias_hoy` usa `date.today()`. `TAREA` existe con estados `pendiente/en_progreso/completada/escalada`. `/workflows/tareas` usa `AlcanceTareas`: sin `workflows.leer` solo devuelve las propias (Administración no tiene `workflows.leer`). Ambos paneles comparten `panel_administrativo.leer`; la separación actual es solo `RoleRoute` en frontend.

L3. Decisión: `requiere_rol` en `auth/dependencies.py` con códigos `direccion` / `administracion` / `administrador_del_sistema` (los códigos salen de `slug_ascii(nombre)`). No se toca la matriz de permisos.

L4. Decisión: `total_deuda()` en `cuenta_corriente_service` construido sobre el mismo subquery de saldo por factura que `listar_deuda_por_familia`; `familias_en_mora` = familias distintas con saldo vencido > 0; `facturas_vencidas` = facturas con saldo > 0 y vencimiento anterior a la referencia.

L5. Límite conocido: el detalle de deuda del hover usa `/facturas/deudas/familias`; se le agrega `ciclo_lectivo` opcional para que el detalle no contradiga al indicador.
