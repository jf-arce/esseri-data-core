# Admissions Documentation File Uploads
Objective: Replace text-only document references with stored, authorized admissions uploads.
Branch: `feat/admisiones-documentos-adjuntos` | Delivery: ask-on-risk | Forecast: ~330 authored lines.
Tests: `backend/.venv/bin/pytest`; `frontend/node_modules/.bin/vitest`.

## Specs

### S1 — Document type
User request: “quiero que el tipo sea un desplegable”.
Acceptance: Replace free text with the approved options: DNI del aspirante; DNI del responsable o tutor; Partida de nacimiento; Certificado de vacunas; Ficha médica o apto físico; Contrato de matrícula; Comprobante de domicilio; Certificado de estudios o pase escolar; Otro. Backend rejects values outside this catalog.

### S2 — Real file upload and filename reference
User request: “el agregar documentacion sea un seleccionador de archivos no algo texto, y lo que dice de referencia tiene que decir el nombre del archivo q se adjunto.”
Acceptance: Upload a selected file, persist its content and metadata using the existing nullable binary columns, and show its stored filename in the document card. Accept PDF, JPG/JPEG, and PNG up to 5 MiB; validate declared MIME type and binary signature.

### S3 — Authorized review access
User request: “ese archivo q se sube, cualquiero otro lo pueda ver/dewscargar”.
Acceptance: A user with Inscripciones read permission can view or download the stored file; upload requires Inscripciones update permission. A file lookup must remain scoped to its parent admission request.

## Tasks

- T1 — S1-S3 — inline — implemented; own and independent verification passed; native review pending — commit pending.

## Log

- L1 — Original request: “listo mergeado, ahora, quiero corregir eso de documentacion, quiero que el tipo sea un desplegable y el agregar documentacion sea un seleccionador de archivos no algo texto, y lo que dice de referencia tiene que decir el nombre del archivo q se adjunto. Cualquier duda me consultas, siempre antes de implemetnar”
- L2 — 2026-10-24: User approved the proposed document-type catalog, view/download access for authorized users, and PDF/JPG/PNG files limited to 5 MiB. No product questions remain.
- L3 — 2026-10-24: Implemented multipart uploads into the existing binary columns; validates MIME, signature, filename, and a 5 MiB cap; provides read-authorized inline/view and attachment/download responses scoped to the parent request; UI now uses a typed dropdown, file picker, persisted filename, and view/download links. Responses use `private, no-store`.
- L4 — 2026-10-24: Backend admissions suite passed (89 tests); frontend full suite passed (451 tests); TypeScript `tsc -b` passed; Ruff lint/format checks passed. Existing Starlette deprecation and React `act` warnings remain. A frontend test command needs escalation because Vite writes a temporary config under `node_modules`.
- L5 — 2026-10-24: Independent verification passed S1-S3 without blockers. The parent spot check reproduced the verifier's full candidate suite result (90 passed, one existing Starlette/httpx deprecation warning); verifier scratch was removed. Next: perform the native RDD risk assessment and follow its exact returned transition. No push or PR has been requested.
