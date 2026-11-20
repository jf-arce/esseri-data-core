# Family calendar: institutional events in the weekly grid

Branch: `feat/comunicaciones-formulario-enriquecido` (continues the Communications/calendar work). Delivery: ask-on-risk.
Runners: Vitest and pytest. Scope: family calendar, its event projection and Comunicaciones linking.

## Specs
- S1. Institutional events also render inside the weekly grid, respecting date, start and end time. Materias keep their blocks. Events use ESSERI violet. The bottom "Eventos del colegio" section stays and stays synchronized.
- S2. Overlaps are visual only: partial overlaps split the shared interval into parallel columns; total overlaps show class and event side by side at about 50% each; three or more simultaneous activities use a compact representation with a “+N más” control that exposes the hidden ones. Nothing covers or truncates another block. Materia colors and the class schedule/state do not change.
- S3. Selecting an event from the grid or the bottom section opens a right Side Sheet built on the existing shadcn sheet: title, “Evento del colegio” tag, date, start/end time, place, description, and “Ver comunicación relacionada” when a linked communication exists and the family may see it. Overlapping activities are listed as informative context, never as a cancellation. Closes with X, Escape or outside click, stays responsive and keyboard accessible, and keeps the calendar context.
- S4. The visible time range grows dynamically when events fall before or after the school day. Materia times never change. Avoid an unnecessarily long grid.
- S5. Events keep coming from the published Comunicaciones records through the existing projection and permissions: no drafts, no duplicates, no other family's or student's information, and email-only publications may still show the event. Date/time changes and cancellations in Comunicaciones are reflected.
- S6. Preserve the family portal header, student selector, week navigation, filters, materia block style, current class detail panel and ESSERI tokens.
- S8. Full-width grid with no fixed class-detail panel; classes open a Popover on desktop and a bottom Sheet on mobile, events keep the Side Sheet (bottom variant on mobile), and all prior filters, week navigation, student selector, events and overlap rendering stay intact.
- S7. Tests cover no overlap, partial overlap, total overlap, three or more simultaneous activities, events outside school hours, multi-interval events, week and student changes, audience visibility, Side Sheet open/close, navigation to the linked communication, and materi/horario regressions.

## Tasks
- T1 · S1–S2, S7 · done · interval/lane utilities with tests.
- T2 · S1–S2, S6–S7 · done · grid renders events and overlapping lanes · risk 5.
- T3 · S3, S6–S7 · done · event Side Sheet, overlap context and communication link.
- T4 · S1, S6–S7 · done · synchronized bottom section opens the same Side Sheet.
- T5 · S4, S6–S7 · done · dynamic visible range for events outside school hours.
- T6 · S5, S7 · done · audience/week/student coverage through the existing projection.

## Log
- L1 · User asked to extend the existing family calendar with institutional events inside the weekly grid, visual overlap handling, a right Side Sheet, out-of-hours range support and Comunicaciones linkage, without redesigning the calendar. Mockup: “Conflicto de horarios escolares”.
- L2 · Existing pieces reused: `portal-familia-calendario-page.tsx` grid, `EventosCalendarioFamilia` bottom list, `GET /comunicaciones/familia/eventos`, receipt-scoped projection, and the installed shadcn `sheet`. Printing now mirrors the spreadsheet export and no longer shows Saturday unless a class exists there.

- L3 · Overlap uses interval partitioning per weekday (`utils-calendario.ts`): up to two full lanes, the third summarizes hidden activities behind “+N más”, and the range only grows when an event falls outside 07:30–16:30. Events without times stay out of the grid and remain in the bottom list.
- L4 · `GrillaSemanal`, `EventoDetalleSheet` and `GrupoActividadesSheet` added; the bottom section and the grid share `useEventosFamilia`, so week and student changes reload both. 282 frontend tests passed; production build clean.
- L5 · Verified in the running preview: total overlap at 50%, evening event extending the grid to 19:30, Side Sheet from grid and list, overlap notice without cancellation wording.

- L6 · Fixed detail panel removed. `DetalleMateria` feeds a controlled Popover anchored to each class card and a bottom Sheet in the mobile agenda; the event Side Sheet now uses a bottom side below 768 px. Grid width went from 1071 to 1310 px at 1440 px, overlap cards from 91 to 118 px. 286 frontend tests, lint and build passed; verified in the browser at 1440 and 390.
