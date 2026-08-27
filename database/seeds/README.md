# `database/seeds/`

Scripts o archivos de carga inicial: catálogos que el sistema necesita para funcionar (niveles educativos, roles, métodos de pago, etc.), según lo documentado en `docs/diccionario-de-datos-esseri.md` (sección "Tablas Catálogo — Datos a Precargar").

El diccionario clasifica los catálogos en 3 grupos según qué tan segura es la carga:

| Grupo | Estado acá | Por qué |
|---|---|---|
| **A** — confirmado por RF o por el cliente | **Cargado.** `grupo-a.yaml` + `01_seed_grupo_a.py` | `ROL` (10), `TIPO_EVENTO` (7), `METODO_PAGO` (4), `CONCEPTO_COBRO` (10), `MOTIVO_JUSTIFICACION` (7), `REGLA_PENALIDAD` (3) — corridos contra Postgres local, verificados por conteo. |
| **B** — propuesta del equipo, validada informalmente (no por ESSERI) | **Cargado.** `grupo-b.yaml` + `03_seed_grupo_b.py` | `PERMISO` (38 filas) + `ROL_PERMISO` (87 vínculos) + `CAMPO_EVENTO` (21). Matriz rol × módulo × acción acotada a propósito — más fácil sumar un permiso después que sacar uno de más. Editable después vía el futuro ABM de roles/permisos, no volviendo a correr el seed. |
| **C** — dato real de ESSERI | `NIVEL_EDUCATIVO` (3 valores) **cargado** vía `02_seed_grupo_c.py`. El resto (`ANIO`/`DIVISION`/`MATERIA`, `PRODUCTO_SERVICIO`) **sigue bloqueado**. | **Corrección sobre el diccionario**: dice que "el equipo ya recibió la tabla maestra", pero `docs/aclaraciones-cliente-esseri.md` (pregunta 19) lo dice en futuro ("vamos a entregar/preparar") — todavía no llegó. Solo los 3 niveles (Inicial/Primario/Secundario) están confirmados con nombre concreto (pregunta 6); años, divisiones, materias, docentes y catálogo de productos siguen sin entregar — no inventarlos. |

## Cómo correr los scripts ya disponibles

Requiere Postgres corriendo (`infra/docker-compose.yml`, servicio `postgres`) y `backend/.env` configurado.

```bash
cd backend
source venv/bin/activate
python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py   # requiere que 01 ya haya corrido
```

Los tres son idempotentes — correrlos de nuevo no duplica filas.

## Pendiente

- **Grupo C restante**: transcribir `ANIO`/`DIVISION`/`MATERIA` y `PRODUCTO_SERVICIO` cuando ESSERI entregue la tabla maestra real (pregunta pendiente #17 del diccionario) — no antes.
