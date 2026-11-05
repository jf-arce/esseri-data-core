# Despliegue en Railway

Railway es el destino previsto para producción. Esta guía configura servicios de contenedores
separados en un mismo proyecto y ambiente. No ejecutar `docker compose up` dentro de Railway:
los Compose del repositorio siguen siendo la referencia para ejecución local.

Las instrucciones se contrastaron con los Dockerfiles y la documentación oficial. El despliegue
real y su prueba de aceptación todavía no se ejecutaron.

## Servicios y persistencia

Crear un proyecto y un ambiente nuevo con red privada IPv4/IPv6. Usar estos nombres para que las
referencias de variables coincidan. Mantener una réplica de cada servicio; el backend actual
incluye jobs en el proceso y migraciones al arrancar.

| Servicio | Origen y contexto | Puerto interno | Persistencia |
|---|---|---|---|
| `Postgres` | Servicio PostgreSQL de Railway; comprobar versión compatible con PostgreSQL 16, usado por el proyecto | 5432 | Volumen del servicio PostgreSQL |
| `backend` | Repositorio, raíz `/`, `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile` | 8000 | Datos en PostgreSQL |
| `frontend` | Repositorio, Root Directory `/frontend`, Dockerfile detectado allí | 80 | Sin volumen |
| `n8n` | Imagen oficial `docker.n8n.io/n8nio/n8n:2.46.6` | 5678 | Volumen en `/home/node/.n8n` |
| `clamav` | Imagen `clamav/clamav:1.4`, serie usada en las pruebas del proyecto | 3310 | Volumen en `/var/lib/clamav` |

La versión inicial elegida de n8n es `2.46.6`, anunciada como estable por su documentación oficial.
Debe pasar las pruebas de envío de esta guía antes de habilitar usuarios; no se declara validada
por haberla fijado. Registrar el digest desplegado y no actualizar una instalación existente sin
backup y prueba del workflow exportado. Para ClamAV, registrar también el digest, ya que la
etiqueta de serie puede recibir actualizaciones.

No generar dominio público ni TCP Proxy para backend, PostgreSQL o ClamAV. Los servicios deben estar en
el mismo ambiente para resolver sus direcciones privadas. Un ambiente nuevo evita la limitación
IPv6 exclusiva de ambientes antiguos con las imágenes que escuchan en IPv4.

Fuentes: [Dockerfiles en Railway](https://docs.railway.com/builds/dockerfiles),
[red privada](https://docs.railway.com/networking/private-networking/how-it-works),
[PostgreSQL](https://docs.railway.com/databases/postgresql),
[volúmenes](https://docs.railway.com/volumes) y
[versiones de n8n](https://docs.n8n.io/hosting/installation/docker/).

## Variables separadas por servicio

Railway configura variables en cada servicio; no lee automáticamente `infra/env/.env`.
La plantilla [env/.env.example](env/.env.example) enumera las opciones de la aplicación para
Compose. En Railway copiar al backend solo sus variables, completar secretos y reemplazar:

```dotenv
ENVIRONMENT=production
PORT=8000
DATABASE_URL=${{Postgres.DATABASE_URL}}
N8N_WEBHOOK_URL=http://${{n8n.RAILWAY_PRIVATE_DOMAIN}}:5678/webhook/enviar-email
N8N_CALLBACK_BASE_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:8000
CLAMAV_HOST=${{clamav.RAILWAY_PRIVATE_DOMAIN}}
CLAMAV_PORT=3310
N8N_MANUAL_HABILITADO=false
COMUNICACIONES_ADJUNTOS_HABILITADOS=false
UVICORN_ROOT_PATH=/api
FORWARDED_ALLOW_IPS=*
```

Mantener las banderas desactivadas hasta completar las verificaciones de las integraciones.
`JWT_SECRET` y `N8N_WEBHOOK_TOKEN` son secretos propios. No usar los valores de desarrollo.
La referencia a PostgreSQL debe resolver la conexión privada; comprobar el host sin publicar
la URL ni su contraseña. `POSTGRES_*` pertenece al servicio de base de datos, no al frontend.

En el frontend definir `VITE_API_URL=/api` y `NGINX_CONFIG=nginx-railway.conf` antes del build;
definir también `PORT=80` para el servicio. En runtime, `BACKEND_UPSTREAM=${{backend.RAILWAY_PRIVATE_DOMAIN}}:8000`. Su Dockerfile declara
los argumentos de build y genera la configuración desde la plantilla al iniciar. No poner secretos en variables `VITE_*`, porque quedan dentro del JavaScript público.

En n8n configurar sus propias variables según [la plantilla exclusiva de ese servicio](n8n/.env.example):

| Variable | Valor o finalidad |
|---|---|
| `N8N_HOST` | Host público de n8n, sin protocolo ni ruta |
| `N8N_PORT` | `5678`, puerto interno del contenedor |
| `N8N_PROTOCOL` | `https`, protocolo de su URL pública |
| `N8N_EDITOR_BASE_URL` | URL pública HTTPS del editor |
| `N8N_PROXY_HOPS` | `1` para el proxy de Railway, sin un proxy adicional |
| `N8N_ENCRYPTION_KEY` | Secreto persistente que cifra las credenciales; conservarlo junto con los backups |
| `N8N_WEBHOOK_URL` | En n8n 2.35 o posterior, URL pública base de n8n, terminada en `/` |
| `RAILWAY_RUN_UID` | `0`, según el requisito de permisos de volúmenes de Railway para imágenes con usuario no root |
| `N8N_USER_FOLDER` | `/home/node`, para que los datos permanezcan en `/home/node/.n8n` incluso al cambiar el UID |

**El mismo nombre `N8N_WEBHOOK_URL` tiene distinto uso en los dos servicios.** En el backend es
el endpoint privado completo de envío; en n8n moderno es la base pública para generar webhooks.
No compartir una única variable de proyecto entre ambos. Para versiones anteriores de n8n,
consultar su documentación versionada: esa base pública se configuraba como `WEBHOOK_URL`.

Fuentes: [proxy y webhooks de n8n](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/)
y [variables de despliegue](https://docs.n8n.io/hosting/configuration/environment-variables/deployment/).

## HTTPS y dominios

Railway termina TLS y renueva los certificados. Usar los dominios gratuitos generados por
Railway; no hace falta comprar un dominio. En Settings → Networking → Generate Domain, publicar
**solo frontend** con puerto destino `80` y **n8n** con puerto destino `5678`.

La aplicación y la API comparten el dominio del frontend: Nginx sirve la interfaz y reenvía
`/api/*` al backend privado quitando el prefijo. Esto conserva las cookies `Secure`, `HttpOnly`
y `SameSite=Lax`. La cookie temporal de Google cambia su ruta de `/auth` a `/api/auth` en el
proxy; la cookie de sesión conserva `/`. No se publica un segundo dominio para la API.

Una vez generado el dominio del frontend, completar en el backend:

```dotenv
FRONTEND_URL=https://<dominio-generado-del-frontend>
CORS_ORIGINS=["https://<dominio-generado-del-frontend>"]
GOOGLE_REDIRECT_URI=https://<dominio-generado-del-frontend>/api/auth/google/callback
```

Registrar ese callback exacto en Google Cloud. En la credencial de Gmail, registrar
`https://<dominio-generado-de-n8n>/rest/oauth2-credential/callback` y confirmar que coincide con
la URL mostrada por n8n. Los marcadores se sustituyen por los dominios de la instalación.

`UVICORN_ROOT_PATH=/api` hace que la documentación de la API y sus redirecciones reconozcan el
prefijo público. `FORWARDED_ALLOW_IPS=*` se permite **solo en este backend privado**, sin dominio
ni TCP Proxy, dentro de un proyecto con servicios de confianza. Nginx convierte el `X-Real-IP`
proporcionado por Railway en el encabezado que interpreta Uvicorn y fija el esquema HTTPS.
No copiar esta confianza a una API expuesta directamente a internet. Verificar la IP registrada
con dos clientes diferentes al aceptar la instalación para no compartir el bloqueo de login.

Fuentes: [red pública y certificados](https://docs.railway.com/networking/public-networking),
[encabezados del proxy de Railway](https://docs.railway.com/networking/public-networking/specs-and-limits),
[proxy de Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) y
[opciones de Uvicorn](https://github.com/encode/uvicorn/blob/main/uvicorn/main.py).

## Arranque, administrador y comprobaciones

1. Desplegar PostgreSQL y confirmar que su volumen está montado.
2. Desplegar ClamAV y n8n con sus volúmenes. Esperar la descarga y carga de firmas de ClamAV.
3. Configurar las variables del backend y desplegar. No reemplazar su comando de inicio:
   el Dockerfile aplica migraciones y los seeds `01`, `02`, `03` antes de abrir el puerto.
4. Configurar el healthcheck del backend en `/health`, puerto `8000`. Confirmar respuesta
   `{"status":"ok"}` (desde el navegador, `/api/health` en el dominio del frontend); no alcanza para comprobar integraciones externas.
5. Crear el administrador dentro del contenedor. En Railway, usar **Copy SSH Command** sobre el
   servicio backend y ejecutarlo con la CLI autenticada. En esa sesión remota:

   ```bash
   python /database/seeds/00_bootstrap_admin.py <correo-del-administrador>
   ```

   Reemplazar el marcador. Con `BOOTSTRAP_ADMIN_PASSWORD` vacía, se pide la contraseña por consola.
   No usar `railway run` como sustituto: ejecuta el proceso en la máquina local.
6. Desplegar frontend con `VITE_API_URL=/api`; comprobar login por contraseña y Google,
   persistencia al recargar y cierre de sesión.
7. Configurar Gmail, importar, asignar credenciales y publicar el workflow según
   [n8n/README.md](n8n/README.md). Verificar éxito, fallo y callbacks antes de habilitar envíos manuales.
8. Verificar los adjuntos según el apartado siguiente antes de habilitarlos para usuarios.

SSH: [documentación oficial](https://docs.railway.com/cli/ssh).

## ClamAV y recursos

El servicio `clamav` usa solo red privada, puerto `3310`, y conserva las firmas en
`/var/lib/clamav`. No desactivar FreshClam: mantiene las firmas actualizadas. Reservar 4 GiB de
RAM para el escáner, siguiendo la recomendación del proveedor, y permitir tiempo para la descarga
inicial. Consultar los logs antes de habilitar adjuntos.

Desde la sesión SSH del backend, comprobar el escaneo real con el cliente del proyecto y luego
recorrer una publicación de prueba con PDF o imagen válidos, descarga autenticada y denegación a
un usuario sin acceso. Probar también el comportamiento cuando el escáner está indisponible en
un ambiente de pruebas, nunca interrumpiendo producción: el archivo no debe quedar limpio.

Como presupuesto inicial de prueba, reservar 1 GiB para API, 1 GiB para PostgreSQL, 1 GiB para
n8n y 256 MiB para Nginx, además de los 4 GiB de ClamAV. Estos valores son una propuesta de
arranque, no mínimos medidos ni garantía de capacidad. Ajustarlos con métricas y carga real.
El almacenamiento debe incluir los adjuntos (hasta 25 MiB por comunicación), WAL y backups.

Fuente: [memoria y persistencia de ClamAV](https://docs.clamav.net/manual/Installing/Docker.html).

## Aceptación de la instalación

Registrar fecha, commit, versiones/digests de imágenes y resultados antes de habilitar usuarios:

- HTTPS válido, `/api/health` y `/api/docs` accesibles y login funcional, incluida persistencia
  de cookies, callback de Google y distinción de IP entre clientes.
- Base migrada, catálogos y administrador disponibles.
- Gmail con envío correcto y fallo controlado; comunicación manual con resultado correlacionado.
- Borrador de IA generado y revisable.
- Adjunto válido inspeccionado por ClamAV real; acceso autorizado y denegado comprobados.
- Volúmenes persistentes y recuperación de backups ensayada en un ambiente separado.

La publicación del manual no acredita que estas pruebas hayan pasado. Deben ejecutarse sobre
el ambiente instalado; no se realizaron durante la revisión documental.
