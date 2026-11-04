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

- T0 [S6]: baseline commit of the current delivery-table worktree (excluding `.atl/` and `.playwright-mcp/` scratch); focused baseline tests.
- T1 [S1]: backend P0 authorization; inline; tests; independent verification.
- T2 [S2]: backend P1 cache headers; inline; tests; independent verification.
- T3 [S3]: frontend page clamp; inline; component regression test.
- T4 [S4]: frontend retry error clear; inline; component regression test.
- T5 [S5]: backend LIKE escaping; inline; tests.
- T6 [S7]: README updates; inline.
- T7 [S1-S6]: focused/full verification, independent verifier for T1/T2, native review for high-risk commits.

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
