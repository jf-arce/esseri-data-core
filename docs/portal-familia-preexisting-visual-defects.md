# Family portal: pre-existing visual defects

## Comparison scope

Compared candidate `fbd40a0` against cached `origin/main` at `9327d46`, the branch
merge-base. Local `main` at `076c549` is 181 commits behind that baseline and lacks
the portal redesign and calendar route. It was inspected separately, not used to
claim the new portal passed. No remote fetch was performed.

Browser comparisons used the same isolated SQLite-backed API, demo invoices,
family account, theme and CSS viewport widths. This is not PostgreSQL verification.

## Attendance dialog inherited the global dark theme

**Status:** reproduced in both `9327d46` and `fbd40a0`; **corrected in this branch**
after the human review, with the defect preserved here as baseline evidence.

With the global dark theme, opening the absence dialog in Asistencias originally
produced a dark `rgb(33, 28, 41)` panel inside the light family portal.

`DialogContent` portals to `body`, outside the `.portal-familia` subtree that
overrides the light tokens, so it inherited the global dark `--superficie`.
The correction adds the existing `portal-familia` scope to that portaled content:
measured with `html.dark` active, the dialog now resolves to
`rgb(253, 252, 254)` background, `rgb(27, 24, 34)` text and `color-scheme: light`,
while the global theme and dialogs in other roles remain untouched.

A regression assertion now pins the scoped class in the family absence form.

## Billing amount sizing was already fragile

**Status:** baseline limitation; distinct from the candidate's new paint-over.

At a 720 CSS-pixel viewport, the baseline shows the full `$ 960.000` amount, but
its ink extends about 13 pixels beyond the tile. The unchanged shared
`PortalStatTile` uses a fixed value size and a non-shrinking icon.

The candidate reduced the available width further through nested horizontal
padding, so the next card covered the last digits. The local correction removes
that duplicate padding and stacks billing summary tiles below `lg`, preventing
the observed clipping without changing the shared tile used by other pages.
Arbitrarily large amounts in every shared tile are not certified by this test.

## Candidate-only defect, not a pre-existing issue

The mobile calendar's five equal-width agenda tabs were introduced after
`9327d46`. At 390 CSS pixels, “Miércoles” required 61 pixels inside a 51-pixel
button. The local correction allows full day names to wrap as whole controls
onto additional rows and uses the documented body text scale and 40-pixel target.

## Documentation inconsistency observed

`ARCHITECTURE.md` describes `index.css` as light-only, while `DESIGN.md` and the
current implementation support persisted light/dark themes. This discrepancy
predates this correction; no theme policy or architecture was changed here.

## Not a main-baseline defect: selected calendar day focus

The global focus-shadow weakness already exists in `main`, but the new calendar
agenda exposes it through the selected tab's `shadow-sm`. This selected-day
defect existed in `fbd40a0` before the latest layout correction; the baseline
calendar has no equivalent day tabs. Do not classify the control's failure as
pre-existing in `main` or as fixed. Its accessibility impact and branch ownership
are recorded in [the validation report](portal-familia-zoom-validation.md#selected-day-focus-review).
