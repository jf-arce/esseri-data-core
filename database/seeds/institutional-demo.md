# Run the ESSERI institutional demo in a disposable database

This dataset is fictional and separate from the smaller demos in seeds `04`–`07`.
It loads 250 students (246 active), 220 guardians, 25 teachers, 15 grades/divisions,
150 weekly time slots, attendance and admissions, 1,013 invoices and 750 payments,
18 communications, 24 historical contextual conversations and 8 period-absence requests,
15 vendors, purchase/receipt examples, a local-only work item from an actual
workflow run, and an audit trail for every seeded entity. The reference date is
**November 18, 2026**. The bank lot, live workflow, its effects, and the
protagonist's debit chat do not exist after loading.

## Prepare or reset the database

Use a new local container with no mounted volume. Never mark an existing database
as disposable. Run this in a dedicated development shell:

```bash
export DEMO_CONTAINER=esseri-institutional-demo-local
export DEMO_DB_PASSWORD="$(openssl rand -hex 16)"
docker run --rm -d --name "$DEMO_CONTAINER" --label esseri.disposable-demo=institutional-v1 \
  -p 127.0.0.1::5432 \
  -e POSTGRES_DB=esseri_institutional_demo -e POSTGRES_USER=esseri_institutional_demo \
  -e POSTGRES_PASSWORD="$DEMO_DB_PASSWORD" postgres:16-alpine
docker exec "$DEMO_CONTAINER" pg_isready -U esseri_institutional_demo -d esseri_institutional_demo
```

Once PostgreSQL reports it is accepting connections:

```bash
docker exec "$DEMO_CONTAINER" psql -U esseri_institutional_demo -d esseri_institutional_demo \
  -v ON_ERROR_STOP=1 -c "COMMENT ON DATABASE esseri_institutional_demo IS 'esseri:disposable-institutional-demo:v1'"
DEMO_PORT="$(docker port "$DEMO_CONTAINER" 5432/tcp | sed 's/.*://')"
export ENVIRONMENT=development
export DATABASE_URL="postgresql://esseri_institutional_demo:${DEMO_DB_PASSWORD}@127.0.0.1:${DEMO_PORT}/esseri_institutional_demo"
export JWT_SECRET="$(openssl rand -hex 32)"
export ESSERI_DEMO_SEED_ENABLED=true
export ESSERI_DEMO_PASSWORD="$(openssl rand -hex 16)"
export OPENAI_API_KEY= ASISTENTE_HABILITADO=false N8N_WEBHOOK_URL= N8N_WEBHOOK_TOKEN=
export N8N_MANUAL_HABILITADO=false WORKFLOWS_DESPACHO_HABILITADO=false
export FACTURACION_AUTOMATICA_HABILITADA=false NOTIFICACIONES_VENCIMIENTOS_HABILITADO=false
unset PGHOSTADDR

cd backend
source venv/bin/activate
alembic upgrade head
python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py
python ../database/seeds/08_seed_institutional_demo.py
uvicorn src.main:app --host 127.0.0.1 --port 8000
```

In a second local shell, run `VITE_API_URL=http://localhost:8000 npm run dev -- --host 127.0.0.1`
from `frontend/` and open `http://localhost:5173`. The app uses the real system
clock; the seed does not change the backend or browser clock. Use the week of
November 16 for the calendar demo. `--reference-date YYYY-MM-DD` can shift the
dataset to a different school-term date (March–November); this changes the
cohorts and month to filter/export. Set it only on the first load.

Rerunning `08` against the same dataset is a **no-op**: it does not rollback a
rehearsal or change any demo passwords. To reset, stop the app, then stop **only**
the disposable container you created above. Its anonymous storage is removed
with it. Verify the label before stopping it:

```bash
test "$(docker inspect -f '{{ index .Config.Labels "esseri.disposable-demo" }}' "$DEMO_CONTAINER")" = institutional-v1 \
  && docker stop "$DEMO_CONTAINER"
```

Repeat the preparation commands. Never use `docker compose down -v`, a shared
database, or the project's normal Postgres volume.

## Demo accounts

Every login uses `@demo.esseri.test` and the value of `ESSERI_DEMO_PASSWORD` set
above. Keep it in the demo shell or your local test password manager.

| Login prefix | Person / role | Use |
|---|---|---|
| `admin` | Paula Luna / Administración | Indicators, purchases, bank export and import |
| `direccion` | Mariana Funes / Dirección | Indicators and audit; no collection writes |
| `workflow` | Santiago Acosta / Administrador del sistema | Create or run the automation and inspect its audit |
| `docente` | Alma Escobar / Docente | Assigned divisions and attendance |
| `familia-01` | Elena Acuña | Alma Acuña (`ID-A001`), `ID-RENDICION-001`: approved; includes sibling Joaquín |
| `familia-21` | Felipe Acuña | Bruno Acuña (`ID-A021`), `ID-RENDICION-021`: insufficient funds, the protagonist's notice, and the live chat |
| `familia-29` | Dante Ibarra | Mateo Ibarra (`ID-A029`), `ID-RESERVA-029`: exported, without result or notice |

The seed also creates 24 historical conversations (16 about explained absences,
8 about period-absence requests): eight closed, eight awaiting the family and
eight awaiting administration. Log in with the owning `familia-NN` →
**Comunicaciones → Mis consultas**, or `admin` → **Comunicaciones →
Conversaciones**. `familia-21` has **no** conversation until the live debit
query. The chat only supports the real context types: debit, absence
explanation and period-absence request; there is no free-form chat for fees or
activities.

The remaining simulation logins are `familia-02` through `familia-30`.
The `.test` addresses are for a local mail capture only, not public inboxes.

## Rehearse the live bank flow

1. As `workflow`, create an active rule on `debito.resultado_registrado`. Add a
   condition `resultado == rechazado`, and a **Notificar** action targeting the
   economic guardian with the `familia_facturacion` link, using **Demo
   institucional · Débito rechazado**, without human approval. This results in
   eight executions, not 28. Optionally add a separate `resultado == exitoso`
   branch using the success template if you want both outcomes notified.
2. As `admin`, open **Facturación → Débitos → Generar lote**. In `2026-11`, CBU,
   search `ID-RENDICION`, select all 28 matching invoices, export and save the
   CBU CSV. Clear the search, search `ID-RESERVA`, and export the two remaining invoices into
   their own batch. Leave that batch unprocessed.
3. Generate the **actual importable response file** from the exact CSV
   downloaded in step 2 (the batch code travels in its header):

   ```bash
   # From backend/, with the venv activated. Use a fresh output path per rehearsal.
   python ../database/seeds/08_seed_institutional_demo.py bank-response \
     /path/to/request.csv /path/to/esseri-response.csv
   ```

   The command uses the real codec, recalculates control totals, and does not
   access the database or overwrite an existing output. A static response
   could not be reused because each export gets a new batch code.
   Use `--processing-date YYYY-MM-DD` if you changed the seed reference month.
   The simulated format accepts only terminal outcomes and requires one
   result per invoice, so the two pending debits **cannot** be in this file.
4. In **Importar resultados**, upload the response, review and confirm.
   Expect **20 approved**, **5 insufficient funds**, **3 other rejections**
   (unknown CBU, disabled account, closed account). The 20 payments and
   credits are created now. Reupload the same file: it should reopen the
   confirmed import without creating anything new.
5. Start the [local mail capture](#show-the-generated-email-without-sending-it).
   As `workflow`, run one dispatch with authenticated `POST /workflows/procesar`,
   or enable only the demo dispatcher's scheduler and wait for it. Without a
   sink, skip the email segment: workflow email can fail without rolling back
   payments or hiding the family notice.
6. As `familia-21`, show **Facturación** and the debit notice, the amount due
   and the reason. From that notice, start the **consulta** about the rejected
   debit: this is the contextual chat. Send the question, then log in as
   `admin`, open **Comunicaciones → Conversaciones**, reply, and return to the
   family to read the answer. This thread is intentionally absent after load;
   the seed provides 24 historical threads about absences and period requests.
   As `familia-01`, show the paid invoice; as `familia-29`, show the invoice
   remains pending with no debit notice. The standard `Notificar` action writes
   a debit notice, not a manual inbox entry. To demonstrate the Communications
   inbox instead, use the supported **Publicar comunicación** action with portal
   delivery; avoid also selecting email on that action if the same rule sends it
   via `Notificar`.
7. As `direccion` or `admin`, ask the Assistant about the batch. The real tools
   are `resumen_debitos` (period totals, collected/rejected and reasons),
   `lotes_debito` (with the lot code, every debit in that batch including the
   rejection reason), `facturas_para_debitar`, `deuda_por_familias`, and the
   financial/workflow summaries. Communications are not a data tool: show them
   from the module. An LLM reply requires a separately authorized demo
   provider; the seeding and tool tests use real database queries without a
   provider.
8. As `workflow` or `direccion`, use **Auditoría** and **Workflows →
   Ejecuciones** to trace the new rule and financial effects. For the live
   debit demo, audit entries, events, executions and notices are generated by
   application operations, not preloaded.

Staff views show academic schedules/assignments and the communications list,
not equivalent teacher/management calendar screens. Simulated CBU export does
not represent a real bank, mandate or adhesion.

## Show the generated email without sending it

In a separate shell, pick a demo-only token and use the same value in the app
and capture shells. Start the capture once from `backend/` with the venv
activated:

```bash
export N8N_WEBHOOK_TOKEN='<your-demo-only-token>'
umask 077
CAPTURE_DIR="$(mktemp -d)"
python ../database/seeds/institutional_demo_mail.py "$CAPTURE_DIR/mail.jsonl"
```

Before dispatching, restart **only the demo backend** with
`N8N_WEBHOOK_URL=http://127.0.0.1:8798/capture`, the same token, and
`NO_PROXY=127.0.0.1,localhost` so the app never routes the capture to a
configured proxy. Keep `N8N_MANUAL_HABILITADO=false`. In another terminal,
open `mail.jsonl` and show
the record for `familia-21@demo.esseri.test`. This is the actual payload the
app generated, not an email delivery receipt. The capture accepts only the
30 numbered demo addresses and never sends or forwards anything. Do not
reuse live n8n, a sender account, or a real recipient.

## Verification checklist

| Surface | Check |
|---|---|
| Families, enrollment, attendance | 250 students, 220 guardians, sibling and secondary-guardian links, 2025/26/27 cohorts, withdrawals and explanations |
| Scheduling and portals | Family schedule has teachers and time slots; unrelated student is denied; published events appear only for eligible recipients; teacher reads assigned divisions |
| Management | Direction and Administration endpoints return indicators with their real role grants; suppliers endpoint returns 15 vendors |
| Billing and bank | 1,013 invoice charges, 750 baseline payments; file preview is non-financial; confirmation adds 20 payments and credits; reserve lot remains unprocessed |
| Workflows and comms | Open “Acto de cierre del ciclo lectivo” to see a long message, a linked event, a downloadable demo PDF, and both delivery channels. The seed adds three event-only, three attachment-only, and three combined examples. Seeded email attempts are historical, not queued. The live rule still produces eight executions, captured emails and rejection notices; reimport does not duplicate them. |
| Conversations | Admin inbox lists the three threads with their states; the protagonist has none until the family starts the debit query; family cannot read another family's thread |
| AI and audit | Rule-based suggestions are seeded; the Assistant debt tool runs against actual data; family access to the Assistant is denied; 28 debit audit rows after confirmation |

Observed checks: the seed loaded and reran as a no-op on migrated PostgreSQL
16. The 15 institutional tests and 60 related debit regressions passed; the conversation expansion keeps 15 focused tests green.
Browser smoke against a disposable seeded API showed the family timetable
and Feria de ciencias, the teacher's three assigned divisions, both management
panels, and all 30 debit candidates. The full import and dispatch were tested
through the API, not by clicking through the entire browser flow.

On a fresh v2 database the full journey was exercised: 30 candidates, 28
rendered and 2 reserved, 20 collected and 8 rejected, 770 payments, 8 captured
emails, 8 executions, reimport of the same file returned the same import id
without extra rows, the protagonist's debit chat worked with an administrative
reply, `resumen_debitos` and `lotes_debito` returned real data, and audit
recorded the 28 debit results. The conversational reply itself still needs an
authorized provider key; the tools run against real data without it.

```bash
# Run from backend/ with the venv activated.
ENVIRONMENT=development NOTIFICACIONES_VENCIMIENTOS_HABILITADO=false \
  pytest -q tests/test_institutional_demo_seed.py \
  tests/facturacion/test_formato_cobranza_simulada.py \
  tests/facturacion/test_cobranzas_lotes.py \
  tests/facturacion/test_cobranzas_importacion.py \
  tests/facturacion/test_debitos_resultados_workflow.py \
  tests/facturacion/test_publicar_comunicacion_debito.py
```
