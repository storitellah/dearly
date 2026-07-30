# Manual print testing

Printing is the one part of Dearly that automated tests cannot finish for you: a
test can prove the layout maths, but only paper can prove the paper.

Work through this before a release, and after any change to
`src/components/printing/`, `src/components/envelope/`, `src/styles/print.css`
or `public/print/`.

## Before you start

1. Open **Print check** in the app.
2. Choose your paper size.
3. Print the calibration sheet with:
   - scale set to **100%**;
   - "fit to page", "shrink to fit" and "scale to fit" **off**;
   - margins set to **none** or **minimum** (Dearly draws its own margins);
   - "background graphics" **on** if you want stationery colours and textures.

Then measure:

| Check | Expected | If it is wrong |
| --- | --- | --- |
| The 100 mm rule | exactly 100 mm | Your printer is scaling. Fix it in the print dialog, not in Dearly. |
| The 4 inch rule | exactly 4 inches | As above. |
| Four corner marks | all four printed, 10 mm from each edge | A missing mark means the printer cannot reach that edge. Increase that margin in **Print settings** by the amount cut off. |
| Grey ramp | steps distinguishable from 10% to 90% | Toner or ink is low, or "draft" quality is on. |
| Type samples | 9 pt readable | Consider a larger body size for the recipient. |

## The checklist

### Letter, single page

- [ ] Text starts at the top margin and ends inside the bottom margin
- [ ] Place and date sit at the top right
- [ ] The greeting appears only when the letter does not already open with one
- [ ] Paragraph spacing matches the preview
- [ ] No line is clipped at the right edge
- [ ] Closing and signature sit together, not split from the body
- [ ] The page number, if enabled, is inside the printable area

### Letter, multiple pages

- [ ] Page count matches the on-screen preview exactly
- [ ] No line is cut in half across a page break
- [ ] A paragraph does not leave a single line alone at the foot of a page
- [ ] Page numbers read `1 / n`, `2 / n`, and so on
- [ ] Printing double-sided starts each new letter on a front side

### Stationery

- [ ] Paper colour prints when "background graphics" is on
- [ ] Textures (laid, linen, botanical, kraft) print without banding
- [ ] Ruled and grid stationery aligns with the text baselines
- [ ] Borders (hairline, double, deckled) are complete on all four sides
- [ ] Midnight stationery is legible — and warn the user about toner use

### Photographs

- [ ] Proportions are preserved; nothing is squashed
- [ ] Images sit inside the margins
- [ ] Captions stay with their image, never orphaned onto the next page
- [ ] A drawn signature prints at a sensible size near the closing

### Envelopes

Directly onto an envelope:

- [ ] Choose **Envelope only** and **Directly onto the envelope**
- [ ] Feed one envelope, following the printer's diagram
- [ ] Recipient lands in the lower middle third
- [ ] Sender is top left, stamp note top right
- [ ] Nothing prints over the flap

Onto a sheet:

- [ ] Choose **Envelope only** and **On a sheet, with cut guides**
- [ ] The outline is centred on the sheet
- [ ] Four corner marks print
- [ ] Fold guides, if enabled, match the envelope size

### What must never appear on paper

- [ ] No navigation, buttons, panels or form fields
- [ ] No shadows, focus rings, scrollbars or editing handles
- [ ] No toasts, dialogs or banners
- [ ] No URLs appended to links

## Printer-specific notes

Unprintable margins vary. These are typical minimums; check your own model.

| Printer family | Typical minimum margin | Notes |
| --- | --- | --- |
| HP DeskJet / ENVY (inkjet) | 3 mm sides, 12 mm bottom | The bottom margin is the usual culprit; set at least 14 mm |
| Canon PIXMA (inkjet) | 3.4 mm sides, 5 mm bottom | Borderless mode scales the page — leave it off |
| Epson EcoTank / WorkForce | 3 mm sides, 14 mm bottom | "Minimise margins" can crop; leave it off |
| Brother laser (HL/DCP) | 4 mm all round | Reliable; stationery textures print well |
| HP LaserJet | 4.2 mm all round | Greys can look flat; check the grey ramp |
| Samsung / Xerox laser | 4 mm all round | Some models default to "fit to page" — turn it off |
| macOS Preview → PDF | none | Good reference: if it is right here and wrong on paper, it is the printer |
| Microsoft Print to PDF | none | Windows reference |
| Chrome "Save as PDF" | none | Confirm "Paper size" matches Dearly's setting |

If a printer cannot reach an edge, do not fight it: raise that margin in **Print,
export and backup → margins** and reprint the calibration sheet.

## Mobile printing

- [ ] iOS: Share → Print via AirPrint keeps the page size
- [ ] iOS: "Save to Files" as PDF produces the same pagination
- [ ] Android: Chrome → Print → Save as PDF matches the preview
- [ ] Android: printing to a network printer keeps margins

## Recording results

When reporting a print problem, include:

- printer make and model;
- operating system and browser, with versions;
- paper size and Dearly's margin settings;
- what the calibration sheet measured;
- a photograph or scan of the output, using a test letter — **never a real one**.
