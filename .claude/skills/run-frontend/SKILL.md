---
name: run-frontend
description: Launch and drive the ESSERI frontend (React + Vite + TypeScript) in a real browser via chromium-cli. Use when asked to run, start, or screenshot the frontend, or confirm a UI change works in the real app (not just vitest).
---

Paths below are relative to the **repo root**. This is a browser-driven app — the
driver is `chromium-cli` (the `mcp__claude-in-chrome__*` tools), no custom script
needed. **Always call `mcp__claude-in-chrome__tabs_context_mcp` before any other
browser tool.**

## Prerequisites

- Node 20+ (this repo has been run with Node 26), deps already installed via `npm
  install` in `frontend/` (check `frontend/node_modules` exists; if not, run it).

## Run (agent path)

1. Launch the dev server in the background:
   ```bash
   cd frontend && npm run dev -- --host 0.0.0.0
   ```
   Wait for the `VITE ... ready` line / `http://localhost:5173/` to print.
2. Drive it with chromium-cli:
   ```
   tabs_context_mcp { createIfEmpty: true }        # get a tabId
   navigate { tabId, url: "http://localhost:5173" }
   computer { action: "screenshot", tabId }
   read_console_messages { tabId, pattern: "." }   # check for route/JS errors
   ```
3. Kill the dev server when done (`kill <pid>` of the `npm run dev` process), and
   `tabs_close_mcp` the tab you opened.

Verified working in this container: the server boots on port 5173 and the tab loads
without a network error.

## Run (human path)

```bash
cd frontend
npm run dev
```

Opens at `http://localhost:5173` with hot-reload. `Ctrl-C` to stop.

## Test

```bash
cd frontend
npm run test       # vitest, runs once
npm run lint
```

`npm run test:e2e` (Playwright) exists in `package.json` but **`frontend/e2e/` has no
spec files yet** (`testDir: './e2e'` in `playwright.config.ts` points at an empty
folder) — running it currently does nothing useful; don't treat a clean run as
verifying anything.

## Gotchas — there is currently nothing to click

Verified directly in this container: navigating to `http://localhost:5173/` renders a
**blank page**, and the console logs `[vite] ... No routes matched location "/"`. This
is not a bug in this skill — every one of the 10 `modules/<modulo>/routes.tsx` files
currently exports an empty `RouteObject[]` (e.g. `frontend/src/modules/auth/routes.tsx`
is just `export const authRoutes: RouteObject[] = []`), so **no path in the app matches
any route yet**, including module paths like `/facturacion` (also confirmed blank).
`AppLayout` itself renders nothing extra outside the routed `<Outlet/>` (no sidebar
nav yet), so there is no shell chrome to check either.

**What this means for verifying a change:** until a module adds real routes, the only
meaningful check is "does the server boot and does the console stay clean of errors
beyond the expected 'No routes matched' warning." Once a module's `routes.tsx` gets a
real `path`, extend the agent-path sequence above with a `navigate` to that path plus
whatever `computer`/`find`/`form_input` calls the new flow needs (click a button, fill
a form) — the harness doesn't change, only the URL and interactions you drive it with.

## Troubleshooting

- Blank page + "No routes matched location X" in console → expected right now for any
  path; see Gotchas. If this appears for a path that a module's `routes.tsx` *does*
  define, the routes array probably isn't being spread into `moduleRoutes` in
  `frontend/src/router/index.tsx`.
- `get_page_text` returns "No text content found" → normal on this blank shell; use
  `read_console_messages` and `read_page` instead to confirm what actually rendered.
