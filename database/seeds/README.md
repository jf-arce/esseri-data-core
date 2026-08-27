# `database/seeds/`

Scripts o archivos de carga inicial: catálogos que el sistema necesita para funcionar (niveles educativos, roles, métodos de pago, etc.), según lo documentado en `docs/diccionario-de-datos-esseri.md` (sección "Tablas Catálogo — Datos a Precargar").

El diccionario clasifica los catálogos en 3 grupos según qué tan segura es la carga:

| Grupo | Estado acá | Por qué |
|---|---|---|
| **A** — confirmado por RF o por el cliente | `grupo-a.yaml` — datos ya cargados, **script de inserción todavía pendiente** | `ROL` (10 valores), `TIPO_EVENTO`, `METODO_PAGO`, `CONCEPTO_COBRO`, `MOTIVO_JUSTIFICACION` y `REGLA_PENALIDAD` están confirmados por RF o por las aclaraciones directas del cliente (`docs/aclaraciones-cliente-esseri.md`), pero los modelos SQLAlchemy (`auth/models.py`, `workflows/models.py`, `facturacion/models.py`, `academico/models.py`) todavía son placeholders vacíos — no hay clase para insertar. Cuando existan, un script acá (ej. `01_roles.py`) debe leer este YAML e insertar vía `SessionLocal` de `src/database.py`, nunca con SQL a mano. `METODO_PAGO` y `ROL` pasaron acá desde el Grupo B una vez que el cliente confirmó los valores — ver diccionario. |
| **B** — propuesta razonable, validar con ESSERI | No cargado | `PERMISO`, `CAMPO_EVENTO` — valores propuestos por el equipo pero sin confirmar (ver pregunta pendiente #4 sobre roles con permisos conflictivos y la matriz rol→permiso en el diccionario, que ahora crece porque son 10 roles en vez de 4). |
| **C** — dato real de ESSERI | No cargado | `NIVEL_EDUCATIVO`, `ANIO`, `DIVISION`, `MATERIA` — estructura curricular real. El cliente ya confirmó la jerarquía (Nivel → Año/Sala → División/Orientación → Materias → Docentes) y entregó la tabla maestra con los valores concretos (ver `docs/aclaraciones-cliente-esseri.md`) — falta transcribirla acá. `PRODUCTO_SERVICIO` también queda en este grupo: el cliente confirmó que va a entregar el catálogo real de proveedores/compras (pregunta pendiente #17), todavía no recibido. |

Orden de carga una vez que haya script: Grupo A primero (sin dependencias entre sí, salvo `REGLA_PENALIDAD` que depende de `CONCEPTO_COBRO` ya cargado), después B (algunos, como `CAMPO_EVENTO`, dependen de que `TIPO_EVENTO` ya esté cargado), C al final o en paralelo (no tiene FKs hacia A/B).
