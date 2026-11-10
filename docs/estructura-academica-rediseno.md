# Actualización de la estructura académica

Resumen para el equipo de los cambios de la rama `feat/estructura-academica-rediseno`. Sirve también como base para la descripción del PR en borrador.

## Problemas de la versión anterior

1. **Niveles con alta, edición y baja.** Son siempre Inicial, Primario y Secundario, pero había ABM y ningún seed: una base nueva arrancaba vacía y cada entorno podía tener nombres distintos. Un renombre se ve en inscripciones, facturación y portales.
2. **Alta de división y de año sin contexto.** El diálogo mostraba todos los años de todos los niveles y pedía todos al backend en cada apertura.
3. **Acciones chicas y escondidas.** Editar y eliminar materia eran íconos de 12 px (debajo de WCAG 2.5.8), casi todo estaba en `text-xs` y "Agregar materia" estaba en el menú "⋯".
4. **Se cortaba el AM/PM** en los inputs de hora cuando el navegador estaba en 12 h.
5. **Materias de una misma división superpuestas.** Solo se detectaba mismo día y misma hora de inicio dentro de una materia.
6. **Un docente podía estar en dos divisiones a la misma hora.** Solo se validaba que no se repitiera docente + materia-curso + ciclo.
7. **Demasiada información en una página:** todo el árbol, cuatro tarjetas de estadísticas, catálogo y búsqueda, con una request por cada año de cada nivel al entrar.
8. **Catálogo de materias mezclado con la estructura.**

## Solución

| # | Cambio |
|---|---|
| 1 | Los niveles quedan de solo lectura (`GET /academico/niveles`). Una migración de datos inserta los que falten, comparando por nombre normalizado, sin renombrar ni borrar. |
| 2 | Los diálogos de año y división muestran nivel y año como texto fijo. Al editar no se mueven de lugar. Ya no se cargan todos los años. |
| 3 | Botones con texto y alto mínimo de 32 px, contenido en `text-sm`, "Agregar materia" a la vista. |
| 4 | Inputs de hora más anchos (`w-36`) y diálogo `sm:max-w-xl`. |
| 5 | `horarios_service.py` valida superposición total o parcial en la división. El diálogo avisa en vivo y bloquea guardar. |
| 6 | Misma validación por docente y ciclo, al asignar, en el alta masiva, al mover una asignación y al cambiar los horarios de la materia-curso. |
| 7 | Pestañas de nivel, selector de año, pestañas de división y vistas "Materias" y "Horario". Estado en la URL (`?nivel=&anio=&division=`). Los datos se cargan por tramo. |
| 8 | El catálogo pasa a `academico/materias`, con entrada propia en el menú. |

Además se corrigió un 500 que encontró la revisión: una hora con zona horaria rompía la comparación de superposición. Ahora el schema la rechaza con 422.

## Cambios que rompen compatibilidad

- Se quitan `POST /academico/niveles`, `PUT /academico/niveles/{id}` y `DELETE /academico/niveles/{id}` (ahora devuelven 405). Se eliminan también sus schemas, servicios y excepciones.
- Nueva ruta del catálogo de materias: `/academico/materias`.
- Nuevos 409 en `POST/PUT /academico/materias-curso` (horario superpuesto en la división o para un docente asignado) y en `POST/PUT /academico/asignaciones-docentes` y `/bulk` (docente con horario superpuesto). El 409 `HorarioDuplicado` ahora también cubre superposición parcial.
- Se quitan del frontend `nivel-seccion`, las estadísticas, la búsqueda sobre el árbol y la carga de todo el árbol al entrar.
- La migración `e0483c8d9e9c` no tiene `downgrade` real (datos maestros: no se borran). Si en algún entorno hay niveles de más o con otro nombre, la migración los deja como están.

## Pendiente de confirmar con la escuela (no implementado)

| Tema | Problema | Posible solución | Falta confirmar |
|---|---|---|---|
| Materias por nivel | Catálogo global con nombre único: no puede haber "Inglés" de Primario y de Secundario por separado | `nivel_educativo_id` en `Materia`, unicidad por nivel, migración que parta materias compartidas | Si cada nivel tiene sus propias materias |
| Año como número libre | `numero >= 1` sin tope; se puede crear "27° Primario" | Selector con los años válidos del nivel | Cuántos años tiene cada nivel |
| Inicial como "1°" | En jardín se dice "Sala de 3/4/5" | Cambiar solo cómo se muestra | Si usan salas |
| División como texto libre | "A", "a", "A " o "División A" conviven | Letras normalizadas con selector, o lista cerrada si hay orientaciones | Si son solo letras o también orientaciones |
| Crear materia desde el curso | El diálogo de materia-curso permite crear materias al vuelo, duplica el alta del catálogo | Crear solo desde el catálogo | Decisión del equipo |
| Horarios con input nativo | El formato depende del idioma del navegador | Selectores de hora (07 a 22) y minutos (de a 5) en 24 h | Decisión del equipo |
| Formato del curso | Se muestra de 6 formas distintas entre módulos | Función compartida en `frontend/src/lib/` con un único patrón | Depende de lo de salas |

## Qué se verificó

- Backend: `ruff check` y `ruff format --check` sobre `src/` y `tests/`, y `pytest tests/academico/` (139 tests). Tests nuevos: niveles de solo lectura (405), superposición en división (total, parcial, contigua, otra división, editar excluyéndose), superposición de docentes (ciclo, pareja pedagógica, bulk, cambio de horario, mover asignación) y hora con zona.
- Migración: `upgrade`, `downgrade` y `upgrade` en la base local (ya tenía los tres niveles, así que no insertó nada) y el `INSERT` probado en una transacción con rollback.
- Frontend: `tsc -b`, `eslint .`, `prettier --check` y `vitest` del módulo académico (selección por URL, carga por tramos, grilla, conflictos, estados vacíos y permisos).
- Suite completa de backend: 1354 tests pasan, sin `tests/comunicaciones/` (no se pudo importar por dependencias que faltan en el venv local, como `pypdf`, ajenas a este cambio).
- Suite completa de frontend: 707 de 710 pasan. Los fallos fueron timeouts de 5 s en `historial-asistencia-page` y `usuario-alta-page` bajo carga; corridos solos pasan.
- Revisión de los commits de backend por una segunda IA; el único hallazgo (hora con zona) está corregido.

## Qué no se verificó

- No se recorrió la pantalla a mano en el navegador (por ejemplo, el AM/PM con el navegador en inglés, el click en bloques y huecos de la grilla, o la vista con un usuario de dirección). Hay que probarlo antes de sacar el PR de borrador.
- `tests/comunicaciones/` no se corrió (faltan dependencias en el entorno local).
- No se probó la migración sobre una base con niveles de más o con otros nombres.
