# `infra/n8n/`

Workflows exportados de n8n. Vive acá y no en `backend/` porque n8n no tiene lógica de aplicación propia: es solo el **ejecutor de envíos** (Gmail/Google Workspace). El motor de workflows, `EVENT_LOG`, `WORKFLOW_EXECUTION` y `NOTIFICACION` viven en el backend (PostgreSQL es la fuente de verdad); el backend resuelve destinatario y contenido antes de llamar a n8n. Ver `ARCHITECTURE.md` y `docs/diccionario-de-datos-esseri.md`.

## Workflows

| Archivo | Qué hace |
|---|---|
| `enviar-email.json` | Webhook `POST /enviar-email` (Header Auth) → Gmail → responde 200. Si Gmail falla, la salida de error responde 500. |

> **Borrador**: `enviar-email.json` se armó a mano y su estructura se validó creándolo en una instancia local (nodos Webhook 2.1, Gmail 2.2 y Respond to Webhook 1.5), pero todavía no se probó un envío real. Cuando se pruebe con la credencial de Gmail, reexportarlo desde n8n y reemplazar este archivo.

### Importar `enviar-email.json`

1. En `http://localhost:5678`: *Workflows → Import from file* y elegir `infra/n8n/enviar-email.json`.
2. Nodo **Webhook**: crear una credencial *Header Auth* con nombre `Authorization` y valor `Bearer <token>`, donde `<token>` es el mismo `N8N_WEBHOOK_TOKEN` del backend.
3. Nodo **Enviar con Gmail**: asignar una credencial *Gmail OAuth2* de la cuenta que envía.
4. Activar el workflow (sin activarlo, solo responde la URL `webhook-test`).
5. Configurar en el `.env` del backend `N8N_WEBHOOK_URL`: `http://n8n:5678/webhook/enviar-email` dentro de Docker, o `http://localhost:5678/webhook/enviar-email` fuera.
6. Probar un envío correcto y uno con Gmail fallando (por ejemplo, credencial revocada): el segundo tiene que devolver 500. No alcanza con que el workflow termine en error: sin la salida de error del nodo Gmail, n8n responde 200 con cuerpo vacío y el backend daría el email por enviado.

## Contrato del webhook de envío de email

El backend (`backend/src/workflows/n8n_client.py`) hace un `POST` a `N8N_WEBHOOK_URL` con:

```json
{ "destinatario": "familia@mail.com", "asunto": "Aviso de mora", "cuerpo": "Hola ..." }
```

- Si `N8N_WEBHOOK_TOKEN` está definido, manda `Authorization: Bearer <token>`. En n8n, configurar el nodo Webhook con Header Auth usando el mismo valor.
- Cualquier respuesta que no sea 2xx, o un timeout (10 s), cuenta como envío fallido.
- Dentro de `docker-compose` el backend llega a n8n por `http://n8n:5678/webhook/<ruta>`; fuera de Docker, por `http://localhost:5678/webhook/<ruta>`.

`enviar_email()` lo llama la acción `notificar` (`backend/src/workflows/notificaciones_service.py`).

## Exportar workflows

Cuando se defina un workflow en la instancia de n8n (`http://localhost:5678` en local, vía `infra/docker-compose.yml`), exportarlo acá como JSON (`n8n export:workflow --id=<id> --output=infra/n8n/<nombre>.json`) para que quede versionado.
