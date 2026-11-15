# Safari native zoom: manual acceptance checklist

**Owner:** human tester. **Status:** not executed. Do not mark any row passed
until every applicable check below has been observed at that level.
The earlier automated Safari result covers only its observed 75% desktop state.

## Prepare once

- [ ] Record Safari/macOS versions, date, display resolution and window size.
- [ ] Use only the isolated local preview at `http://localhost:5173`, with the
      test family account. Confirm the API on port 8012 is reachable. Do not use
      production/shared data or change system/browser settings to make a test pass.
- [ ] Keep the same host, window and data while changing zoom. Allow ordinary
      vertical scrolling. Note any separate narrow-window run explicitly.
- [ ] Reset page zoom to 100% using Safari's native page-zoom control. Use full
      page zoom, not “Zoom Text Only”, trackpad pinch, macOS magnification, DevTools
      viewport emulation or CSS zoom. Record the percentage shown by Safari.
- [ ] If a requested percentage is not offered by the installed Safari version,
      record **Unavailable**, not Pass. Record and test additional offered levels
      between 50% and 300% as separate rows without substituting for missing ones.

## Repeat at each native zoom level

Use Safari's own page-zoom menu/control. Check its displayed percentage on each
route, because zoom may be remembered per site. Test while scrolling to the end
of each page; a screenshot of the first screen alone is not sufficient.

| Zoom | Navigation | Inicio | Asistencias | Facturación | Comunicaciones | Calendario | Evidence / issue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 75% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 100% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 125% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 150% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 175% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 200% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 250% | Not run | Not run | Not run | Not run | Not run | Not run | |
| 300% | Not run | Not run | Not run | Not run | Not run | Not run | |

Allowed results: **Pass / Fail / Not run / Unavailable**. If a required data state
is missing, use Not run with its reason, not an inferred Pass. The 75% row remains
Not run here because this is the new human acceptance run, not the automated log.

### Navigation and all pages

- [ ] Reach all five header destinations, including the last item, “Calendario”.
      Wrapping into multiple rows is valid; clipping or overlapping controls is not.
- [ ] No cut-off labels, overlapping text/cards or unintended page-wide horizontal
      scroll. A weekly-grid-only horizontal scroller is valid if every day and
      class remains reachable without moving the entire page sideways.
- [ ] Use Tab and Shift+Tab, then Enter/Space where applicable. Focus must be
      visible and distinguishable from selection. Do not count a mouse click as
      proof of keyboard accessibility. Record the known selected-day focus issue.
- [ ] Reach all page content and actions by scrolling, including dialog footers.

### Inicio (`/familia`)

- [ ] Summary numbers, alerts and their action labels remain readable.
- [ ] Follow the attendance and billing shortcuts and return home. Verify the
      correct student/context remains selected where the page provides a selector.

### Asistencias (`/familia/asistencias`)

- [ ] Open Resumen, Justificar asistencia, Historial and Solicitudes; verify each
      tab's content, date/status labels and available pagination/filters fit.
- [ ] Open the justification form for the test absence without submitting it.
      Reach date, reason, observation and the footer by keyboard/scrolling.
- [ ] Open and close the reason selector; close/cancel the dialog. Focus returns
      to a sensible invoking control. No inaccessible field or trapped page scroll.
- [ ] Record the known dark-dialog/light-portal mismatch separately. A readable
      dialog does not resolve that defect. Do not change theme to conceal it.

### Facturación (`/familia/facturacion`)

- [ ] Every summary amount is complete: in the current fixture `$ 960.000`,
      `$ 360.000`, `$ 600.000`. If the fixture differs, record the actual full values.
- [ ] Digits stay inside their cards and are not covered by the next card.
      Stacking the cards at narrower effective widths is expected.
- [ ] Open the student selector, change and restore its value. Exercise available
      status/sort controls and expand/collapse an invoice without recording a payment.
- [ ] Invoice amounts, badges, due dates, expanded details and pagination fit.

### Comunicaciones (`/familia/comunicaciones`)

- [ ] List subject, icon, badge, date and available search/filter/sort controls fit.
- [ ] Open an existing test message, read to the bottom and return to the list.
      Opening it may mark an isolated test receipt read. Do not create/send messages.
- [ ] Check a long subject/body if the fixture provides one. Otherwise record that
      specific content case as Not run.

### Calendario (`/familia/calendario`)

- [ ] Open the student selector, change and restore the student if two exist.
- [ ] In weekly-grid mode, reach Monday through Friday and select a class. Its
      detail must match subject, complete time range and available teacher data.
- [ ] Select the two-hour test class, Tuesday `10:00` to `12:00`: one continuous
      block spans the two intervals and detail retains `10:00 – 12:00`.
- [ ] In compact-agenda mode, all five full day names are readable, especially
      “Miércoles”. Whole buttons may wrap into rows; text must not collide.
      Select every day and verify its classes/empty state and detail update.
- [ ] Tab onto the selected day as well as unselected days and record visible
      focus separately from the selected-day styling.

If a fixed window never enters one calendar mode, mark that mode Not run. Then
make a **separate** narrow-window pass at native 100% (for example, approximately
390 and 768 CSS pixels), recording the actual window/effective width. Do not call
that responsive run an additional native-zoom result or a physical iPhone test.

## Record failures and finish

- [ ] For each failure, capture route, native zoom %, window size, selected
      student/tab, action, expected/actual result and screenshot of the affected
      area. Distinguish new defects from the known issues linked below.
- [ ] After the sweep, return to 100% and check navigation once more. Do not send
      forms, register payments or change other browser/system preferences.
- [ ] Return the completed matrix and evidence. Any required Fail, Not run or
      Unavailable item prevents a blanket Safari approval.

Known open issues: [baseline defects](portal-familia-preexisting-visual-defects.md)
and the branch-owned selected-day focus defect in
[the validation report](portal-familia-zoom-validation.md#selected-day-focus-review).
