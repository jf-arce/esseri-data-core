@AGENTS.md

## Claude Code

Este archivo y `AGENTS.md` usan rutas relativas a la **raíz del repo** (ej. `frontend/package.json`, `backend/README.md`). El equipo debería lanzar Claude Code parado en la raíz, no desde adentro de una capa — si de todos modos la sesión arrancó desde una subcarpeta, interpretá esas rutas como relativas a la raíz del repo, no al directorio actual.

Para las zonas listadas como "manejar con cuidado extra" en `AGENTS.md` (migraciones, `auth/`, archivos de Docker), usar **modo plan** en vez de editar directo.
