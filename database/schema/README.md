# `database/schema/`

DER (diagrama entidad-relación) actualizado del sistema, como referencia legible por humanos — las migraciones ejecutables reales viven en `backend/alembic/`, nunca acá.

| Archivo | Contenido |
|---|---|
| `DER-Esseri.drawio` | Fuente editable (draw.io/diagrams.net) — abrir con [app.diagrams.net](https://app.diagrams.net) o la extensión de VS Code para modificarlo. |
| `DER-Esseri.drawio.svg` | Export para verlo directo en GitHub/GitLab sin instalar nada. |

Se arma a partir del diccionario de datos (`docs/diccionario-de-datos-esseri.md`), que sigue siendo la fuente de verdad narrativa (campos, tipos, el *por qué* de cada decisión). Cuando el diccionario cambie (nueva tabla, FK, o alguna de las preguntas pendientes con ESSERI se resuelva), actualizar el `.drawio` y volver a exportar el `.svg` en el mismo cambio para que no se desincronicen.
