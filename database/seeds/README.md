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

## `04_seed_demo.py` — datos ficticios para una demo local

Este seed es opcional y manual: crea familias, alumnos, estructura académica, asistencias,
admisiones, reglas/facturas/pagos y compras de ejemplo. **No reemplaza los catálogos canónicos
ni se ejecuta al levantar Docker.**

Requiere haber ejecutado los tres seeds canónicos y una confirmación explícita. Nunca correrlo
contra producción.

```bash
cd backend
source venv/bin/activate
ESSERI_DEMO_SEED_ENABLED=true python ../database/seeds/04_seed_demo.py
```

Con Docker:

```bash
cd infra
docker compose exec -e ESSERI_DEMO_SEED_ENABLED=true backend python /database/seeds/04_seed_demo.py
```

La cuenta creada es `demo.admin@esseri.local`; la contraseña por defecto es
`EsseriDemo2026!`. Puede reemplazarse solo para la carga con `ESSERI_DEMO_PASSWORD`.
El script rechaza `ENVIRONMENT=production`/`prod` y es idempotente para sus propias claves demo.

## `00_bootstrap_admin.py` — no es un catálogo

Va aparte de los tres de arriba: no precarga un catálogo del diccionario, crea el **primer usuario administrador** para que alguien pueda entrar al sistema (RF-27). El login rechaza a cualquiera que no esté ya en `usuario`, y los endpoints que crean usuarios están protegidos — sin esta fila inicial nadie puede loguearse. Es el equivalente al `createsuperuser` de Django.

```bash
python ../database/seeds/00_bootstrap_admin.py tu-email@ejemplo.com
```

Pide la contraseña por consola; en entornos no interactivos toma `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` de `backend/.env`. Requiere que `01_seed_grupo_a.py` haya corrido antes (es el que precarga el rol *administrador del sistema*). Idempotente: si el email ya existe, no toca nada.

## Pendiente

- **Grupo C restante**: transcribir `ANIO`/`DIVISION`/`MATERIA` y `PRODUCTO_SERVICIO` cuando ESSERI entregue la tabla maestra real (pregunta pendiente #17 del diccionario) — no antes.
