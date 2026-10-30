# `infra/n8n/`

Workflows exportados de n8n. Vive acá y no en `backend/` porque n8n no tiene lógica de aplicación propia: es solo el **ejecutor de envíos** (Gmail/Google Workspace). El motor de workflows, `EVENT_LOG`, `WORKFLOW_EXECUTION` y `NOTIFICACION` viven en el backend (PostgreSQL es la fuente de verdad); el backend resuelve destinatario y contenido antes de llamar a n8n. Ver `ARCHITECTURE.md` y `docs/diccionario-de-datos-esseri.md`.

## Workflows

| Archivo | Qué hace |
|---|---|
| `enviar-email.json` | Webhook `POST /enviar-email` (Header Auth). Sin `envio_id` mantiene el contrato legacy → Gmail → 200/500. Con `envio_id` reclama el intento en el backend, envía por Gmail y registra el resultado correlacionado antes de responder. |

> Exportado de una instancia local donde se probó un envío correcto y un fallo de Gmail. Los IDs de credenciales están como `COMPLETAR`: al importar hay que asignar las propias (ver abajo).

### Importar `enviar-email.json`

1. En `http://localhost:5678`: *Workflows → Import from file* y elegir `infra/n8n/enviar-email.json`.
2. Nodo **Webhook**: crear una credencial *Header Auth* con nombre `Authorization` y valor `Bearer <token>`, donde `<token>` es el mismo `N8N_WEBHOOK_TOKEN` del backend.
3. Nodo **Enviar con Gmail**: asignar una credencial *Gmail OAuth2* de la cuenta que envía (ver "Credencial de Gmail" más abajo).
4. Publicar el workflow con el botón **Publish** (sin publicarlo, solo responde la URL `webhook-test`). Si se edita después, hay que volver a publicar.
5. Configurar en el `.env` del backend `N8N_WEBHOOK_URL`: `http://n8n:5678/webhook/enviar-email` dentro de Docker, o `http://localhost:5678/webhook/enviar-email` fuera.
6. Probar un envío correcto y uno con Gmail fallando (por ejemplo, credencial revocada): el segundo tiene que devolver 500. No alcanza con que el workflow termine en error: sin la salida de error del nodo Gmail, n8n responde 200 con cuerpo vacío y el backend daría el email por enviado.

### Credencial de Gmail

La credencial *Gmail OAuth2* necesita un cliente OAuth de Google Cloud:

1. En un proyecto de Google Cloud, habilitar la **Gmail API**.
2. Crear un cliente OAuth de tipo **Aplicación web** con el redirect `http://localhost:5678/rest/oauth2-credential/callback` (exacto, sin barra final). Se puede reutilizar el del login del backend sumándole ese redirect. Orígenes autorizados de JavaScript: vacío.
3. En la pantalla de consentimiento, tipo de datos "Datos de los usuarios", scope `https://www.googleapis.com/auth/gmail.send` y la cuenta que envía como **usuario de prueba**.
4. En n8n, cargar Client ID y Client Secret en la credencial y usar *Sign in with Google*.

Errores frecuentes: `access_denied` (403) es que la cuenta no está como usuario de prueba; `invalid_client` es que el Client ID o el Secret están mal copiados. Mientras la app esté en modo prueba, el token vence a los 7 días y hay que volver a autorizar la credencial.

## Contrato del webhook de envío de email

El backend (`backend/src/workflows/n8n_client.py`) hace un `POST` a `N8N_WEBHOOK_URL` con:

```json
{
  "destinatario": "familia@mail.com",
  "asunto": "Aviso de mora",
  "cuerpo": "Hola ...",
  "cuerpo_html": "<!DOCTYPE html>..."
}
```

- `cuerpo` es el texto plano (la evidencia que guarda `NOTIFICACION`). `cuerpo_html` es el mismo mensaje dentro del layout institucional (`backend/src/workflows/email_html.py`), con el botón de la regla si lo tiene. El nodo Gmail manda `cuerpo_html` y, si faltara, cae a `cuerpo`.
- El nombre del remitente (`senderName`) está fijo en el nodo Gmail (`ESSERI`): si cambia `EMAIL_INSTITUCION_NOMBRE` del backend, cambiarlo también ahí.
- El logo y el pie del mail se configuran en el backend (`EMAIL_LOGO_URL`, `EMAIL_INSTITUCION_PIE`, ver `backend/.env.example`), no en n8n. El logo tiene que ser una URL pública.
- Si se vuelve a importar `enviar-email.json` sobre una instancia existente (por ejemplo, para pasar de texto a HTML), hay que reasignar las credenciales y **volver a publicar** el workflow.

- Si `N8N_WEBHOOK_TOKEN` está definido, manda `Authorization: Bearer <token>`. En n8n, configurar el nodo Webhook con Header Auth usando el mismo valor.
- Cualquier respuesta que no sea 2xx, o un timeout (10 s), cuenta como envío fallido. Por eso el workflow tiene que responder 5xx cuando Gmail falla (salida de error del nodo Gmail): un error sin respuesta explícita llega al backend como 200 vacío.
- Dentro de `docker-compose` el backend llega a n8n por `http://n8n:5678/webhook/<ruta>`; fuera de Docker, por `http://localhost:5678/webhook/<ruta>`.

`enviar_email()` lo llama la acción `notificar` (`backend/src/workflows/notificaciones_service.py`).

## Contrato manual correlacionado (Comunicaciones → email)

Los emails manuales usan el mismo webhook con campos adicionales. El backend sólo despacha si
`N8N_MANUAL_HABILITADO=true`, `N8N_WEBHOOK_URL` y `N8N_WEBHOOK_TOKEN` no están vacíos y
`N8N_CALLBACK_BASE_URL` apunta a este backend. Sin todo eso, las intenciones quedan `pendiente`
y no se llama a n8n.

```json
{
  "destinatario": "familia@mail.com",
  "asunto": "Aviso",
  "cuerpo": "Hola ...",
  "cuerpo_html": "<!DOCTYPE html>...",
  "envio_id": "uuid estable de la intención",
  "intento_id": "uuid del intento durable",
  "callback_base_url": "http://backend:8000"
}
```

Flujo del workflow cuando viene `envio_id`:

1. `POST {callback_base_url}/workflows/envios/{envio_id}/reclamar` con `{intento_id}`. El backend
   exige `Authorization: Bearer <N8N_WEBHOOK_TOKEN>` y responde `{reclamado, estado, ...}`.
   Sólo el intento activo y sin claim previo recibe `reclamado: true`. Un duplicado responde
   `reclamado: false` y **no** ejecuta Gmail.
2. Si fue reclamado, Gmail envía. Un error de Gmail registra `incierto`; nunca se reintenta a ciegas.
3. `POST {callback_base_url}/workflows/envios/{envio_id}/resultado` con
   `{intento_id, estado, referencia_proveedor | error_codigo}`. `presentado` exige el id que
   devuelve Gmail; el backend lo guarda como referencia del proveedor. Un 200 sin ese id no
   prueba envío.
4. Recién entonces responde al backend con el mismo `envio_id`/`intento_id` y `estado`. El cliente
   manual valida ese ack; un HTTP 200 vacío, `{ "enviado": true }` o ids distintos queda `incierto`.

Los nodos HTTP salientes **Reclamar envío**, **Registrar resultado** y **Registrar fallo** usan una
credencial *Header Auth* con nombre `Authorization` y valor `Bearer <N8N_WEBHOOK_TOKEN>`. Es la
misma credencial que puede usarse en el Webhook entrante. Asignarla a los tres nodos al importar.

`N8N_CALLBACK_BASE_URL` debe ser alcanzable desde el contenedor de n8n (`http://backend:8000`
dentro de Docker). Si cambia la URL o el token, hay que reasignar credenciales y volver a publicar.

## Exportar workflows

Cuando se cree o modifique un workflow en la instancia de n8n (`http://localhost:5678` en local, vía `infra/docker-compose.yml`), exportarlo acá como JSON (`n8n export:workflow --id=<id> --output=infra/n8n/<nombre>.json`) para que quede versionado.
