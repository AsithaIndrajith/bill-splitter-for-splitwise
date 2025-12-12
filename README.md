# Item-Based Bill Splitter (Splitwise Pre-Calculator)

Single-page, mobile-friendly web app to calculate unequal splits for groups before entering totals into Splitwise. Works fully in-browser with no backend or build step.

## Demo / GitHub Pages
- Host directly via GitHub Pages: set the branch to `main` (folder `/`) and visit `https://<your-user>.github.io/<your-repo>/`.
- Or open `index.html` locally in any modern browser.

## Features
- People management: add/remove people; chips update tables dynamically.
- Item management: bulk item price and quantity; per-person consumption inputs.
- Validation: consumption per item must sum to the item’s total quantity.
- Shared charges: add multiple charges and choose participants for each.
- Totals: per-person item subtotal, shared charges allocation, final totals.
- Paid amount comparison: shows difference and mismatch warning.
- Copy-ready summary for Splitwise “Split Unequally”.
- Fully client-side; state persisted in `localStorage`.

## Quick Start
1) Clone or download the repo.  
2) Open `index.html` in a browser.  
3) Optional local server (avoids `file://` quirks):  
   - Python: `python3 -m http.server 8000` then visit http://localhost:8000  
   - Node: `npx http-server . -p 8000` then visit http://localhost:8000

## Usage
1) Add people.  
2) Add items with total price and total quantity.  
3) Enter per-person consumption for each item; remaining amount must be zero to calculate.  
4) Add shared charges and select who participates in each.  
5) Optionally enter the actual paid total.  
6) Click Recalculate to view per-person totals and any mismatch message.  
7) Use “Copy Splitwise summary” to paste into Splitwise (Split Unequally).

## Tech
- HTML, CSS, vanilla JavaScript
- No dependencies, no build tooling
- Responsive layout; works on mobile and desktop

## Project Structure
- `index.html` — layout and sections.
- `style.css` — theming and responsive styles.
- `script.js` — state, rendering, calculations, validation, clipboard.

## Development
- Edit the files directly; refresh the browser to see changes.
- State is stored in `localStorage` under `bill-splitter-state`; clear storage to reset.

## Deployment (GitHub Pages)
1) Commit to a GitHub repo.  
2) In GitHub → Settings → Pages: Source = Deploy from a branch; Branch = `main`, Folder = `/ (root)`.  
3) Save and wait for the publish URL.

## License
MIT — see `LICENSE`.

