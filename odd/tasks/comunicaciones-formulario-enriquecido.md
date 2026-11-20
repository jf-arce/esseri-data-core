# Communication form refinement
Branch: `feat/comunicaciones-formulario-enriquecido` from `d29e3ec`. Delivery: ask-on-risk; forecast exceeds 400 authored lines.
Runners: Vitest and pytest. Keep changes inside Communications and its delivery/calendar integration.

## Specs
- S1. “Reemplazar las tres tarjetas actuales por un único selector desplegable.” Show icons and the three requested descriptions in the open menu; “mostrar únicamente el nombre de la opción seleccionada.” Keep existing values and logic.
- S2. “Solo portal”, “Solo email”, “Portal y email”. “Mostrar una breve descripción por opción al desplegar el selector.” Place selectors side by side where they fit and stack on small screens.
- S3. “Reemplazar el textarea actual del campo Mensaje por un editor WYSIWYG moderno, preferentemente TipTap.” Support bold, italic, underline, strike, headings, paragraphs, ordered/unordered lists, alignment, links, fixed highlight, undo/redo and compatible pasted formatting. “lo de elegir el color del texto y del fondo del texto sacalo”: no text/background color pickers; existing formats remain readable. Preserve legacy content and draft flows, sanitize content and render in portal and email.
- S4. “Agregar evento al calendario del Portal Familia”. Checkbox initially off and collapsed; enable expands, disable hides and suppresses creation, collapse does not disable. Required title/date, optional start/end, location and description. Validate date and time. Publish once, honor recipients and permissions, include email-only publications and exclude drafts. Reuse the current calendar.
- S5. “Conservar el flujo de creación actual, incluyendo el botón **Siguiente**, el guardado de borradores y los pasos posteriores.” Preserve header, existing theme, spacing and responsive behavior. Do not change attachments or recipient/channel rules.
- S6. “Agregar o actualizar los tests necesarios.” Verify persistence, backward compatibility, safe rendering, optional event lifecycle and permissions, and existing flows.
- S7. “as comunicaciones q estan en borrador y no tienen asunto , queda rara la vista desde el listado, que diga sin asunto al menos”

## Tasks
- T1 · S1–S2, S5–S6 · inline · b788458 · selectors and unchanged wizard flow.
- T2 · S3, S5–S6 · inline · verified · editor, safe rendering and compatibility · risk 2/5.
- T3 · S4–S6 · inline · 6e67049, native review pending · draft event intent, publication and calendar · risk 1/2/4.
- T4 · S7 · inline · e09c002 · make untitled draft links readable.

## Log
- L1 · User requested the four scoped form changes, visual parity with current ESSERI using the supplied mockup as reference, pre-implementation module analysis, fresh `main`, and no changes to other branches.
- L2 · Anonymous fetch authorized and confirmed local `main` at `d29e3ec`; independent worktree created. Existing publication records recipient family and student scope for all channels; existing family calendar is a weekly view of class schedules.
- L3 · Selector regressions observed RED (three missing comboboxes), then GREEN (69 Communications tests); lint passed for touched files.
- L4 · User: “as comunicaciones q estan en borrador y no tienen asunto , queda rara la vista desde el listado, que diga sin asunto al menos”
- L5 · T4 regression observed RED (missing named link) then GREEN; all 79 scoped frontend tests, targeted lint and TypeScript passed.
- L6 · T3 newly added APIs and UIs observed RED then GREEN. Generated Alembic revision against isolated SQLite base metadata stamped at the parent, and tested upgrade, check, downgrade and upgrade. A PostgreSQL runtime check and independent permission review are pending.
- L7 · Independent T3 verification: 10 authorized API tests and 18 isolated probes passed; SQLite migration preserved the legacy row. The new-link denial probe was added to the regression suite and the 11 focused backend tests passed. PostgreSQL runtime was unavailable.
- L8 · User authorized anonymous npm install for the editor in the isolated worktree. T2 uses a validated editor document alongside the legacy plain-text field. Backend rich-body and mail transport tests observed RED then GREEN; 80 frontend and 114 backend tests passed, 11 backend skipped. SQLite migration upgraded and matched metadata.
- L9 · User: “lo de elegir el color del texto y del fondo del texto sacalo”
- L10 · Independent T2 verification: no behavior defect, but S6 was unmet because committed tests did not lock safe rendering. Added the verifier's hostile-document, email-escaping, legacy-compatibility and paste probes as regression tests; the fixed highlighters replaced the color pickers. 121 backend tests passed, 11 skipped; 78 frontend tests and 10 mocked-API browser tests in desktop and mobile passed; build and SQLite schema check passed. PostgreSQL runtime remains unverified.
- L11 · User: “cargale materias”. Preview-only schedule seeded outside the repository; family calendar showed 19 class slots plus the published event.
