# Datos de la presentación final

Seed `09_seed_presentacion.py`: una escuela completa con datos simulados verosímiles (sin etiquetas "demo" a la vista) para la demo del proyecto. Es independiente de los seeds `04` a `08`; no se combinan.

Carga 420 alumnos (416 activos), 360 responsables en 340 familias, 40 docentes, 21 divisiones, 25 materias, 600 franjas horarias, asistencias, admisiones, 1.682 facturas y 1.260 pagos, 18 comunicaciones, 24 conversaciones históricas, 15 proveedores con compras, sugerencias de IA, 2 reglas de workflow con 12 ejecuciones y 6 tareas. Fecha de referencia: **18/11/2026**.

La regla del flujo en vivo **no se carga**: se arma en el canvas durante la demo.

## Estructura académica

Los 15 años van de sala de 3 a 6° de Secundaria (Inicial 3 a 5, Primario 1° a 6°, Secundario 1° a 6°). Cada división tiene entre 13 y 28 alumnos. Los primeros tres grados de Primario y Secundario tienen divisiones A y B; el resto, A: 21 divisiones en total.

- **Currícula por nivel:** Inicial (prácticas del lenguaje, nociones matemáticas, exploración del ambiente, juego y expresión, música, educación física, arte), Primario (11 materias, con maestro de grado y especiales de inglés, música, plástica, educación física y tecnología), Secundario con ciclo básico (10 materias) y ciclo orientado (11, con historia, geografía, biología, física, química y filosofía).
- **Horarios:** módulos de 60 minutos que empiezan en punto o y media, para que encajen con la grilla de 30 minutos del calendario. Cada nivel tiene su recreo (Inicial 3 por día desde 8:30, Primario 5 desde 8:00, Secundario 5 desde 7:30) y cada división llena sus 15 o 25 módulos semanales.
- **Docentes:** el plantel se dimensiona por carga (hasta 20 módulos semanales) y no tiene superposiciones. `alma.escobar@esseri.test` dicta Lengua y Literatura en 1°A, 1°B y 2°A de Secundario.
- Se calcula en `structure()`, de forma determinista: la misma base sale igual en cada carga.

## Cargar la base

El seed solo corre contra una base marcada como descartable, con el mismo nombre que su rol (`esseri_presentacion`), por loopback.

```bash
psql "$ADMIN_URL" -c "CREATE ROLE esseri_presentacion LOGIN PASSWORD '<clave-local>'" \
  -c "CREATE DATABASE esseri_presentacion OWNER esseri_presentacion" \
  -c "COMMENT ON DATABASE esseri_presentacion IS 'esseri:disposable-presentacion:v1'"
```

```bash
cd backend
source venv/bin/activate
export DATABASE_URL="postgresql://esseri_presentacion:<clave-local>@127.0.0.1:5432/esseri_presentacion"
export ENVIRONMENT=development ESSERI_DEMO_SEED_ENABLED=true ESSERI_DEMO_PASSWORD='<clave-de-cuentas>'
export OPENAI_API_KEY= ASISTENTE_HABILITADO=false N8N_WEBHOOK_URL= N8N_WEBHOOK_TOKEN=
export N8N_MANUAL_HABILITADO=false WORKFLOWS_DESPACHO_HABILITADO=false
export FACTURACION_AUTOMATICA_HABILITADA=false NOTIFICACIONES_VENCIMIENTOS_HABILITADO=false
alembic upgrade head
python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py
python ../database/seeds/09_seed_presentacion.py
```

Volver a correr el `09` sobre la misma base no hace nada. Para repetir el ensayo hay que borrar y recrear la base (`DROP DATABASE` y los pasos de arriba): el lote de débitos confirmado no se puede deshacer.

### Repetir el ensayo sin recargar los seeds

`presentacion-copia.sh` guarda una copia de la base ya cargada y la restaura cuando hace falta. Usa la conexión de `backend/.env` como administrador de Postgres.

```bash
cd database/seeds
./presentacion-copia.sh guardar     # con la base lista, antes de ensayar el flujo de débitos
./presentacion-copia.sh restaurar   # vuelve la base al estado guardado
```

`guardar` pisa la copia anterior. `restaurar` corta las conexiones abiertas (el backend se reconecta solo) y tarda unos segundos.

## Cuentas

Todas usan la contraseña de `ESSERI_DEMO_PASSWORD`.

| Cuenta | Rol | Uso en la demo |
|---|---|---|
| `paula.luna@esseri.test` | Administración | Pantallazo, lote de débitos, comunicaciones |
| `mariana.funes@esseri.test` | Dirección | Indicadores y auditoría |
| `santiago.acosta@esseri.test` | Administrador del sistema | Workflows (armar la regla) y auditoría |
| `alma.escobar@esseri.test` | Docente | Portal docente |
| `elena.acuna@familias.esseri.test` | Familia con dos hijos: Alma Acuña (`A-0001`) y Bruno Acuña (`A-0021`) | **Los dos casos con una sola cuenta**: el débito de Alma sale acreditado y el de Bruno, rechazado por saldo insuficiente |
| `felipe.acuna@familias.esseri.test` | Padre de Bruno (`A-0021`) | Ve a su hijo, pero no recibe los avisos de pago: el responsable económico es Elena |
| `dante.ibarra@familias.esseri.test` | Familia (alumno Mateo Ibarra, `A-0029`) | Factura exportada sin resultado |

Las demás cuentas de familia siguen el mismo patrón `nombre.apellido@familias.esseri.test`.

## Flujo de débitos en vivo

1. Como `santiago.acosta`, Workflows → Nueva regla: disparador de resultado de débito, condición `resultado == Acreditado`, acciones **Publicar comunicación** con las plantillas **Acreditación de débito** (rama Sí) y **Rechazo de acreditación de débito** (rama No), canal `ambos`.
2. Como `paula.luna`, Facturación → Débitos automáticos → Generar lote. Período `2026-11`, CBU. Son 30 facturas elegibles: `F-202611-0001` a `F-202611-0030`. Las **28 primeras** van en el lote; las dos últimas (`0029` y `0030`) quedan fuera, sin resultado.
3. Generar el archivo de respuesta con el CSV exportado (el código de lote viene en su cabecera; desde `backend/`):

   ```bash
   python ../database/seeds/09_seed_presentacion.py bank-response \
     /ruta/solicitud.csv /ruta/respuesta.csv
   ```

4. Importar resultados, revisar y confirmar: 20 acreditados, 5 por saldo insuficiente y 3 con otros rechazos.
5. Forzar el despachador con `POST /workflows/procesar` (autenticado) o esperar el intervalo configurado.
6. Mostrar el portal de `elena.acuna` (llegan los dos avisos), luego Workflows → Ejecuciones, Comunicaciones y Auditoría.

Para ver el payload del email sin enviarlo, usar `presentacion_mail.py` (acepta solo direcciones `@familias.esseri.test`), con la misma mecánica que describe [institutional-demo.md](institutional-demo.md#show-the-generated-email-without-sending-it).

## Reglas de facturación

Las facturas cargadas salen de **9 reglas por nivel educativo**, así Facturación → Reglas de facturación no aparece vacía y cada factura explica de dónde viene su importe:

| Regla | Ciclo | Estado | Importe |
|---|---|---|---|
| Cuota mensual · Inicial / Primario / Secundario | 2026 | activa | $110.000 / $125.000 / $145.000 |
| Matrícula · Inicial / Primario / Secundario | 2026 | activa | $150.000 / $170.000 / $190.000 |
| Cuota mensual · Inicial / Primario / Secundario | 2025 | finalizada | 15 % menos |

Quedan en modo **manual** a propósito: el seed carga solo 30 cuotas del mes actual (las de la demo de débitos), así que una regla automática intentaría generar el resto y mezclaría esas facturas con las del lote. Cada período tiene su ejecución registrada, y cada factura queda vinculada a su regla.

## Qué cambia respecto al seed 08

- Cuentas con nombre y apellido reales en vez de `familia-NN@demo.esseri.test`.
- Legajos `A-0001` y `D-001`, facturas `F-AAAAMM-NNNN` y referencias de pago `OP-…`.
- Plantillas «Acreditación de débito» y «Rechazo de acreditación de débito», y regla «Revisión de cuentas vencidas», sin prefijo de demo.
- Proveedores con email `ventas@<nombre>.esseri.test`, remitos `R-0001-…` y notas de admisiones sin menciones a la demo.
- Workflows con historial: 6 hechos de mora, 2 reglas y 12 ejecuciones (6 esperan aprobación).

Los dominios `.test` no reciben correo real.
