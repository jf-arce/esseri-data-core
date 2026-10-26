# Autenticación — Login con Google + JWT interno (RF-27)

Documento del módulo completo (`backend/src/auth/` + lo que necesita `frontend/modules/auth/`),
no solo de cómo levantar el backend — por eso vive en `docs/` y no en `backend/README.md`.

## Cómo funciona

El backend hace el flujo **Authorization Code + PKCE**: el navegador va a `/auth/google/login`,
Google confirma la identidad y vuelve a `/auth/google/callback`, y el backend canjea el código y
emite su propio JWT interno en una cookie httpOnly. El *client secret* de Google nunca sale del
backend ni llega al frontend.

Sobre el frontend: con este flujo, el botón de login es un link a `/auth/google/login` — no hace
falta el SDK de Google Identity Services ni un client ID en el navegador.

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

## Bloqueo por intentos

`POST /auth/login` bloquea por IP. Se cuentan las filas `fallido` de `LOG_ACCESO` con la misma
`ip_origen` (no hace falta migración: se bloquea por IP porque `LOG_ACCESO` no guarda el email).

- **Regla:** se toman los `LOGIN_MAX_INTENTOS` fallidos más recientes de la IP. Si entre el más
  nuevo y el más viejo pasó menos que `LOGIN_VENTANA_MINUTOS`, la IP queda bloqueada hasta el más
  nuevo + `LOGIN_BLOQUEO_MINUTOS`. Valores por defecto: 10 / 15 / 15. `Settings` exige
  `LOGIN_BLOQUEO_MINUTOS >= LOGIN_VENTANA_MINUTOS`, así al vencer un bloqueo el contador arranca
  de cero.
- **Respuesta:** `429` con un mensaje genérico, sin `Retry-After`. El chequeo corre antes de buscar
  al usuario, así que es idéntica exista o no el email, y también rechaza la contraseña correcta.
- **Los intentos bloqueados no se registran** (no verifican nada, y registrarlos alargaría el
  bloqueo mientras alguien insista).
- **Un login exitoso no reinicia el contador**: si lo hiciera, una cuenta válida permitiría seguir
  probando contra otras cuentas desde la misma IP.
- **Google queda afuera:** la contraseña la verifica Google y el callback exige un `code` de un
  solo uso, PKCE y `state` firmado, así que no hay nada que adivinar. Es además la salida para
  quien quede bloqueado. Sus fallidos sí suman al contador de la IP, porque `LOG_ACCESO` no
  registra el canal.

Límites conocidos:

- **NAT:** el personal del colegio puede compartir IP pública. Por eso el máximo es 10.
- **Proxy:** hoy no hay uno delante del backend. Si se agrega, hay que levantar uvicorn con
  `--proxy-headers --forwarded-allow-ips=<ip del proxy>` (nunca leer `X-Forwarded-For` a mano); si
  no, todos los usuarios compartirían la IP del proxy.
- **IPv6:** se puede rotar de dirección dentro de un /64.
- **Concurrencia:** primero se chequea y después se registra, así que con pedidos en paralelo
  pueden pasar algunos intentos más allá del máximo. bcrypt ya limita el ritmo.
- **`ip_origen` nula:** se deja pasar (con uvicorn sin proxy no ocurre).
- Las fechas se normalizan a UTC en `sesion_service._a_utc`; la #188 puede subirlo a un helper
  compartido.
