# Demo del 10/11 — cómo dejarla andando (RNF-11, #225)

La demo corre en una notebook con Docker, con el stack de `infra/docker-compose.yml` y los datos
del seed de demo. Todo se maneja con tres scripts de `infra/demo/`, desde la raíz del repo (en
Windows, con Git Bash):

| Script | Para qué |
|---|---|
| `infra/demo/preparar-demo.sh` | Levanta el stack, carga los datos, verifica y deja un backup de ese estado. Se puede correr de nuevo sin duplicar nada. |
| `docker compose exec -T backend python - < demo/verificar_demo.py` (desde `infra/`) | Solo el chequeo: ✅ listo, ⚠️ conviene revisar, ❌ bloquea. No modifica nada. |
| `infra/demo/restaurar-demo.sh` | Vuelve la base al último backup de demo. Para usar en plena presentación si algo queda raro. |

Login: `demo.admin@esseri.local` / `EsseriDemo2026!` en http://localhost:5173.

## Tres cosas que rompen la demo si no se prevén

1. **Gmail se desautoriza solo a los 7 días.** Mientras la app de Google esté en modo prueba, el
   token de n8n vence a la semana (`infra/n8n/README.md`). Hay que reautorizarlo el **9/11**.
2. **Los datos dependen de la fecha.** El seed calcula inasistencias "de hoy" y vencimientos desde
   hoy. Hay que cargarlos **la mañana de la demo**, no días antes.
3. **Gemini y Gmail necesitan internet.** Sin conexión el sistema anda, pero "Redactar
   comunicación" falla y los emails quedan `fallido`. Llevar un plan B (ver "Si algo falla").

## Una semana antes (hasta el 3/11)

- En la notebook de la demo: Docker Desktop instalado y el repo clonado en `main`.
- `backend/.env` a partir de `backend/.env.example`, con:
  - `N8N_WEBHOOK_URL=http://n8n:5678/webhook/enviar-email` y `N8N_WEBHOOK_TOKEN` (el mismo que en n8n).
  - La clave del proveedor de IA (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`; el
    `.env.example` trae el ejemplo de Gemini). El `.env` no se versiona: cada uno pone la suya.
- n8n: importar `infra/n8n/enviar-email.json` y cargar sus credenciales (`infra/n8n/README.md`).
- **Ensayo completo:** `CON_N8N=1 infra/demo/preparar-demo.sh` y recorrer el guion de abajo.
  Después del ensayo, `infra/demo/restaurar-demo.sh` deja todo como antes de empezar.

Si algún puerto (5432, 8000, 5173, 5678) ya lo usa otro programa de la notebook, ver "Puertos
ocupados" al final.

## El día anterior (9/11)

- Reautorizar la credencial de Gmail en n8n (*Sign in with Google*) y mandar un email de prueba.
- `git pull` de `main` y `CON_N8N=1 infra/demo/preparar-demo.sh`.
- Copiar el backup que deja (`backups/demo-*.dump`) a un pendrive o a Drive.
- Grabar un video corto del guion completo: es el último recurso si la notebook falla.

## La mañana de la demo (10/11)

1. `CON_N8N=1 infra/demo/preparar-demo.sh` (recarga los datos con la fecha de hoy y saca un
   backup nuevo). Tiene que terminar en "✅ Lista para la demo".
2. Abrir de antemano las pantallas del guion: la primera carga del frontend en modo desarrollo
   tarda unos segundos.
3. Desactivar la suspensión de la notebook y las notificaciones del sistema; confirmar internet.
4. Redactar con IA un borrador de antemano (Sugerencias de IA → Redactar comunicación), para
   tenerlo a mano si en el momento no hay conexión.

## Guion de la demo

El motor de Workflows despacha solo cada 30 segundos: después de cada acción, esperar o forzarlo
desde http://localhost:8000/docs → `POST /workflows/procesar`.

1. **Loop A — admisión.** Inscripciones → Admisiones → la solicitud "Benítez" → *Finalizar
   admisión e inscribir* (división de Primario, usar el contacto como familia). En Workflows →
   Historial: la bienvenida sale sola y el cargo de matrícula queda **pendiente de aprobación**;
   aprobarlo y mostrar la factura en Facturación.
2. **Compras.** Solicitudes de compra → aprobar una pendiente → aprobar "Compras 1" en el historial →
   la orden aparece en Órdenes de compra y "Compras 2" avisa al área. Registrar la recepción →
   "Compras 3" avisa a quien la pidió.
3. **Mora.** Facturación → Deuda por familia; en el historial, las reglas "Vencimiento 1 a 4":
   factura vencida, avisos y penalidad por tramo pendiente de aprobación.
4. **IA.** Sugerencias de IA → *Analizar ahora* (patrones de morosidad e inasistencias) y
   *Redactar comunicación* (borrador con IA, se revisa antes de convertirse en plantilla).

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| Los datos quedaron raros después de un ensayo o un error | `infra/demo/restaurar-demo.sh`: vuelve al último backup en menos de un minuto. |
| No queda solicitud "Benítez" para el alta en vivo | `infra/demo/restaurar-demo.sh` (vuelve la de antes) o `infra/demo/preparar-demo.sh` (crea otra). |
| Una ejecución no aparece en el historial | Esperar 30 s o forzar `POST /workflows/procesar` desde `/docs`. |
| Los emails quedan `fallido` | n8n caído (`docker compose ps`; levantarlo con `CON_N8N=1 infra/demo/preparar-demo.sh`) o credencial de Gmail vencida (reautorizar). Mientras tanto, mostrar el email armado en Workflows → Notificaciones enviadas. |
| "Redactar comunicación" da error | Sin internet o sin cuota del proveedor: mostrar el borrador redactado a la mañana. |
| Una pantalla queda en blanco o no carga | Recargar (F5). Si sigue: `docker compose restart frontend backend` desde `infra/`. |
| El backend no arranca | `docker compose logs backend` desde `infra/`; si es un puerto ocupado, ver abajo. |
| Docker no responde | Reiniciar Docker Desktop y correr `infra/demo/preparar-demo.sh`. Último recurso: el video del 9/11. |

## Puertos ocupados

Si la notebook ya usa alguno de los puertos del stack, no editar `infra/docker-compose.yml` (afecta
a todo el equipo): crear un override propio fuera del repo, por ejemplo `~/demo-puertos.yml`:

```yaml
services:
  postgres:
    ports: !reset []
  backend:
    ports: !override
      - "8100:8000"
    environment:
      FRONTEND_URL: http://localhost:5180
      CORS_ORIGINS: '["http://localhost:5180"]'
  frontend:
    ports: !override
      - "5180:5173"
    environment:
      VITE_API_URL: http://localhost:8100
```

y pasarlo a los scripts: `COMPOSE_OVERRIDE=~/demo-puertos.yml infra/demo/preparar-demo.sh`. El
frontend queda en http://localhost:5180 y el backend en http://localhost:8100. Ojo: CORS sale de
`CORS_ORIGINS`, no de `FRONTEND_URL`, así que hay que cambiar las dos.
