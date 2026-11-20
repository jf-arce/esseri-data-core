# Communication form refinement
Branch: `feat/comunicaciones-formulario-enriquecido` from `d29e3ec`. Delivery: ask-on-risk; forecast exceeds 400 authored lines.
Runners: Vitest and pytest. Keep changes inside Communications and its delivery/calendar integration.

## Specs
- S1. “Reemplazar las tres tarjetas actuales por un único selector desplegable.” Show icons and the three requested descriptions in the open menu; “mostrar únicamente el nombre de la opción seleccionada.” Keep existing values and logic.
- S2. “Solo portal”, “Solo email”, “Portal y email”. “Mostrar una breve descripción por opción al desplegar el selector.” Place selectors side by side where they fit and stack on small screens.
- S3. “Reemplazar el textarea actual del campo Mensaje por un editor WYSIWYG moderno, preferentemente TipTap.” Support bold, italic, underline, strike, headings, paragraphs, ordered/unordered lists, alignment, links, colors, highlights, undo/redo and compatible pasted formatting. Preserve legacy content and draft flows, sanitize content and render in portal and email.
- S4. “Agregar evento al calendario del Portal Familia”. Checkbox initially off and collapsed; enable expands, disable hides and suppresses creation, collapse does not disable. Required title/date, optional start/end, location and description. Validate date and time. Publish once, honor recipients and permissions, include email-only publications and exclude drafts. Reuse the current calendar.
- S5. “Conservar el flujo de creación actual, incluyendo el botón **Siguiente**, el guardado de borradores y los pasos posteriores.” Preserve header, existing theme, spacing and responsive behavior. Do not change attachments or recipient/channel rules.
- S6. “Agregar o actualizar los tests necesarios.” Verify persistence, backward compatibility, safe rendering, optional event lifecycle and permissions, and existing flows.

## Tasks
- T1 · S1–S2, S5–S6 · inline · verified · selectors and unchanged wizard flow.
- T2 · S3, S5–S6 · pending · editor, safe rendering and compatibility · risk 2/5.
- T3 · S4–S6 · pending · draft event intent, publication and calendar · risk 1/2/4.

## Log
- L1 · User requested the four scoped form changes, visual parity with current ESSERI using the supplied mockup as reference, pre-implementation module analysis, fresh `main`, and no changes to other branches.
- L2 · Anonymous fetch authorized and confirmed local `main` at `d29e3ec`; independent worktree created. Existing publication records recipient family and student scope for all channels; existing family calendar is a weekly view of class schedules.
- L3 · Selector regressions observed RED (three missing comboboxes), then GREEN (69 Communications tests); lint passed for touched files.
