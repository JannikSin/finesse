# Finesse

Learn card games by making the decisions that matter.

A free, offline-capable trainer for six classic games. No account, no ads, no
network calls: everything runs in your browser.

## Games
| Game | Drills | Play vs bots |
|---|---|---|
| Sheepshead | pick-or-pass, opening lead | full 5-handed, called-ace rules |
| Euchre | order/call (both rounds, "next"), lead | full, bowers + alone + stick-the-dealer |
| Hearts | pass three | full, moon + breaking rules |
| Oh Hell | the bid (dealer hook) | full, exact-or-bust scoring |
| Rook | the bid (Kentucky Discard) | study + drills for now |
| Bridge | opening bid, response, conventions, lead | full auction + dummy play (SAYC) |

Every drill grades your choice against the book and tells you WHY. Every game
carries a leveled study section, Level 1 rules through Level 3 advanced strategy,
distilled from named strategy sources (ACBL SAYC booklet, sheepshead.org,
ohioeuchre.com, Joe Andrews' columns, pagat.com, and more, cited per game).

## Develop
No build step. Any static server at the repo root:

```
npx serve
npm test
```

Vendored Preact + htm (see `vendor/VERSIONS.md` and `THIRD-PARTY-NOTICES.md`).
