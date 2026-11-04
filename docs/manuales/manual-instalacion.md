# Manual de instalación y configuración de ESSERI Data Core

Este manual corresponde al issue #74. Está dirigido a quien instala y administra el sistema.
Los comandos indican su directorio de ejecución. Las credenciales, dominios y claves deben
completarse para cada instalación; no se deben guardar archivos `.env` con secretos en Git.

La instalación de desarrollo usa Compose. El destino previsto de producción es Railway, con
servicios de contenedores separados: seguir la [guía de Railway](../../infra/railway.md).
El Compose de producción queda como alternativa para un servidor administrado por el equipo. Los comandos de este manual fueron revisados
contra las fuentes, pero no ejecutados como parte de esta entrega.

## 1. Requisitos y clonado

- Git y acceso al repositorio.
- Docker Engine con el plugin Docker Compose v2, o Docker Desktop que los incluya. Para seguir
  también el override de puertos de la demo, usar Compose 2.24.4 o posterior, requerido por
  [`!override`](https://docs.docker.com/reference/compose-file/merge/#replace-value). En Windows, los scripts de demo documentados requieren Git Bash.
- Puertos disponibles en desarrollo: PostgreSQL `5432`, API `8000`, frontend `5173` y n8n `5678`.
  Producción publica frontend en `80`, API en `8000` y n8n en `5678`; no publica PostgreSQL.
- Acceso a internet para descargar dependencias e imágenes y usar Google/Gmail o el proveedor de IA.
- Para OAuth y Gmail: un proyecto de Google Cloud y una cuenta autorizada.
- Para borradores con IA: credenciales de un proveedor compatible con Chat Completions.

Docker instala las dependencias dentro de sus imágenes. Solo para ejecutar las capas fuera de
Docker, las fuentes requieren Python 3.14 o compatible, PostgreSQL, Node.js 20+ y npm 10+;
el frontend está probado con Node 26 y el Compose usa PostgreSQL 16.
La guía de Railway incluye un presupuesto inicial de recursos, separado de los mínimos
comprobados del antivirus. Ajustarlo después de medir el uso real.

Desde el directorio donde se guardará el proyecto:

```bash
git clone https://github.com/jf-arce/esseri-data-core.git
cd esseri-data-core
git switch main
```

El acceso al repositorio usa las credenciales personales de GitHub, no las del sistema ESSERI.

## 2. Archivos y variables de entorno

| Entorno | Archivo | Uso |
|---|---|---|
| Docker de desarrollo | `backend/.env` | Configuración de la API. Compose reemplaza `DATABASE_URL` por la conexión al servicio `postgres`. |
| Frontend fuera de Docker | `frontend/.env` | URL de API usada por Vite. El Compose local fija esa URL directamente. |
| Docker de producción | `infra/env/.env` | Variables entregadas a PostgreSQL, backend y n8n mediante `env_file`. |
| Build de producción | `infra/.env` | Definir `VITE_API_URL` para la interpolación de Compose y el build del frontend. Una variable de shell del mismo nombre tiene precedencia. |

Las tablas siguientes cubren las variables de las plantillas. Los ejemplos locales de las fuentes
no son credenciales para producción. Las claves y tokens deben ser propios de la instalación.

### Base de datos, sesión y acceso

| Variable | Finalidad y configuración |
|---|---|
| `POSTGRES_USER` | Usuario creado por el contenedor PostgreSQL en producción; debe coincidir con la URL de conexión. |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL. Completar antes del primer arranque productivo. |
| `POSTGRES_DB` | Nombre de la base creada por PostgreSQL. |
| `DATABASE_URL` | Conexión del backend. En Docker usa el host `postgres`; fuera de Docker, el host accesible desde la máquina. Completar usuario, contraseña y base coherentes con PostgreSQL; codificar caracteres reservados de la contraseña para una URL. |
| `ENVIRONMENT` | `development` en desarrollo y `production` en producción. Fuera de desarrollo activa cookies `Secure`; producción también impide cargar el seed de demo. |
| `JWT_SECRET` | Secreto para firmar la sesión interna. Obligatorio; no reutilizar el ejemplo de desarrollo. |
| `JWT_ALGORITHM` | Algoritmo de firma; la configuración existente usa `HS256`. |
| `JWT_EXPIRE_MINUTES` | Duración del JWT en minutos. |
| `GOOGLE_CLIENT_ID` | Identificador del cliente OAuth web. Necesario para habilitar login con Google. |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth, exclusivo del backend. |
| `GOOGLE_REDIRECT_URI` | Callback de la API que debe registrarse exactamente en Google Cloud. |
| `FRONTEND_URL` | Destino del navegador después del callback; configurar la URL pública del frontend en producción. |
| `CORS_ORIGINS` | Lista JSON de orígenes del frontend autorizados. Es independiente de `FRONTEND_URL`; actualizar ambas si cambia el puerto o dominio. |
| `BOOTSTRAP_ADMIN_EMAIL` | Correo del primer administrador que creará el script de bootstrap. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Contraseña para bootstrap no interactivo. Vacía: el script la pide por consola. No crea el usuario por el solo hecho de estar definida. |
| `LOGIN_MAX_INTENTOS` | Cantidad de fallos de login por IP que dispara el bloqueo. |
| `LOGIN_VENTANA_MINUTOS` | Ventana en minutos para contar fallos. |
| `LOGIN_BLOQUEO_MINUTOS` | Duración del bloqueo; debe ser mayor o igual que la ventana. |
| `VITE_API_URL` | URL del backend accesible desde el navegador, o `/api` con el proxy de Railway; nunca el nombre interno `backend`. Se incorpora al frontend al compilar; cambiarla en producción exige reconstruirlo. |

El frontend no necesita `VITE_GOOGLE_CLIENT_ID`: Google se configura en el backend.

### IA, facturación y workflows

| Variable | Finalidad y configuración |
|---|---|
| `OPENAI_API_KEY` | Clave del proveedor de borradores. Sin ella, la generación responde 503; la detección por reglas sigue funcionando. |
| `OPENAI_BASE_URL` | URL base del proveedor compatible con Chat Completions. |
| `OPENAI_MODEL` | Modelo habilitado en ese proveedor. |
| `OPENAI_TIMEOUT_SEGUNDOS` | Tiempo máximo de espera del proveedor. |
| `IA_MOROSIDAD_DIAS_VENCIDO` | Umbral de días de deuda vencida para detectar morosidad. |
| `IA_INASISTENCIAS_CANTIDAD` | Cantidad de ausencias sin justificar que activa la detección. |
| `IA_INASISTENCIAS_VENTANA_DIAS` | Período de observación de inasistencias. |
| `FACTURACION_AUTOMATICA_HABILITADA` | Habilita recuperación y ejecución del job de facturación; desactivarla conserva la operación manual. |
| `FACTURACION_HORA_EJECUCION` | Hora diaria del job, en Buenos Aires, con formato `HH:MM`. |
| `WORKFLOWS_DESPACHO_HABILITADO` | Habilita el procesamiento periódico de eventos pendientes. |
| `WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS` | Intervalo entre pasadas del despachador. |
| `N8N_WEBHOOK_URL` | URL publicada del workflow de envío, terminada en `/webhook/enviar-email`; no usar `/webhook-test/`. |
| `N8N_WEBHOOK_TOKEN` | Secreto compartido para Header Auth entre backend y n8n. Obligatorio para comunicaciones manuales. |
| `N8N_MANUAL_HABILITADO` | Habilita emails manuales solo después de verificar el workflow correlacionado. Por defecto, desactivado. |
| `N8N_CALLBACK_BASE_URL` | Dirección del backend alcanzable desde n8n; dentro de Docker, `http://backend:8000`. |
| `EMAIL_INSTITUCION_NOMBRE` | Nombre institucional del correo. El `senderName` del nodo Gmail se actualiza por separado. |
| `EMAIL_INSTITUCION_PIE` | Contacto o texto opcional del pie institucional. |
| `EMAIL_LOGO_URL` | URL pública del logo; vacía significa sin logo. No admite como recurso visible en Gmail un host local ni una imagen `data:`. |

### Adjuntos

| Variable | Finalidad y configuración |
|---|---|
| `COMUNICACIONES_ADJUNTOS_HABILITADOS` | Activa adjuntos tras verificar inspección de contenido y antivirus real. Mantener `false` hasta entonces. |
| `CLAMAV_HOST` | Host del servicio clamd alcanzable desde el backend. No hay servicio ClamAV en los Compose normales. |
| `CLAMAV_PORT` | Puerto TCP de clamd. La plantilla usa `3310`; el entorno de pruebas publica otro puerto en el host. |
| `CLAMAV_TIMEOUT_SEGUNDOS` | Tiempo máximo de espera del escaneo. |

Las variables `N8N_BASIC_AUTH_*` fueron retiradas de la plantilla: no protegen el acceso de las
versiones actuales de n8n. Su interfaz usa una cuenta propietaria, independiente del token del webhook.

## 3. Desarrollo con Docker

Desde la raíz del repositorio:

```bash
cp backend/.env.example backend/.env
```

Completar el secreto de sesión y las integraciones que se usarán. Después:

```bash
cd infra
docker compose up
```

Se inician PostgreSQL, backend, frontend y n8n. El backend aplica migraciones y carga los tres
catálogos antes de iniciar Uvicorn. Backend y frontend tienen recarga de desarrollo.

| Servicio | Dirección |
|---|---|
| Aplicación | `http://localhost:5173` |
| API y documentación | `http://localhost:8000/docs` |
| n8n | `http://localhost:5678` |

Para crear el primer administrador, configurar `BOOTSTRAP_ADMIN_EMAIL` antes del arranque y,
en otra terminal desde `infra/`, ejecutar:

```bash
docker compose exec backend python /database/seeds/00_bootstrap_admin.py
```

Si no se configuró contraseña, se solicita por consola. El bootstrap no modifica una cuenta que
ya exista. El login rechaza usuarios que no estén dados de alta, incluso si Google los autentica.

Para detener este entorno conservando sus volúmenes, desde `infra/`: `docker compose down`.
No agregar `-v` salvo que se busque borrar deliberadamente los datos. PostgreSQL y n8n conservan
sus datos en volúmenes separados.

## 4. Producción con contenedores

### Railway, destino previsto

Seguir [Despliegue en Railway](../../infra/railway.md): contextos de build, variables por servicio,
red privada, volúmenes, HTTPS, OAuth, bootstrap, ClamAV y pruebas de aceptación.
En Railway no se ejecuta el Compose ni se importa el mismo `.env` en todos los servicios.
Se usa un dominio gratuito del frontend para la aplicación y `/api`, con el backend privado.
No hace falta dominio propio y se conservan las cookies de sesión actuales.

### Compose en un servidor propio

Desde la raíz:

```bash
cd infra
cp env/.env.example env/.env
```

Completar `env/.env`, especialmente PostgreSQL, `DATABASE_URL`, `JWT_SECRET`, URLs públicas y
CORS. Crear también `infra/.env` con `VITE_API_URL=<URL pública de la API>`; sustituir el marcador
por la dirección elegida. Mantener esa dirección coherente con la variable del mismo nombre en
`infra/env/.env`: solo `infra/.env` o la shell alimentan el argumento de build.

Desde `infra/`:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

El frontend sirve archivos compilados mediante Nginx. El backend usa su Dockerfile y ejecuta
migraciones y catálogos antes de iniciar la API. No hay montajes de código ni recarga automática.
Crear el administrador con las variables de bootstrap configuradas:

```bash
docker compose -f docker-compose.prod.yml exec backend python /database/seeds/00_bootstrap_admin.py
```

**Este Compose no incluye HTTPS.** Para el destino previsto, Railway gestiona los certificados
según la guía enlazada. Un servidor propio requiere un proxy y certificados fuera de este Compose.
Las cookies de producción requieren HTTPS: arrancar contenedores no basta para considerar listo
el login público. No cambiar `ENVIRONMENT` a desarrollo para eludirlo.
La guía OAuth describe la consideración de encabezados de proxy si se incorpora uno, pero no
hay un despliegue completo definido en el repositorio.

No ejecutar simultáneamente las variantes local y productiva como si fueran entornos aislados:
comparten nombres de servicios y volúmenes de Compose dentro del mismo proyecto.

## 5. Migraciones, seeds y demo

En ambos Compose, el orden de arranque del backend es:

1. `alembic upgrade head`.
2. `01_seed_grupo_a.py`.
3. `02_seed_grupo_c.py`.
4. `03_seed_grupo_b.py`.
5. Inicio de la API.

No generar una migración nueva para instalar el sistema. Los seeds de catálogos son idempotentes;
no eliminan permisos existentes. El bootstrap del administrador es un paso separado.
Para ejecución sin Docker, seguir los comandos del [README del backend](../../backend/README.md).

El seed `04_seed_demo.py` es opcional, ficticio y está bloqueado en producción. Desde `infra/`,
solo para desarrollo:

```bash
docker compose exec -e ESSERI_DEMO_SEED_ENABLED=true backend python /database/seeds/04_seed_demo.py
```

`ESSERI_DEMO_SEED_ENABLED` autoriza la carga; `ESSERI_DEMO_PASSWORD` permite reemplazar la
contraseña de demo y `ESSERI_DEMO_EMAIL_BASE` dirige los avisos a alias de una cuenta de prueba.
El seed docente `05` es independiente y usa `ESSERI_DEMO_DOCENTE_PASSWORD`; ver
[seeds](../../database/seeds/README.md). No usar cuentas de demo para una instalación real.

Para la preparación completa de una demostración, usar [la guía de demo](../../infra/demo.md),
que documenta `CON_N8N`, `COMPOSE_OVERRIDE`, verificación y restauración. Estos scripts arrancan
servicios y modifican datos: no son comprobaciones de solo lectura.

Antes de actualizar una instalación con datos, realizar el backup documentado en
[Infra](../../infra/README.md#backup-y-recuperación-de-postgresql). El arranque del backend migra
automáticamente: comprobar compatibilidad antes de iniciarlo sobre un backup restaurado.

## 6. Google OAuth

1. Crear en Google Cloud un cliente OAuth de tipo aplicación web.
2. Registrar exactamente `GOOGLE_REDIRECT_URI`. En desarrollo:
   `http://localhost:8000/auth/google/callback`.
3. Completar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el entorno del backend.
4. Configurar `FRONTEND_URL` y `CORS_ORIGINS` según la dirección del frontend.
5. Con el backend iniciado y el usuario previamente creado, probar el acceso con Google.

El backend canjea el código mediante Authorization Code + PKCE y emite su cookie de sesión.
El secreto nunca se entrega al frontend. Sin credenciales OAuth, el login con contraseña sigue
funcionando. Un correo no registrado recibe 403; Google no da de alta usuarios automáticamente.
Detalle: [autenticación con Google](../auth-oauth-google.md).

## 7. n8n y Gmail

1. Abrir n8n y configurar la cuenta propietaria en el primer acceso, o ingresar con la existente.
2. En Google Cloud, habilitar Gmail API. Crear un cliente OAuth web, o reutilizar el del login
   agregando el callback de n8n: `http://localhost:5678/rest/oauth2-credential/callback` en local.
   En Railway usar la URL HTTPS de n8n seguida de `/rest/oauth2-credential/callback`,
   como indica la [guía de despliegue](../../infra/railway.md).
3. Configurar el consentimiento con datos de usuarios, scope
   `https://www.googleapis.com/auth/gmail.send` y la cuenta remitente como usuario de prueba.
   Para la credencial Gmail, la fuente indica dejar vacíos los orígenes JavaScript.
4. Importar `infra/n8n/enviar-email.json` desde Workflows → Import from file.
5. Crear Header Auth con nombre `Authorization` y valor `Bearer <token>`; usar el mismo secreto
   que `N8N_WEBHOOK_TOKEN`. Asignarlo al Webhook y a los nodos **Reclamar envío**,
   **Registrar resultado** y **Registrar fallo**.
6. Asignar una credencial Gmail OAuth2 al nodo **Enviar con Gmail**, completar Client ID y Secret
   y autorizar con *Sign in with Google*.
7. Publicar con **Publish**. Volver a publicar después de cualquier cambio.
8. Configurar `N8N_WEBHOOK_URL=http://n8n:5678/webhook/enviar-email` cuando backend y n8n están
   en Docker; fuera de Docker, usar la dirección de n8n accesible desde el backend.
9. Verificar un envío correcto y un fallo de Gmail con cuentas de prueba. El flujo debe responder
   con error cuando falla Gmail. Para emails manuales, verificar también reclamo y resultado
   correlacionados antes de activar `N8N_MANUAL_HABILITADO=true`.

`N8N_CALLBACK_BASE_URL` debe ser alcanzable desde n8n. Sin configuración manual completa, las
intenciones quedan pendientes. Un resultado incierto no se debe reintentar a ciegas; aceptación
por el proveedor no prueba llegada a la bandeja del destinatario.

Mientras Google mantiene la aplicación en modo prueba, la guía del proyecto indica reautorizar
Gmail cada siete días. El nombre del remitente en el nodo Gmail se configura por separado del
nombre institucional del backend. Ver [n8n](../../infra/n8n/README.md).

## 8. Proveedor de IA

Configurar `OPENAI_API_KEY`, `OPENAI_BASE_URL` y `OPENAI_MODEL` de manera coherente con el proveedor.
La integración usa Chat Completions por HTTP y admite proveedores compatibles. La plantilla del
backend incluye una alternativa de Gemini como ejemplo; disponibilidad, cuota y modelo deben
confirmarse en la cuenta del proveedor, no asumirse a partir de ese ejemplo.

Probar «Redactar comunicación» y revisar el borrador. Aprobarlo crea una plantilla, no envía emails.
La detección de morosidad e inasistencias usa reglas y SQL y no requiere la clave del proveedor.
Sin clave la redacción responde 503; un resultado que no cumple el formato de plantilla responde 502.

## 9. ClamAV y adjuntos

El backend necesita inspección estructural y un escáner ClamAV real. Pillow y pypdf no sustituyen
al antivirus. Mantener `COMUNICACIONES_ADJUNTOS_HABILITADOS=false` hasta verificar ambos controles.

El Compose de **pruebas aisladas** está descrito en
[Infra](../../infra/README.md#isolated-communications-verification). Usa el perfil `adjuntos`, imagen
ClamAV 1.4 para amd64, límite de 4 GiB y persistencia de firmas. En Apple Silicon requiere emulación.
Publica clamd solo en `127.0.0.1:13310`; ese host sirve para un backend ejecutado en la máquina,
no para apuntar desde otro contenedor a su propio `localhost`.

En Railway crear el servicio privado y el volumen de firmas siguiendo la
[guía de despliegue](../../infra/railway.md#clamav-y-recursos). Los Compose normales no incluyen
escáner; para pruebas locales usar el entorno aislado documentado. Configurar `CLAMAV_HOST`, `CLAMAV_PORT` y `CLAMAV_TIMEOUT_SEGUNDOS` según ese despliegue.
Mantener clamd privado: su protocolo TCP no autentica conexiones.

Una inspección fallida o no disponible no declara limpio un archivo. Los límites actuales son
cinco PDF/JPEG/PNG, 5 MiB por archivo y 25 MiB por comunicación. Los archivos privados se guardan
en PostgreSQL y forman parte de sus backups, incluidos los que están en cuarentena.
Los emails enlazan al portal autenticado; no envían los binarios a través de n8n.

## 10. Comprobación y problemas frecuentes

Comprobar que la API expone `/docs`, que el administrador puede iniciar sesión y que los módulos
muestran sus catálogos. Verificar cada integración habilitada por separado, con datos de prueba.
Desde `infra/`, `docker compose ps` y `docker compose logs backend` ayudan a diagnosticar desarrollo;
en producción añadir `-f docker-compose.prod.yml` inmediatamente después de `docker compose`.

| Síntoma | Revisión |
|---|---|
| Backend no arranca | Revisar logs, conexión y coherencia de las credenciales de PostgreSQL; el error puede estar en migraciones o seeds previos a Uvicorn. |
| Puerto ocupado | Consultar el override documentado en la guía de demo. Si cambia la URL del frontend, ajustar tanto `FRONTEND_URL` como CORS. |
| Frontend apunta a una API incorrecta | En producción, corregir la variable usada al build y reconstruir. Cambiar solo `env_file` no cambia el bundle. |
| Login con Google no disponible | Revisar Client ID, Secret y callback exacto. |
| Login devuelve 403 con Google | Confirmar que el usuario esté cargado y habilitado en el sistema. |
| Login devuelve 429 | Esperar el bloqueo por IP; revisar umbrales. Un login correcto no reinicia el contador. |
| Sesión productiva no persiste sobre HTTP | Completar HTTPS, requerido por las cookies `Secure`. |
| Gmail devuelve `access_denied` | Agregar la cuenta como usuario de prueba en Google. |
| Gmail devuelve `invalid_client` | Revisar Client ID y Secret. |
| Gmail deja de enviar tras varios días | Reautorizar la credencial en modo prueba. |
| Webhook no responde o emails fallan | Revisar URL publicada, publicación del workflow, token, conectividad y credencial Gmail. |
| Emails manuales permanecen pendientes | Revisar bandera manual, URL, token y callback; luego comprobar el contrato correlacionado. |
| Redacción de IA falla | Revisar clave, conectividad, cuota, modelo y URL del proveedor. |
| Adjuntos no habilitados o en cuarentena | Revisar bandera, inspección y conectividad real con ClamAV; no omitir el escaneo. |

## 11. Pendientes y fuentes

Los procedimientos de producción se desarrollan en la [guía de Railway](../../infra/railway.md).
Se utilizan dominios gratuitos de Railway. Resta ejecutar la aceptación en el ambiente
real, registrando las versiones verificadas. No se verificó la ejecución del sistema en esta tarea.

Se corrigieron en las fuentes la descripción de la imagen local del frontend, directorios de
preparación, variables faltantes de producción, variable OAuth innecesaria del frontend,
autenticación obsoleta de n8n y distinción entre catálogos automáticos y bootstrap manual.

Fuentes: [README principal](../../README.md), [backend](../../backend/README.md),
[frontend](../../frontend/README.md), [infraestructura](../../infra/README.md),
[demo](../../infra/demo.md), [n8n](../../infra/n8n/README.md),
[OAuth](../auth-oauth-google.md), [seeds](../../database/seeds/README.md),
[entorno backend](../../backend/.env.example), [entorno frontend](../../frontend/.env.example),
[entorno producción](../../infra/env/.env.example),
[Compose local](../../infra/docker-compose.yml), [Compose productivo](../../infra/docker-compose.prod.yml),
[Compose de pruebas](../../infra/docker-compose.comunicaciones-test.yml),
[Dockerfile backend](../../backend/Dockerfile), [Dockerfile frontend](../../frontend/Dockerfile)
y [configuración backend](../../backend/src/config.py).
