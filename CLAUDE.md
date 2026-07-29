# Sheepdog — sheepshead trainer PWA

Static PWA, no build step, vanilla Preact + htm vendored (copied from tally; same
CSP-hash import map). Teaches the game; tally scores it. Deployed to GitHub Pages
(public repo).

## What it is
Three training modes plus a reference:
- `#pick` — Pick or Pass: random 6-card hand + seat position, grade against the book.
- `#lead` — Find the Lead: role (picker/partner/defender) + called suit, grade the opening lead.
- `#table` — At the Table: full 5-handed hands vs 4 bots (Moss, Fly, Rex, Bella).
- `#study` — rules + strategy distilled from pagat.com, sheepshead.org, playsheepshead.org, sheepsheadrules.com (Wergin-school picking guidelines).

## Hard rules (public repo)
- No real names anywhere in repo.
- Zero `innerHTML` / `eval` / `new Function`. CSP pinned; import map is byte-identical
  to tally's so the sha256 hash is the same. Never resolve CSP with `unsafe-inline`.
- Zero runtime network calls beyond same-origin.
- `vendor/` upgrade ritual: file + `vendor/VERSIONS.md` + `CACHE` bump in `sw.js`, all or none.

## Architecture
- `app/engine.js` — pure rules: deck, trump order, trick winner, hand state machine
  (pick → bury/call → play → done), called-ace constraints, scoring ladder. ZERO imports.
- `app/coach.js` — strategy: `evalPick`, `suggestBury`, `gradeLeads`, `botPickDecision`,
  `botPlay`. Imports engine only.
- `app/study.js` — reference content, plain data.
- `app/main.js` — all UI (shell, 4 screens, localStorage stats at `sheepdog.v1`).
- `tests/engine.test.mjs` — rules, called-ace edge cases, scoring, coach contracts,
  purity check.

## Known ceilings (ponytail comments in code)
- All-pass re-deals instead of playing a leaster.
- Bots read true team membership pre-ace-flip (no inference model).
- Jack-of-diamonds partner variant, 3/4-handed, cracking: not built.

## Verify
- `node --test tests/engine.test.mjs`
- `npx serve` at repo root; hard-refresh twice for sw.js.
- Icons: `node tools/make-icons.mjs`.
