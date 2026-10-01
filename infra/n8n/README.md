# `infra/n8n/`

Workflows exportados de n8n. Vive acá y no en `backend/` porque n8n no tiene lógica de aplicación propia: es solo el **ejecutor de envíos** (Gmail/Google Workspace). El motor de workflows, `EVENT_LOG`, `WORKFLOW_EXECUTION` y `NOTIFICACION` viven en el backend (PostgreSQL es la fuente de verdad); el backend resuelve destinatario y contenido antes de llamar a n8n. Ver `ARCHITECTURE.md` y `docs/diccionario-de-datos-esseri.md`.

Todavía no hay ningún workflow exportado en esta carpeta.

## Contrato del webhook de envío de email

El backend (`backend/src/workflows/n8n_client.py`) hace un `POST` a `N8N_WEBHOOK_URL` con:

```json
{ "destinatario": "familia@mail.com", "asunto": "Aviso de mora", "cuerpo": "Hola ..." }
```

- Si `N8N_WEBHOOK_TOKEN` está definido, manda `Authorization: Bearer <token>`. En n8n, configurar el nodo Webhook con Header Auth usando el mismo valor.
- Cualquier respuesta que no sea 2xx, o un timeout (10 s), cuenta como envío fallido.
- Dentro de `docker-compose` el backend llega a n8n por `http://n8n:5678/webhook/<ruta>`; fuera de Docker, por `http://localhost:5678/webhook/<ruta>`.

Nadie llama todavía a `enviar_email()`: se conecta al implementar la acción `notificar` (RF-24, #68).

## Exportar workflows

Cuando se defina un workflow en la instancia de n8n (`http://localhost:5678` en local, vía `infra/docker-compose.yml`), exportarlo acá como JSON (`n8n export:workflow --id=<id> --output=infra/n8n/<nombre>.json`) para que quede versionado.
