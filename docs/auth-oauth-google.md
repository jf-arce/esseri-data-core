# Autenticación — Login con Google + JWT interno (RF-27)

Documento del módulo completo (`backend/src/auth/` + lo que necesita `frontend/modules/auth/`),
no solo de cómo levantar el backend — por eso vive en `docs/` y no en `backend/README.md`.

## Cómo funciona

El backend hace el flujo **Authorization Code + PKCE**: el navegador va a `/auth/google/login`,
Google confirma la identidad y vuelve a `/auth/google/callback`, y el backend canjea el código y
emite su propio JWT interno en una cookie httpOnly. El *client secret* de Google nunca sale del
backend ni llega al frontend.

Sobre el frontend: con este flujo, el botón de login es un link a `/auth/google/login` — no hace
falta el SDK de Google Identity Services ni un client ID en el navegador (ver la nota sobre la
issue #13 más abajo).

## Configuración

Crear la credencial en [Google Cloud
Console](https://console.cloud.google.com/apis/credentials) → *Create credentials* → *OAuth client
ID* → tipo **Web application**, y registrar como *Authorized redirect URI* exactamente el valor de
`GOOGLE_REDIRECT_URI` (por defecto `http://localhost:8000/auth/google/callback`). Completar
`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `backend/.env`.

Sin esas variables el resto del backend funciona igual — solo el login con Google queda
inhabilitado (el login con contraseña sigue andando).

## Cómo conviven los dos logins

`auth_provider` indica el método **principal**, no una exclusión — una cuenta puede terminar con
las dos vías habilitadas. Detalle completo en `docs/diccionario-de-datos-esseri.md` (módulo
Autenticación y Roles, tabla `USUARIO`).

## Sin auto-registro: el login rechaza a quien no está cargado

Un email de Google que no está en `usuario` se rechaza (403) y el intento queda en `LOG_ACCESO`.
Google autentica; habilitar la cuenta es decisión del sistema — la carga de usuarios la hacen los
ABM (familias, inscripciones), no este flujo. Motivo completo en el diccionario de datos.

## Primer usuario (bootstrap)

Como consecuencia de lo anterior, el sistema no tiene forma de arrancar solo: la primera fila de
`usuario` hay que crearla desde afuera, porque los endpoints que crean usuarios están protegidos.
Es el equivalente al `createsuperuser` de Django:

```bash
cd backend
source venv/bin/activate
python ../database/seeds/00_bootstrap_admin.py tu-email@ejemplo.com
```

Pide la contraseña por consola. Para entornos no interactivos (Docker, CI) se puede usar
`BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en `.env`. Requiere haber corrido antes
`01_seed_grupo_a.py`, que es el que precarga el rol *administrador del sistema* — ver
`database/seeds/README.md`.

El usuario nace con `auth_provider='local'` para que el sistema arranque sin depender de que
Google Cloud esté configurado; la primera vez que ese admin entre por Google, la cuenta se vincula
sola y conserva la contraseña como fallback.

## Pendiente

- **Issue #13** (frontend) está redactada asumiendo el SDK de Google Identity Services y una
  variable `VITE_GOOGLE_CLIENT_ID`. Con el flujo implementado acá (redirect clásico), el frontend
  no necesita ninguna de las dos cosas — el botón de login es un `<a href="/auth/google/login">`.
  Hay que reescribir esa issue y sacar `VITE_GOOGLE_CLIENT_ID` de `frontend/.env.example` y
  `frontend/README.md`.
- **Rate limiting / bloqueo por intentos** en `POST /auth/login` — no está implementado. `LOG_ACCESO`
  registra los fallos pero no bloquea nada. Ver issue [#93](https://github.com/jf-arce/esseri-data-core/issues/93).
