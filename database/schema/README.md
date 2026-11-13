# `database/schema/`

Modelo de datos y modelo de clases del sistema, como referencia legible por humanos. Las migraciones ejecutables reales viven en `backend/alembic/`, nunca acá.

## Documentos entregables

| Archivo | Contenido |
|---|---|
| `entrega/DER-Esseri.pdf` | Diagrama entidad-relación: 73 tablas, 9 módulos, 128 relaciones. |
| `entrega/Diagrama-Clases-Esseri.pdf` | Diagrama de clases: 73 clases, 9 módulos, las mismas 128 relaciones. |

Los dos documentos se generan de la misma fuente, comparten la nomenclatura y comparten la paginación: la página *N* de uno trata el mismo módulo que la página *N* del otro. La correspondencia clase ↔ tabla está en [`docs/trazabilidad-modelo-clases-der.md`](../../docs/trazabilidad-modelo-clases-der.md).

## Generación

La fuente de verdad es el código: los modelos SQLAlchemy de `backend/src/`.

```bash
# 1. extrae entidades, columnas, claves y relaciones desde los modelos
backend/venv/bin/python database/schema/generator/build_model.py

# 2. genera el HTML de ambos documentos
python3 database/schema/generator/render.py

# 3. convierte a PDF con Chrome headless (A3 horizontal)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=database/schema/generator/der.pdf \
  "file://$PWD/database/schema/generator/der.html"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=database/schema/generator/clases.pdf \
  "file://$PWD/database/schema/generator/clases.html"

# 4. publica los PDFs
cp database/schema/generator/der.pdf    database/schema/entrega/DER-Esseri.pdf
cp database/schema/generator/clases.pdf database/schema/entrega/Diagrama-Clases-Esseri.pdf
```

Cambiar una entidad en el código y volver a correr los cuatro pasos mantiene la equivalencia por construcción: no hay forma de que un documento tenga algo que el otro no tenga.

## Archivos históricos

| Archivo | Estado |
|---|---|
| `DER-Esseri.drawio` | Versión anterior (54 tablas, nomenclatura en plural). Queda como referencia histórica; no refleja el modelo actual. |
| `DER-Esseri.drawio.svg` | Export de la versión anterior. |

El diccionario de datos (`docs/diccionario-de-datos-esseri.md`) sigue siendo la fuente narrativa — campos, tipos y el *por qué* de cada decisión.
