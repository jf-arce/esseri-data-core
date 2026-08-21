# ESSERI Data Core — Database

Documentación y referencia del modelo de datos. **Las migraciones ejecutables viven en `backend/alembic/`** — acá solo queda la referencia legible por humanos. Nunca se escribe SQL a mano en esta carpeta.

## Contenido

| Carpeta | Contenido |
|---|---|
| `schema/` | DER actualizado del modelo de datos. |
| `seeds/` | Catálogos de carga inicial (niveles educativos, roles, métodos de pago, etc.). |

## Cómo generar el DER

Se genera a partir de las tablas ya definidas en `backend/src/*/models.py` y `backend/src/models.py` (entidades compartidas), reflejando el diccionario de datos (`docs/diccionario-de-datos-esseri.md`). Cualquier herramienta que lea el esquema de Postgres directamente sirve (ej. `pgAdmin` → "ERD Tool", o `dbdiagram.io` a partir del SQL exportado) — lo importante es que el DER sea generado desde la base real, no dibujado a mano, para que no se desincronice de las migraciones.

## Orden de carga de seeds

Todavía no hay seeds definidos (ver `seeds/README.md`). Cuando existan, el orden de carga depende de las dependencias de FK entre catálogos — documentarlo acá a medida que se agreguen.

## Migraciones

Las migraciones reales se generan y corren desde `backend/`:

```bash
cd backend
alembic revision --autogenerate -m "descripción del cambio"
alembic upgrade head
```

Ver `backend/README.md` para el detalle completo.
