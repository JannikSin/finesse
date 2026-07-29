# Sheepdog

Learn sheepshead by making the decisions that matter.

A free, offline-capable trainer for the Wisconsin card game. No account, no ads,
no network calls: everything runs in your browser.

## Modes
- **Pick or Pass** — endless dealt hands with a seat position. Decide, then see
  what the book says and why.
- **Find the Lead** — you are the picker, the partner, or a defender, with a
  called ace on the table. Choose the opening lead and get graded.
- **At the Table** — full 5-handed hands against four bots, with the called-ace
  partner rules enforced and real game scoring (schneider and all).
- **Study** — the rules, the trump order, and the classic picking guidelines.

## Rules taught
5-handed, called-ace partner, 61 to win, defenders take ties at 60. Strategy
follows the standard American guidelines (Wergin school): pick with any 5 trump,
two queens plus a trump, a queen plus three trump, or the black queens with
position; picker leads trump; defenders lead the called suit.

## Develop
No build step. Any static server at the repo root:

```
npx serve
node --test tests/engine.test.mjs
```

Vendored Preact + htm (see `vendor/VERSIONS.md` and `THIRD-PARTY-NOTICES` in the
tally repo this was templated from).
