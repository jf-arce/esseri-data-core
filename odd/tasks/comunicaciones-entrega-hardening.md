# Communications delivery hardening

Objective: close the delivery-table stage by fixing the confirmed P0 authorization, P1 privacy/functional, and quick P2 findings without expanding scope.
Branch: `feat/comunicaciones-detalle-ux`; base: `8c36123`. Delivery: ask-on-risk; local work units, no push/PR. Test runner: backend `pytest`; frontend `vitest`.

## Specs

- S1: `GET /{id}/entrega` MUST reject `curso` communications for generic staff; the author docente keeps access through `GET /docente/{id}/entrega`. A staff role with `comunicaciones.leer` receives 404 for a `curso` communication, the author docente receives 200, and another docente receives 404.
- S2: `GET /{id}/envios` and `GET /docente/{id}/envios` MUST return `Cache-Control: private, no-store`; response bodies stay unchanged.
- S3: The delivery table MUST NOT dead-end when the current page exceeds `total_paginas`; it MUST clamp to a valid page and refetch, or offer a recovery action. Regression scenario: filter `fallidos`, go to page 2, retry the only failed row, total drops, page 2 becomes empty.
- S4: `errorReintento` MUST clear when the user reloads the delivery, and the retry error alert MUST disappear after a successful reload.
- S5: `buscar` MUST treat `%` and `_` as literal characters; a search for `%` must not match every responsible.
- S6: Preserve existing behavior: deterministic ordering with tiebreaker, totals over the same filtered set, one row per responsible via `EXISTS`, no invented delivered/bounce states, retry only for `fallido` (409 otherwise), AbortController guard, frontend/backend parameter match, and page reset on filter/search.
- S7: Update the module README(s) for the authorization boundary and cache behavior; no migration.

## Tasks

- T0 [S6]: done; baseline commit `7b64f22`; focused baseline 65 passed, 10 skipped (backend), 31 passed (frontend).
- T1 [S1]: done; commit `62efeb1`; RED 200 → GREEN 404; independent verifier confirmed; non-author staff regression in `3be1ac8`.
- T2 [S2]: done; commit `62efeb1`; RED missing header → GREEN private/no-store; independent verifier confirmed.
- T3 [S3]: done; commit `f87deb0`; RED dead-end → GREEN clamp/refetch.
- T4 [S4]: done; commit `f87deb0`; RED alert persisted → GREEN clears on reload.
- T5 [S5]: done; commit `62efeb1`; RED `%`/`_` matched all → GREEN literal wildcards; recipient lists covered in `3be1ac8`.
- T6 [S7]: done; backend README in `62efeb1`, frontend README in `f87deb0`.
- T7 [S1-S6]: in progress; independent verifier confirmed S1/S2/S6 with no blockers; full backend 1348 passed, 10 skipped and full frontend 649 passed before the final follow-up; lint/build passed; full rerun and native review pending.

## Log

- L1: User request (verbatim): "La arquitectura Harness/ODD ya quedó validada con DeepSeek Max.

Quiero continuar trabajando normalmente con Gentle AI, aprovechando la orquestación completa.

Antes de implementar cambios, realizá el triage de los hallazgos de la auditoría de comunicaciones, priorizando seguridad, autorización, privacidad e inconsistencias funcionales.

Aplicá correctamente las reglas ODD:
- Delegación justificada según complejidad.
- Contexto y skills adecuados en los handoffs.
- Sección Key Learnings cuando corresponda.
- Verificación independiente de hallazgos.
- Tracking ODD para implementaciones que lo requieran.
- Review nativo antes de cerrar cambios relevantes, respetando sus requisitos y permisos.

No modifiques código todavía. Entregá un plan priorizado con hallazgos confirmados, riesgos y pruebas necesarias.

No necesito otra auditoría general de Gentle AI; quiero utilizarlo para avanzar con ESSERI."
- L2: User: "sigamos con el cierra de la etapa"
- L3: User: "dake" — confirmed the secure P0 default and the P0/P1/P2-quick close scope. Follow-ups: metrics global vs. filtered, `sin_email` counter, C1/C4 hardening, search debounce.
- L4: T1/T2 implemented in `62efeb1`: generic `GET /{id}/entrega` now calls `obtener(tipo="institucional")`; `/envios` and `/docente/{id}/envios` set `Cache-Control: private, no-store`. T5 applied literal LIKE escaping through `_patron_busqueda`. backend/tests added RED→GREEN coverage.
- L5: T3/T4 implemented in `f87deb0`: out-of-range delivery pages clamp to a valid page before rendering, and `recargar` clears `errorReintento`. Component regressions added.
- L6: Verification so far: focused backend 66 passed/10 skipped; focused frontend 33 passed; full backend 1348 passed/10 skipped; full frontend 649 passed; `ruff check`/`format --check`, frontend `lint` and `build` passed. Native review and independent verification remain.
- L7: Independent `gentle-ai-verify` (DeepSeek Go max, scratch copy) confirmed S1, S2 and S6 with no blockers: S1 404/200/404, S2 exact private/no-store on both `/envios` endpoints with identical bodies, S6 ordering/pagination/retry preserved. Advisories: generic course surface remains reachable through sibling endpoints (`/{id}`, `/destinatarios`, `/envios`, retry) — pre-existing and outside the confirmed P0 scope; `/destinatarios` search wildcards were still unescaped — fixed in `3be1ac8`; the original S1 test used the author acting as staff — non-author staff regression added in `3be1ac8`.
- L8: Follow-ups kept out of this close: metrics global vs. filtered, `sin_email` counter semantics, C1/C4 hardening, search debounce, and the pre-existing generic course surface through sibling endpoints.
