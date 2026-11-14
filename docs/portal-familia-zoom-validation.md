# Family portal zoom validation

Date: 2026-11-14. Candidate: `feat/portal-calendario`, based on `fbd40a0`, plus
the uncommitted billing/calendar layout corrections described below.

**Overall result: partial.** The two targeted layout regressions passed the
exercised Chrome matrix and the available Safari desktop scenario. Safari's
remaining native zoom levels and responsive widths are **not verified**.
The selected-day keyboard-focus defect also remains open. This is not an
all-browser, accessibility or branch-closure approval.

## Environment and baseline

- Real local HTTP API using the isolated test SQLite database, not production or
  shared data. API was restarted; both IPv4 and IPv6 loopback health checks return
  HTTP 200. The previously blocked clipping probe then exited 0.
- Candidate frontend on `http://localhost:5173`; isolated API on port 8012.
- Cached `origin/main` = `9327d46`, the branch merge-base and relevant redesign
  baseline. Local `main` = `076c549`, 181 commits behind it, was compared separately.
  Neither reference was fetched or advertised as current remote state.
- Same family account, invoice values, theme and CSS viewport widths used for
  before/after comparisons. Opening communications details marked only isolated
  test receipts read. No absence request was submitted.
- No Firefox/Edge installation, system setting changes, commit, merge or remote
  publication was performed.

## Classification and corrections

| Finding                                            | Compared with `9327d46`                                                           | Local correction                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Billing amounts painted over at 720/768 CSS px     | Candidate reduced space further; baseline sizing was fragile but amounts readable | Remove duplicate content padding and stack summary tiles below `lg`; skeleton follows the same breakpoint                         |
| Dark attendance dialog in light portal             | Reproduced in baseline and candidate                                              | Corrected in this branch by scoping the light family token set to the portaled dialog; verified with the global dark theme active |
| “Miércoles” overflows mobile day tab at 390 CSS px | New candidate agenda UI; no equivalent baseline tabs                              | Wrap whole day controls, preserve full labels, use body text scale and minimum 40px height                                        |

Pre-existing issues and the architecture/theme documentation discrepancy are
recorded in [the separate defect report](portal-familia-preexisting-visual-defects.md).
No shared tile, token, global theme, API, validation or business logic was changed.

## Chrome 156.0.8078.80: native zoom

An isolated Chrome profile applied `partition.default_zoom_level` before launch,
using `log(factor) / log(1.2)`. The fixed 1440 by 900 OS window, effective CSS
viewport, DPR and `visualViewport.scale = 1` verified page zoom. This was not CSS
zoom, viewport resizing, pinch emulation or a device-scale override. It did not
exercise the browser's menu/keyboard shortcut path.

| Native zoom | Effective CSS viewport | DPR | Billing                 | Calendar    |
| ----------- | ---------------------- | --- | ----------------------- | ----------- |
| 50%         | 2880 by 1626           | 1   | Full amounts, 3 columns | Weekly grid |
| 75%         | 1920 by 1084           | 1.5 | Full amounts, 3 columns | Weekly grid |
| 100%        | 1440 by 813            | 2   | Full amounts, 3 columns | Weekly grid |
| 125%        | 1152 by 650            | 2.5 | Full amounts, 3 columns | Weekly grid |
| 150%        | 960 by 542             | 3   | Full amounts, stacked   | Day agenda  |
| 200%        | 720 by 406             | 4   | Full amounts, stacked   | Day agenda  |
| 300%        | 480 by 271             | 6   | Full amounts, stacked   | Day agenda  |

At every level, all five portal routes loaded real data and remained navigable;
the attendance dialog opened, its footer was reachable by scrolling where needed,
and it closed. There was no document horizontal overflow or console/page error.
Billing values remained `$ 960.000`, `$ 360.000` and `$ 600.000`, with their text
ink inside each tile rather than merely absent from an overflow scan.

The two-hour Tuesday class (`10:00` to `12:00`) spanned grid rows `4 / 6`;
selection retained the complete time range in the detail panel.

## Responsive tests, separate from native zoom

Chrome viewport widths: **320, 390, 640, 720, 768, 960, 1023, 1024 and 1440 CSS px**.
Billing amounts fit, calendar controls did not overlap and document width stayed
within the viewport in the exercised states.

- At 320 px, full day names wrap into three rows; at 390 px, two rows.
- Day controls are at least 40px high, all five select the expected day/classes.
- At 1023 px, the billing summary is stacked; at 1024 px, three columns fit.
- These are desktop browser viewport tests, not physical iPhone/iPad testing.

## Safari 26.6: verified subset and explicit limits

Remote automation now creates an isolated WebDriver session. The authenticated
site's observed native zoom is **75%**, verified by outer width 800, inner width
1066, DPR 1.5 and `visualViewport.scale = 1` in the final run.

At this actual desktop state, all five routes loaded real data; billing amounts
fit; the attendance dialog opened, scrolled and closed; the two-hour calendar
block and selection detail rendered correctly. Computed classes/styles confirmed
the corrected CSS was loaded (zero duplicate padding and the new `lg` breakpoint).

**Not verified:** Safari at 50%, 100%, 125%, 150%, 200%, 250% or 300%, and Safari
mobile/responsive widths. The 100% observation on a different loopback host was
only an unauthenticated shell and does not certify portal functionality there.
At 75%, the effective width exceeds 1024 px, so the mobile agenda is hidden and
its Safari layout remains unverified.

WebDriver zoom shortcuts left metrics unchanged, the `safari/setPageZoom` endpoint
returned an unsupported-command response, and window resize requests did not
take effect. No extra system permissions/settings or personal browser controls
were used to work around these limits. A manually controlled Safari zoom pass
is still needed before approving that matrix.

## Selected-day focus review

**Open accessibility defect owned by this branch. Not introduced by the latest
billing/day-tab layout correction; not a confirmed pre-existing main defect.**

`index.css:415-421` uses `outline: none !important` and a 1.5px box-shadow as a
global keyboard-focus indicator. Those rules are identical in `main`,
`origin/main`, `fbd40a0` and the current worktree. The calendar's selected day uses
`shadow-sm` both before and after the latest layout correction; its utility-layer
shadow overrides the global base-layer focus shadow. The newly added outline
utilities cannot override the global `!important` declaration.

The recorded browser probe matched `:focus-visible`: unselected days showed a
violet focus ring, while the selected day retained only its ordinary shadow.
The selected appearance is present even without focus, so it cannot identify
the current keyboard location. This affects keyboard accessibility and violates
the visible-focus requirement in `DESIGN.md` section 12. It is consistent with a
[WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
failure in that exercised state, not a full WCAG audit.

The baseline calendar has no equivalent day-tab controls. Therefore, an existing
global CSS weakness does not excuse the new branch control as a main-baseline
defect. The issue predates the latest correction, but remains open on the branch.
No focus-related source change was authorized or performed in this final review.
The smallest follow-up would scope an effective focus indicator to these controls
without changing global focus rules or other modules.

## Final review scope

The uncommitted correction remains five added and five removed source lines in
two existing page files. Only responsive layout/typography/target classes and an
ineffective focus-outline declaration changed. No imports, dependencies, API,
auth, data handling, state, handlers, shared components or configuration changed.

Module locations and kebab-case conventions follow `ARCHITECTURE.md`; body-scale
text, 40px targets and content reflow follow `DESIGN.md`. Full design compliance
is **not** claimed because the selected-day focus defect remains unresolved.
Existing palette/gradient/shadow choices and the light/dark documentation drift
were not redesigned. No side effect was observed in the previously recorded
functional/layout matrix; this is not proof of absence outside those cases.

The stored test logs and browser results were cross-checked for this review;
the suites and zoom matrix were not rerun because no application bytes changed.
The human's acceptance of the Chrome corrections does not extend to Safari.
The human Safari run is tracked separately in
[the manual checklist](portal-familia-safari-manual-checklist.md); all its rows
start Not run and must not inherit the automated 75% result.

## Functional checks and evidence

- Focused Vitest: **23 passed** across the two affected page test files. Parent
  repeated this check after delegated verification: **23 passed** again.
- Full frontend suite: **933 passed**, **132 test files passed**.
- `npm run lint`: exit 0, no findings.
- `npm run build`: exit 0; existing large-bundle advisory remains.
- Targeted Prettier check: exit 0, including the final documentation. No jsdom geometry test was added for this
  pure layout correction; real-browser before/after probes provide layout proof.
- Backend suite was not rerun: no backend source changed. SQLite QA does not
  establish PostgreSQL-specific behavior.
- Native review assessment: medium, `review_due: false`, `under_budget` after
  declaring all three intended untracked documents (five total paths, 247 changed
  lines at assessment). No review approval is claimed.

External local evidence directories under the session's system temporary root:

- `phase1-baseline.172nJo`: baseline copies, before screenshots, Safari feasibility.
- `phase2-postfix.qc70xJ`: `json/final-chrome.json`, `json/safari-final.json`,
  `summary2.txt`, `shots/` and rerunnable browser scripts.
- `esseri-verify.qoEt1J`: functional check logs.

Native Chrome screenshots use CDP viewport capture; Playwright's ordinary
screenshot output was found unreliable at non-100% native zoom in this setup.
Representative post-fix mobile/calendar, 200%-billing and Safari/calendar
screenshots were also inspected by the parent. Test evidence is local and has
not been published or added as binary repository content.

## Follow-up: family communications home link

After the human QA review, the family communications list was found to omit
the home link already used by the calendar. Two existing `PortalFamiliaShell`
props now render “Volver al inicio” to `/familia`, only in the family list.
Staff lists, the shared shell, filters and message handling were not changed.

A navigation regression test failed before the fix and passed afterwards:
32 page tests and all 69 communications-module tests passed, as did lint/build.
The live QA link was visible within 1440/768/390-pixel viewports and returned
to `/familia` at each width. These are responsive checks, not a new native-zoom
sweep. The earlier 933-test/full zoom evidence belongs to the preceding layout
snapshot; neither that full suite nor Safari zoom was rerun for this local link
addition. The calendar focus indicator and the absence-dialog theme were corrected
afterwards, outside that communications unit. No commit or merge was performed at
that point.
