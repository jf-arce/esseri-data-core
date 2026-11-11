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
| 7 | Pestañas de nivel, desplegables de año y división (con botones para agregar y editar, la baja va dentro del diálogo de edición) y pestañas "Materias" y "Horario". Estado en la URL (`?nivel=&anio=&division=`). Los datos se cargan por tramo, con skeletons que mantienen las medidas. |
| 8 | El catálogo pasa a `academico/materias`, con entrada propia en el menú. |
| 9 | Cada materia tiene un color (`#rrggbb`) que se elige con un selector y se ve igual en todas las divisiones: tarjetas, horario semanal y catálogo. Si no se elige, se sortea de una lista sugerida (también al crear la materia desde el curso). |
| 10 | El horario semanal se lee mejor: abre un popover al hacer clic en un bloque (con Editar y Eliminar), resalta la materia al pasar el mouse y dibuja lado a lado las franjas que se pisan (datos anteriores a la validación). Los bloques van en una capa por columna con posición en porcentaje, lo que también corrige las franjas con minutos que no son múltiplos de 30. |
| 11 | El horario semanal se edita directo: arrastrar un bloque lo mueve, el borde inferior lo estira, barrer un hueco crea una materia, y con el teclado las flechas mueven (Mayús estira, Escape cancela). Todo va de a 30 minutos conservando el desfase. Con el dedo, el gesto empieza con una pulsación larga (si no, es scroll). Se guarda al soltar: el backend reemplaza todas las franjas de la materia en cada PUT, así que se reenvían todas y, si el backend responde 409 (por ejemplo, un docente con clase en otra división), el bloque vuelve y se muestra el mensaje. La grilla no cambia de escala mientras dura un gesto o un guardado. |

Además se corrigió un 500 que encontró la revisión: una hora con zona horaria rompía la comparación de superposición. Ahora el schema la rechaza con 422.

### Horario semanal: verificado y pendiente de prueba manual

- Verificado con tests: helpers de posición, solapados, mover y estirar (`utils.test.ts`), guardado optimista con reversión (`use-guardar-franjas.test.ts`) y teclado (`horario-semanal.test.tsx`).
- Pendiente de probar a mano: franja 08:40 bien ubicada, arrastre con mouse, pulsación larga en celular o con emulación táctil, y un choque de docente en otra división para ver la reversión con el mensaje del 409.
- En pantallas angostas, al arrastrar un bloque cerca del borde la grilla se desplaza sola (probado con mouse en un viewport de 500 px).

## Cambios que rompen compatibilidad

- Se quitan `POST /academico/niveles`, `PUT /academico/niveles/{id}` y `DELETE /academico/niveles/{id}` (ahora devuelven 405). Se eliminan también sus schemas, servicios y excepciones.
- Nueva ruta del catálogo de materias: `/academico/materias`.
- Nuevos 409 en `POST/PUT /academico/materias-curso` (horario superpuesto en la división o para un docente asignado) y en `POST/PUT /academico/asignaciones-docentes` y `/bulk` (docente con horario superpuesto). El 409 `HorarioDuplicado` ahora también cubre superposición parcial.
- Se quitan del frontend `nivel-seccion`, las estadísticas, la búsqueda sobre el árbol y la carga de todo el árbol al entrar.
- `Materia.color` es obligatorio. La migración `bbaa88d6e3ea` completa las existentes con colores de una lista fija, por orden de nombre. Se agrega `react-colorful` al frontend: hace falta `npm install`.
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

- Backend: `ruff check` y `ruff format --check` sobre `src/` y `tests/`, y `pytest tests/academico/` (154 tests). Tests nuevos: niveles de solo lectura (405), superposición en división (total, parcial, contigua, otra división, editar excluyéndose), superposición de docentes (ciclo, pareja pedagógica, bulk, cambio de horario, mover asignación) y hora con zona.
- Migraciones: `upgrade`, `downgrade` y `upgrade` en la base local. La de niveles no insertó nada (ya tenía los tres) y su `INSERT` se probó en una transacción con rollback. La de color se aplicó sobre las materias existentes.
- Frontend: `tsc -b`, `eslint .`, `prettier --check` y `vitest` del módulo académico (selección por URL, carga por tramos, grilla, conflictos, estados vacíos y permisos).
- Suite completa de backend: 1354 tests pasan, sin `tests/comunicaciones/` (no se pudo importar por dependencias que faltan en el venv local, como `pypdf`, ajenas a este cambio).
- Suite completa de frontend: 707 de 710 pasan. Los fallos fueron timeouts de 5 s en `historial-asistencia-page` y `usuario-alta-page` bajo carga; corridos solos pasan.
- Revisión de los commits de backend por una segunda IA; el único hallazgo (hora con zona) está corregido.

## Qué no se verificó

- La pantalla se recorrió a mano una vez en el navegador (carga con demora y estados de carga), pero no todo: el AM/PM con el navegador en inglés, el cambio de año y de división con la carga lenta, el skeleton de Horario, colores muy claros o muy oscuros y la vista con un usuario de dirección. Hay que probarlo antes de sacar el PR de borrador.
- `tests/comunicaciones/` no se corrió (faltan dependencias en el entorno local).
- No se probó la migración sobre una base con niveles de más o con otros nombres.
