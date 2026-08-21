# `infra/n8n/`

Workflows exportados del motor de automatización (n8n). Vive acá y no en `backend/` porque la ejecución de los workflows se resuelve vía n8n, sin lógica de aplicación propia — ver `ARCHITECTURE.md`.

Todavía no hay ningún workflow definido: el alcance exacto del motor de workflows (si solo dispara notificaciones o también otras acciones automáticas) es la Pregunta Pendiente #9 del diccionario de datos (`docs/diccionario-de-datos-esseri.md`), sin confirmar con ESSERI o el tutor.

Cuando se defina un workflow en la instancia de n8n (`http://localhost:5678` en local, vía `infra/docker-compose.yml`), exportarlo acá como JSON (`n8n export:workflow --id=<id> --output=infra/n8n/<nombre>.json`) para que quede versionado.
