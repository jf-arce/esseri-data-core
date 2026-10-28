# `database/seeds/`

Scripts o archivos de carga inicial: catálogos que el sistema necesita para funcionar (niveles educativos, roles, métodos de pago, etc.), según lo documentado en `docs/diccionario-de-datos-esseri.md` (sección "Tablas Catálogo — Datos a Precargar").

El diccionario clasifica los catálogos en 3 grupos según qué tan segura es la carga:

| Grupo | Estado acá | Por qué |
|---|---|---|
| **A** — confirmado por RF o por el cliente | **Cargado.** `grupo-a.yaml` + `01_seed_grupo_a.py` | `ROL` (10), `TIPO_EVENTO` (9), `METODO_PAGO` (4), `CONCEPTO_COBRO` (10), `MOTIVO_JUSTIFICACION` (7), `REGLA_PENALIDAD` (3) — corridos contra Postgres local, verificados por conteo. |
| **B** — propuesta del equipo, validada informalmente (no por ESSERI) | **Cargado.** `grupo-b.yaml` + `03_seed_grupo_b.py` | `PERMISO` (41 filas) + `ROL_PERMISO` (99 vínculos) + `CAMPO_EVENTO` (27). Matriz rol × módulo × acción acotada a propósito — más fácil sumar un permiso después que sacar uno de más. Editable después vía el futuro ABM de roles/permisos, no volviendo a correr el seed. |
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

Los tres son idempotentes — correrlos de nuevo no duplica filas. Después de editar `grupo-b.yaml`
(sumar una acción a un rol, por ejemplo) alcanza con volver a correr `03_seed_grupo_b.py`: no
toca los permisos existentes, solo agrega los `Permiso`/`RolPermiso` nuevos.

**Ojo:** el seed nunca *saca* un vínculo `RolPermiso`, solo agrega. Si `grupo-b.yaml` cambia
para que un rol pierda una acción (o la cambie por una variante tipada, como pasó con
`docente` en RF-06: `academico.actualizar` → `academico.actualizar:asistencia`), una base ya
sembrada con el YAML viejo se queda con el vínculo de más — volver a correr el seed no lo
corrige. Esa corrección va en una migración de datos de Alembic (ver
`backend/alembic/versions/58d7c7ac8e3c_corrige_permiso_de_asistencia_del_rol_.py` como
ejemplo), no en el seed ni a mano en cada base.

## `04_seed_demo.py` — datos ficticios para una demo local

Este seed es opcional y manual: crea familias, alumnos, estructura académica, asistencias,
admisiones, reglas/facturas/pagos y compras de ejemplo, y dos reglas de workflow para la mora
(ver abajo). **No reemplaza los catálogos canónicos
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
Cada pago aprobado procesado por el seed registra un único movimiento de haber en la cuenta
corriente. Repetir la carga no duplica ese crédito; los pagos de períodos anteriores que la
carga ya no procesa requieren una reparación explícita, limitada a la base demo.

**Reglas de workflow de la demo (#216).** Sobre `factura.vencida` crea dos reglas que usan el
campo `dias_vencido`: `Mora > 15 días: crear tarea` (`crear_tarea`, tarea para el rol
Administración, con el título "Reclamar la deuda de {{nombre_familia}}") y `Mora > 30 días: escalar caso` (`escalar_caso`, nueva tarea para el rol
Dirección). La segunda nace con aprobación humana: la ejecución queda pendiente hasta que se
apruebe desde el historial de ejecuciones. Con más de 30 días se disparan las dos, y los nombres
hacen que `crear_tarea` se evalúe primero (el motor ordena las reglas por nombre). Se buscan por
nombre: si ya existen, volver a correr el seed no las duplica ni pisa lo editado desde la pantalla.

**Reglas de vencimiento de la demo (#205).** También sobre `factura.vencida`, sin condición (se
disparan con cada evento): `Vencimiento 1: marcar factura vencida` (`aplicar_vencimiento`),
`Vencimiento 2: alerta a Administración` (`alerta_interna`, rol Administración, con la plantilla
`Alerta interna de factura vencida`) y
`Vencimiento 3: aviso a la familia` (`notificar` al responsable económico, con la plantilla
`Aviso de factura vencida`). Las tres son independientes: si la factura no cambia de estado, los
avisos salen igual. La cuarta, `Vencimiento 4: aplicar penalidad por mora` (`aplicar_penalidad`,
#204), registra la penalidad del tramo en la cuenta corriente; nace con aprobación humana, así que
queda pendiente hasta que se apruebe desde el historial de ejecuciones.

Como `notificar` y `alerta_interna` mandan email a cuentas activas, el seed también crea cuentas
de la demo sin contraseña (el login local las rechaza): una para el rol Administración, otra para
Dirección y una por cada familia responsable de una factura impaga. Si la persona o el email ya
tienen cuenta, no se toca; si queda inactiva o con otro email, el seed imprime un aviso. Los
emails son `<alias>@esseri.local`; para que lleguen a una casilla real, definir la base:

```bash
ESSERI_DEMO_EMAIL_BASE=equipo@gmail.com ESSERI_DEMO_SEED_ENABLED=true python ../database/seeds/04_seed_demo.py
docker compose exec -e ESSERI_DEMO_EMAIL_BASE=equipo@gmail.com -e ESSERI_DEMO_SEED_ENABLED=true backend python /database/seeds/04_seed_demo.py
```

Eso genera `equipo+administracion@gmail.com`, `equipo+direccion@gmail.com` y
`equipo+familia-<dni>@gmail.com`. Hay que sembrar antes de la primera detección de vencidas: el
detector da por emitido un tramo aunque su evento ya se haya procesado.

**Reglas de Compras (#214).** `Compras 1: generar orden de compra` (`generar_orden_compra` sobre
`solicitud_compra.aprobada`, con aprobación humana), `Compras 2: alerta al área de Compras`
(`alerta_interna` al rol `compras`, cuenta `compras@esseri.local`, sobre `orden_compra.emitida`) y
`Compras 3: aviso al solicitante` (`notificar` al destinatario `solicitante` sobre
`recepcion_compra.registrada`), con sus plantillas. Las solicitudes pendientes del seed son de
productos con un solo proveedor, así que al aprobarlas la orden se arma sola.

**Loop A (#206, #209).** Sobre `inscripcion.confirmada`: `Loop A 1: cargo de matrícula`
(`generar_cargo` con el concepto Matrícula y el monto de la matrícula de la demo, con aprobación
humana) y `Loop A 2: bienvenida a la familia` (`notificar` a los responsables habilitados con la
plantilla `Bienvenida a la familia`). El monto va en la regla porque las admisiones son del ciclo
siguiente y la regla de facturación de matrícula es del actual. Para el alta en vivo, el seed deja
siempre una solicitud de Nivel Primario lista para "Finalizar admisión e inscribir" (aspirante
`Benítez`, DNI `5092xxxx`), con la madre como contacto y su cuenta `familia-28555001@esseri.local`
para que la bienvenida le llegue; al finalizarla hay que elegir "usar el contacto como familia". Si
ya se finalizó, volver a correr el seed crea otra con el aspirante siguiente.

**Loop de inasistencias (#218).** Además crea 4 plantillas y 4 reglas sobre los eventos de asistencia, todas hacia los responsables habilitados de la familia: `Inasistencia: avisar a la familia` y `Tardanza: avisar a la familia` (`notificar` sobre `inasistencia.registrada`, según `tipo_asistencia`), `Inasistencia justificada: avisar a la familia` (`notificar` sobre `inasistencia.justificada`) e `Inasistencia sin justificar: recordatorio` (`generar_recordatorio` a los 2 días, solo si la inasistencia sigue sin justificar). El aviso de justificación es neutral porque el evento no dice si se aprobó o se rechazó. Los emails salen por n8n (`N8N_WEBHOOK_URL`): sin configurar, las ejecuciones quedan `fallido`.

### Regenerar la demo

Volver a correr el seed **no** actualiza reglas ni plantillas que ya existen (se buscan por nombre
y se saltean), y las tareas ya creadas no se vuelven a generar. Para probar con los textos nuevos
hay que recrear solo la base, sin tocar el volumen de n8n:

```bash
cd infra
docker compose stop backend && docker compose rm -sf postgres
docker volume rm infra_postgres-data   # NO usar `down -v`: borra también el volumen de n8n
docker compose up -d postgres backend
```

Después, migraciones y seeds `00` a `05` como se explica arriba (con `ESSERI_DEMO_SEED_ENABLED=true`).

## `05_seed_demo_docente.py` — datos ficticios para demostrar el Portal Docente

Dataset aparte de `04_seed_demo.py` (nombres/legajos propios, no se cruzan), pensado para la
demo puntual de RF-04 — Portal Docente con asistencia de a un alumno. Reutiliza los datos que
el equipo ya tenía cargados a mano (docente Jorgelina Moralejo, división "3°C", alumnos
Botteri/Cangiani) y suma 10 alumnos más a "3°C" (lista larga para la demo) y una segunda
división "2°B" asignada a la misma docente (sin alumnos todavía).

Mismas reglas que `04_seed_demo.py`: opcional, manual, requiere `ESSERI_DEMO_SEED_ENABLED=true`,
nunca corre en producción, idempotente por clave natural (DNI, legajo, email, nombre de
división).

```bash
cd backend
source venv/bin/activate
ESSERI_DEMO_SEED_ENABLED=true python ../database/seeds/05_seed_demo_docente.py
```

Con Docker:

```bash
cd infra
docker compose exec -e ESSERI_DEMO_SEED_ENABLED=true backend python /database/seeds/05_seed_demo_docente.py
```

La cuenta creada es `docente.prueba@esseri.edu.ar`; la contraseña por defecto es
`prueba-2027`. Puede reemplazarse solo para la carga con `ESSERI_DEMO_DOCENTE_PASSWORD`.

## `00_bootstrap_admin.py` — no es un catálogo

Va aparte de los tres de arriba: no precarga un catálogo del diccionario, crea el **primer usuario administrador** para que alguien pueda entrar al sistema (RF-27). El login rechaza a cualquiera que no esté ya en `usuario`, y los endpoints que crean usuarios están protegidos — sin esta fila inicial nadie puede loguearse. Es el equivalente al `createsuperuser` de Django.

```bash
python ../database/seeds/00_bootstrap_admin.py tu-email@ejemplo.com
```

Pide la contraseña por consola; en entornos no interactivos toma `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` de `backend/.env`. Requiere que `01_seed_grupo_a.py` haya corrido antes (es el que precarga el rol *administrador del sistema*). Idempotente: si el email ya existe, no toca nada.

## Pendiente

- **Grupo C restante**: transcribir `ANIO`/`DIVISION`/`MATERIA` y `PRODUCTO_SERVICIO` cuando ESSERI entregue la tabla maestra real (pregunta pendiente #17 del diccionario) — no antes.
