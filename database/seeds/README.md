# `database/seeds/`

Scripts o archivos de carga inicial: catálogos que el sistema necesita para funcionar (niveles educativos, roles, métodos de pago, etc.), según lo documentado en `docs/diccionario-de-datos-esseri.md` (sección "Tablas Catálogo — Datos a Precargar").

El diccionario clasifica los catálogos en 3 grupos según qué tan segura es la carga:

| Grupo | Estado acá | Por qué |
|---|---|---|
| **A** — confirmado por RF | `grupo-a.yaml` — datos ya cargados, **script de inserción todavía pendiente** | `ROL` y `TIPO_EVENTO` están confirmados por RF-28/RF-24, pero los modelos SQLAlchemy (`auth/models.py`, `workflows/models.py`) todavía son placeholders vacíos — no hay clase para insertar. Cuando existan, un script acá (ej. `01_roles.py`) debe leer este YAML e insertar vía `SessionLocal` de `src/database.py`, nunca con SQL a mano. |
| **B** — propuesta razonable, validar con ESSERI | No cargado | `METODO_PAGO`, `PERMISO`, `CAMPO_EVENTO` — valores propuestos por el equipo pero sin confirmar (ver preguntas pendientes #10 y la matriz rol→permiso en el diccionario). |
| **C** — dato real de ESSERI | No cargado | `NIVEL_EDUCATIVO`, `ANIO`, `DIVISION`, `MATERIA` — estructura curricular real, no se puede inventar ni proponer. Depende del relevamiento con la institución (pregunta pendiente #11). |

Orden de carga una vez que haya script: Grupo A primero (sin dependencias entre sí), después B (algunos, como `CAMPO_EVENTO`, dependen de que `TIPO_EVENTO` ya esté cargado), C al final o en paralelo (no tiene FKs hacia A/B).
