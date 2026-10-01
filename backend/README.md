# ESSERI Data Core — Backend

API en FastAPI + SQLAlchemy + Alembic. Ver `ARCHITECTURE.md` en la raíz del repo para la explicación completa de la estructura (`src/<modulo>/`, convenciones, testing).

## Requisitos

- Python 3.14 (o compatible; el proyecto se armó con Python 3.14.7 vía [mise](https://mise.jdx.dev/)).
- PostgreSQL corriendo localmente (o vía `infra/docker-compose.yml` desde la raíz del repo).

## Setup local (sin Docker)

Con Postgres ya corriendo (local o `docker compose up -d postgres` desde `infra/`):

```bash
cd backend
cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, etc.
./setup.sh                      # venv + deps + migraciones + seeds + levanta el servidor
```

`setup.sh` es idempotente — correrlo de nuevo no rompe nada, solo salta lo que ya esté hecho. Si preferís los pasos manuales (o `setup.sh` falla y querés diagnosticar), son los que siguen abajo.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate en Windows
pip install -r requirements/dev.txt

cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, etc.
```

## Migraciones (Alembic)

Nunca se escribe SQL a mano en `database/` — todo cambio de esquema se genera con Alembic desde acá:

```bash
alembic revision --autogenerate -m "descripción del cambio"
alembic upgrade head
```

`alembic/env.py` ya está configurado para tomar la URL de conexión de `src.config.settings` (que lee `.env`) y para importar el `models.py` de cada módulo (los 8 que tienen entidades propias — `auditoria` y `panel_admin` no tienen `models.py`, ver `ARCHITECTURE.md`) — no hace falta tocarlo salvo que se agregue un `models.py` nuevo.

## Seeds (catálogos iniciales)

Después de migrar, la base queda vacía — algunos módulos no funcionan sin catálogos mínimos (`ROL`, `METODO_PAGO`, `CONCEPTO_COBRO`, etc.). Ver `database/seeds/README.md` para el detalle completo; scripts disponibles hoy:

```bash
python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py
```

Para cargar datos ficticios de recorrido completo en una demo local, ejecutar manualmente:

```bash
ESSERI_DEMO_SEED_ENABLED=true python ../database/seeds/04_seed_demo.py
```

No se incluye en el arranque automático de Docker y está bloqueado cuando
`ENVIRONMENT=production` o `prod`. Ver `database/seeds/README.md`.

## Login con Google + primer usuario (RF-27)

Documentado aparte, en `docs/auth-oauth-google.md` — abarca todo el módulo Auth (backend +
frontend), no solo cómo levantar el backend. Ahí está el flujo de OAuth, cómo configurar las
credenciales de Google, y cómo crear el primer usuario administrador
(`database/seeds/00_bootstrap_admin.py`) para poder loguearse.

## Autorización por permisos (RF-30)

Para proteger un endpoint según módulo y acción, usar `requiere_permiso(...)` de
`src.auth.dependencies` en vez de (o además de) `UsuarioAutenticado` — devuelve el `Usuario`
igual que `UsuarioAutenticado`, así que se puede usar donde ya se usa esa:

```python
from typing import Annotated

from fastapi import Depends

from src.auth.constants import ACCION_LEER, MODULO_ACADEMICO
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario

PuedeLeerAcademico = Annotated[Usuario, Depends(requiere_permiso(MODULO_ACADEMICO, ACCION_LEER))]


@router.get("/materias")
def listar_materias(usuario: PuedeLeerAcademico, db: DbSession) -> list[MateriaRead]:
    ...
```

`modulo` y `accion` tienen que ser los strings exactos de `src.auth.constants` (coinciden con
`database/seeds/grupo-b.yaml`). 401 sin sesión, 403 si la sesión no alcanza. El ABM de roles y
permisos vive en `/auth/roles`, `/auth/permisos` y `/auth/usuarios/{id}/roles` — ver
`src/auth/router.py`.

## Levantar el servidor

```bash
uvicorn src.main:app --reload
```

Docs interactivas en `http://localhost:8000/docs`.

### Facturación recurrente automática

El backend recupera períodos pendientes al arrancar y luego corre diariamente a
`FACTURACION_HORA_EJECUCION` en la zona `America/Argentina/Buenos_Aires` (por defecto, `00:05`).
El job no usa una fecha global de emisión: cada regla activa con
`modo_generacion = automatica` define su propio `dia_generacion`. Si una corrida no se completa,
el período sigue pendiente y se reintenta sin duplicar cargos.

Para deshabilitar temporalmente el job, configurar
`FACTURACION_AUTOMATICA_HABILITADA=false`. El flujo manual “Generar ahora” permanece disponible
como respaldo con previsualización.

### Workflows: eventos y despacho

Los módulos avisan al motor de workflows con `emit_event()` (`src/workflows/eventos_service.py`),
que guarda un hecho de negocio en `EVENT_LOG` con estado `pendiente`:

```python
from src.workflows.eventos_service import emit_event

emit_event(
    db,
    tipo="factura.vencida",          # nombre del catálogo `tipo_evento` (ver TipoEventoNombre)
    entidad="factura",
    entidad_id=factura.id,
    payload={"dias_vencido": 6, "monto_deuda": factura.monto_total},
    usuario_id=None,                 # None = lo originó el sistema
)
```

- No hace `commit`: el evento se confirma con la transacción del llamador, igual que `log_audit()`.
- `entidad` tiene que ser la que corresponde al tipo (`ENTIDAD_POR_EVENTO` en `constants.py`, por
  ejemplo `factura.vencida` → `"factura"`, `pago.registrado` → `"pago"`); si no, lanza
  `EntidadDeEventoInvalida`. Las acciones de las reglas operan sobre esa entidad.
- `payload` debería traer los campos que el catálogo declara para ese tipo (`campo_evento`, ver
  `database/seeds/grupo-b.yaml`). Si falta alguno se loggea un warning, el evento se registra igual.
  No incluir datos sensibles innecesarios (RNF-15).
- Un `tipo` que no esté en `tipo_evento` lanza `TipoEventoNoRegistrado`. Para sumar un evento nuevo:
  agregarlo a `TipoEventoNombre` y `ENTIDAD_POR_EVENTO` (`src/workflows/constants.py`), a
  `database/seeds/grupo-a.yaml` y sus campos a `grupo-b.yaml`.

**Cómo fluye un evento**

1. El módulo dueño del hecho (facturación, académico, etc.) llama a `emit_event()` y después hace su
   `commit`. Eso es todo lo que le toca: no espera ni se entera de lo que pase después.
2. `emit_event()` solo inserta la fila en `EVENT_LOG` con estado `pendiente`, dentro de la
   transacción del llamador. Si esa operación se revierte, el evento desaparece con ella, así que
   nunca queda registrado algo que no pasó. El despachador recién ve el evento cuando el llamador
   confirma.
3. El despachador (`procesar_eventos_pendientes`) corre solo dentro del backend: al arrancar la app
   se levanta una tarea en segundo plano (`despacho_job.py`) que cada
   `WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS` (30 por defecto) toma los eventos `pendiente`, del más
   viejo al más nuevo, y los procesa de a uno, hasta 100 por pasada. Nadie del equipo lo llama. Se
   puede apagar con `WORKFLOWS_DESPACHO_HABILITADO=false` y forzar una pasada con
   `POST /workflows/procesar`.
4. Por cada evento busca las reglas activas de su tipo. Para cada una evalúa su `condicion` contra
   el `payload`: si no se cumple no se crea ninguna ejecución. Si se cumple, revalida el
   `accion_config` contra la allowlist y crea un `WORKFLOW_EXECUTION`. Si la regla tiene
   `requiere_aprobacion_humana`, la ejecución queda `pendiente` y no se ejecuta nada. Si no, corre
   la acción y la ejecución queda `exitoso` o `fallido`. Un evento sin reglas también se marca
   `procesado`.
5. Cada evento se confirma por separado: si uno falla (el evento pasa a `fallido`) no se revierten
   los que ya se procesaron. Una acción que falla no corta las demás reglas del mismo evento.
   Lo mismo vale para una regla que no se puede evaluar (campo ausente o de tipo equivocado en el
   `payload`, config que ya no pasa la allowlist, entidad que no corresponde): su ejecución queda
   `fallido` con el motivo en `error_detail` y las demás reglas siguen.

**Por qué es asíncrono:** así una falla del motor o de n8n no puede romper la operación de negocio
que originó el evento (por ejemplo, el registro de una ausencia), y el estado
`pendiente/procesado/fallido` de `EVENT_LOG` deja registrado qué se procesó y qué falló (los
reintentos son #66). Es el mismo patrón que el job de facturación. El costo es una demora de hasta
`WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS` entre el evento y la ejecución de sus reglas. Con varias
instancias del backend, `FOR UPDATE SKIP LOCKED` evita que dos procesen el mismo evento.

**Estado actual:** ningún tipo de acción tiene ejecutor real (`ACCIONES` en `service.py` está
vacío), así que las reglas sin aprobación humana quedan `fallido` con "acción no implementada"
hasta que se implemente cada una (`notificar` en #68, `crear_tarea`/`escalar_caso` en #89; las que
tocan Facturación o Inscripciones dependen de los servicios de esos módulos).

**Reglas y allowlist de `accion_config`**

`condicion` y `accion_config` son datos, nunca código. Al crear o editar una regla (y de nuevo al
despachar) el backend los valida contra una lista cerrada; lo que no esté declarado se rechaza con
422. `accion_config = null` equivale a `{}`, y lo que se guarda es la config normalizada con sus
defaults.

- **`condicion`**: `{}` (siempre se cumple) o `{"campo", "operador", "valor"}`. `campo` tiene que ser
  un campo del evento de la regla (`GET /workflows/tipos-evento`). Operadores: `==`, `!=`, `>`, `>=`,
  `<`, `<=` para número y fecha (ISO); `==`, `!=`, `contiene` para texto (sin distinguir mayúsculas).
- **`accion_config`**: un modelo por acción en `schemas.py` (`CONFIG_POR_ACCION`), con claves
  extra prohibidas. Los eventos en los que puede usarse cada acción están en `EVENTOS_POR_ACCION`
  (`constants.py`): solo `notificar`, `alerta_interna`, `generar_recordatorio`, `generar_comunicacion`,
  `crear_tarea` y `escalar_caso` valen para cualquier evento; las que escriben sobre la entidad del
  evento o mueven dinero tienen una lista cerrada, y `generar_orden_compra` no se puede configurar
  hasta que Compras emita un evento. Solo las cuatro que arman un mensaje admiten
  `notificacion_template_id`.
- `GET /workflows/tipos-accion` devuelve, por acción, el default de aprobación humana, los eventos
  permitidos, si admite plantilla y el JSON Schema de su config.
- Para habilitar una acción en otro evento, o `cambiar_estado` sobre otra entidad
  (`CAMBIOS_ESTADO_PERMITIDOS`), se edita la constante y se actualiza la nota de `WORKFLOW_RULE` del
  diccionario de datos.

Las reglas se administran en `/workflows/reglas` y el catálogo de eventos con sus campos en
`/workflows/tipos-evento`. Los emails los envía n8n vía el webhook `N8N_WEBHOOK_URL` (ver
`infra/n8n/README.md`).

### Comprobantes y PDF de factura

El detalle de una factura permite registrar pagos parciales o totales. Los comprobantes de métodos
que los requieran se guardan junto al pago en la base de datos; se aceptan PDF, JPG y PNG de hasta
5 MB. La descarga de la factura se genera bajo demanda como PDF, sin almacenar una copia adicional.

## Tests

```bash
pytest
```

Los tests usan una base SQLite en memoria (ver `tests/conftest.py`), no la base de `DATABASE_URL` — así corren sin depender de Postgres. Si el equipo prefiere testear contra un Postgres real, ajustar `TEST_DATABASE_URL` en `tests/conftest.py`.

## Lint y formato

```bash
ruff check src/ tests/
ruff format src/ tests/
```

## Con Docker

Desde la raíz del repo, usar `infra/docker-compose.yml` (levanta Postgres + backend + frontend + n8n juntos, migra y carga seeds automáticamente antes de arrancar `uvicorn`). El build context del backend es la raíz del repo, no `backend/` — necesita copiar también `database/seeds/`. Para buildear solo esta imagen:

```bash
cd ..   # raíz del repo
docker build -f backend/Dockerfile -t esseri-backend .
docker run --env-file backend/.env -p 8000:8000 esseri-backend
```

## Estructura

Un paquete por módulo en `src/<modulo>/` (`router.py`, `schemas.py`, `models.py`, `service.py`, y lo que cada módulo necesite — ver la tabla de "Notas por módulo específico" en `ARCHITECTURE.md`). Lo compartido entre 2+ módulos vive en `src/config.py`, `src/database.py`, `src/models.py` y `src/exceptions.py`.
