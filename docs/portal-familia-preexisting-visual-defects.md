# Family portal: pre-existing visual defects

## Comparison scope

Compared candidate `fbd40a0` against cached `origin/main` at `9327d46`, the branch
merge-base. Local `main` at `076c549` is 181 commits behind that baseline and lacks
the portal redesign and calendar route. It was inspected separately, not used to
claim the new portal passed. No remote fetch was performed.

Browser comparisons used the same isolated SQLite-backed API, demo invoices,
family account, theme and CSS viewport widths. This is not PostgreSQL verification.

## Attendance dialog inherits the global dark theme

**Status:** reproduced in both `9327d46` and `fbd40a0`; unchanged in this correction.

With the global dark theme, open Asistencias and the absence justification dialog.
The family portal stays light, but the dialog background becomes `rgb(33, 28, 41)`.
With the global light preference, it becomes `rgb(253, 252, 254)`.

`DialogContent` portals to `body`, outside the `.portal-familia` subtree that
overrides the light tokens. It therefore uses the global dark `--superficie`.
The dialog remained readable, scrollable and closable in the exercised cases;
that does not make the theme mismatch correct.

Affected surfaces: `frontend/src/components/ui/dialog.tsx`,
`frontend/src/index.css`, and the family absence form.
Any future fix should scope the portal theme to its portaled content without
changing the selected theme or dialogs in other roles.

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
