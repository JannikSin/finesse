# Finesse — card game trainer PWA (formerly Sheepdog)

Static PWA, no build step, vanilla Preact + htm vendored (copied from tally; same
CSP-hash import map). Teaches games; tally scores them. The two stay SEPARATE apps
by council verdict (2026-07-29): one cross-link each way at most, no shared runtime
code. Bridge was council-excluded but the owner vetoed: it is IN, as the app's most
significant training track.

## What it is
Six games, each with decision drills, leveled study (Level 1 rules → Level 3
advanced strategy), and full play vs bots where built:
- sheepshead — pick drill, lead drill, table, study
- euchre — call drill (rounds 1+2, next convention), lead drill, table, study
- hearts — pass-three drill, table, study
- ohhell — bid drill (dealer hook), table, study; scoring matches tally's exact10
- rook — bid drill, study (Kentucky Discard, 120 deck like tally); table unbuilt
- bridge — opening-bid, response, convention (dealt Stayman/transfer/Blackwood +
  quiz bank over all 11 gadgets), and lead drills; full-auction table with dummy
  play; Bid the Hand mode (`#bridge/auction`: full auctions vs book bots, no
  play, graded against a shadow all-bot auction on the same cards); Conventions
  LEARN HUB (`#bridge/conventions`: per-convention memory hook + bidding-box
  number tiles + spine strip, data in `bridge.conventions.js`; per-convention
  practice on CONSTRUCTED hands from `bridge.learn.js` generators, graded by
  the same system functions as the bots, streak dots in localStorage
  `finesse.bridge.learn`; hooks repeat on every graded answer, the bonmot
  pattern, and a matching `bridge` deck lives in the bonmot repo for FSRS);
  SAYC per the ACBL booklet, opening threshold toggle 13+ (book) / 12+ (the house
  home game) via `setOpenMin`, pref `finesse.bridge.openmin`
Routes: `#<game>` menu, `#<game>/<drillId>`, `#<game>/table`, `#<game>/study`,
plus optional per-game `screens: { id: {title, hint, C} }` routed as
`#<game>/<screenId>` (main.js records right/total via onResult).
Study content is research-fed: 2+ named strategy sources per game, cited in the
header comment of each study section / game file.

## Hard rules (public repo)
- No real names anywhere in repo.
- Zero `innerHTML` / `eval`. CSP pinned; import map byte-identical to tally's.
- Zero runtime network calls beyond same-origin.
- **sw.js activate cleanup must stay prefixed `finesse-`**: all of this owner's PWAs
  share the janniksin.github.io origin, and an unprefixed cleanup evicts tally,
  bonmot and grandstand caches. Never remove that filter.
- `vendor/` upgrade ritual: file + `vendor/VERSIONS.md` + `CACHE` bump, all or none.

## Architecture
- `app/main.js` — shell: home grid, game menu, generic Drill + Study screens,
  stats at `finesse.v1` (per game per drill; migrates sheepdog.v2/v1).
- `app/cards.js` — shared Card/Hand widgets; games provide `toView(card)`.
- `app/games/<game>.js` — the module: `export const game = { id, name, glyph,
  tagline, toView, study, drills, Table }`. Drills: `{ id, title, hint,
  kind: 'choice'|'card'|'cards', count?, scene(), grade(scene, answer) }`.
- `app/games/<game>.engine.js` — pure rules, ZERO imports (rook: `rook.logic.js`).
  Trick-history recording (`s.history`) is public info bots may count from.
- `app/games/<game>.coach.js` — heuristics + LEVELED bot policy, imports engine
  only (bridge: `bridge.bid.js`). Levels: novice (deliberate period-correct
  mistakes) / solid (book) / expert (adds counting + inference). SHEEPSHEAD
  EXCEPTION (house standing order 2026-08-01): every sheepshead level plays
  by the Strupp book — levels differ only in DEPTH (novice = recap-card basics,
  solid = Chapter II table rules, expert = counting/inference/end-position),
  never in whether the book is followed. sheepshead.coach.js also exports TALK,
  the table-talk line bank (original lines, tavern voice); the Table shows one
  speech bubble at a time (picker always grumbles about the blind — which is
  also why talk leaks zero hidden information). Each coach exports
  `adviseMove(state, seat, level) -> {card, why}`: bots take the card,
  the human coach note shows both. HONESTY RULE (sheepshead): bots never read
  hidden team membership — knownSide() models what each seat can actually know;
  tests enforce it. Engines/coaches must never import htm/preact.
- `app/cards.js` — also holds table prefs (bot level, coach mode, bot play speed;
  `finesse.level` / `finesse.coach` / `finesse.speed` in localStorage),
  TableControls (incl. the speed slider) and CoachNote widgets.
- `tests/` — engine/games/bridge unit tests + `sim.test.mjs`: all-bot full-table
  simulations at every level (legality-checked every move) and seeded
  skill-ladder assertions (expert beats novice in euchre/hearts/ohhell/bridge;
  sheepshead asserts a DEPTH ladder instead — since all its levels play the
  book, money margins are statistically zero, so the test asserts the deeper
  rules fire only at the deeper levels). Plus a 200-hand book-proctor
  invariant test and a hard-rules test (forbidden DOM sinks anywhere, sw.js
  finesse- prefix + cacheName scoping). `npm test` (80 tests).

## Adding a game
1. `<game>.engine.js` (pure) + `<game>.coach.js` (pure) + `<game>.js` (module).
2. Register in `app/main.js` GAMES array.
3. Add ALL new files to `sw.js` PRECACHE and bump `CACHE`. (Ordinary edits to
   already-precached files ALSO need a `CACHE` bump before deploy: installed
   clients re-fetch content only when the new sw.js installs a new cache.)
4. Tests: full bot-vs-bot playout loop + rule edge cases + scoring.
5. Study: leveled, from 2+ named strategy sources.

## Known ceilings (ponytail comments in code)
- Sheepshead: all-pass re-deals (no leaster); no crack/recrack (bump ×2 on
  picker-side loss is automatic, schneider ×2 / no-trick ×3 per tally buckets);
  session score sheet (tap the top score strip) is in-memory only, resets on leave.
- Rook: no table (auction + kitty + discard loop unbuilt).
- Bridge: engine has doubles/redoubles + full duplicate scoring (doubled,
  redoubled, vulnerability rotation with dealer); bots make takeout doubles,
  negative doubles (partner opened + suit overcall through 2S: X = the unbid
  major, exactly 4; opener advances cheap/jump-16+/NT-with-stopper), penalty
  doubles of 1NT (15+ sitting over it; partner sits unless bust with a long
  suit), 1NT overcalls, the weak-two 2NT feature ask (responder 14-16 with a
  fit asks; opener shows an outside A/K with a max, rebids the suit with a
  min), with two-round rebids (opener + responder). Doubles are read by
  context: suit bid = takeout/negative, notrump = penalty. Remaining
  ceilings: bots never redouble and never penalty-double a suit contract;
  no 2/1 system toggle.
- Wergin book (archive.org, borrow-only) pending an archive.org login. Optional now.
- Strupp book ("How to Play Winning 5 Handed Sheepshead") is the PRIMARY
  sheepshead strategy source (reference material kept privately, off-repo). The
  coach's pick/bury/lead/play heuristics encode its rules in original wording;
  rule numbers are cited in sheepshead.coach.js comments. sheepshead.org et al.
  are secondary.

## Verify
- `npm test` (80 tests)
- `npx serve` at repo root; hard-refresh twice for sw.js.
- Icons: `node tools/make-icons.mjs`.
