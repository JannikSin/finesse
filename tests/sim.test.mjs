// Full-table bot-vs-bot simulations: every seat a computer. Proves (a) whole
// rounds complete with every move legal at every level, and (b) the difficulty
// ladder is real — expert seats beat novice seats over many deals. All rngs
// seeded: results are deterministic, never flaky.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as SH from '../app/games/sheepshead.engine.js';
import * as SHC from '../app/games/sheepshead.coach.js';
import * as E from '../app/games/euchre.engine.js';
import * as EC from '../app/games/euchre.coach.js';
import * as H from '../app/games/hearts.engine.js';
import * as HC from '../app/games/hearts.coach.js';
import * as O from '../app/games/ohhell.engine.js';
import * as OC from '../app/games/ohhell.coach.js';
import * as B from '../app/games/bridge.engine.js';
import * as BB from '../app/games/bridge.bid.js';

const mulberry32 = seed => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- sheepshead ------------------------------------------------------------
function sheepsheadHand(levels, dealer, rng) {
  const s = SH.newHand(dealer, rng);
  while (s.phase === 'pick') {
    if (SHC.botPickDecision(s, s.turn, levels[s.turn])) SH.pick(s, s.turn);
    else SH.pass(s);
  }
  if (s.phase === 'alldown') return null;
  const sb = SHC.botBuryChoice(s, levels[s.picker]);
  SH.buryAndCall(s, sb.bury, sb.calledSuit);
  while (s.phase === 'play') {
    const seat = SH.currentTurn(s);
    const card = SHC.botPlay(s, seat, levels[seat]);
    assert.ok(SH.legalMoves(s, seat).includes(card), `sheepshead ${levels[seat]} bot legal`);
    SH.playCard(s, seat, card);
  }
  assert.equal(s.result.pickerPts + s.result.defPts, 120);
  assert.equal(s.result.delta.reduce((a, b) => a + b, 0), 0);
  return s.result.delta;
}

for (const level of ['novice', 'solid', 'expert']) {
  test(`sheepshead sim: full table of ${level} bots completes cleanly`, () => {
    const rng = mulberry32(11);
    let played = 0;
    for (let n = 0; n < 120; n++) {
      if (sheepsheadHand(Array(5).fill(level), n % 5, rng)) played++;
    }
    assert.ok(played > 60, `${level} table actually plays hands (${played}/120)`);
  });
}

test('sheepshead skill ladder: expert seat profits off a novice table', () => {
  const rng = mulberry32(42);
  let expertTotal = 0, hands = 0;
  const levels = ['expert', 'novice', 'novice', 'novice', 'novice'];
  for (let n = 0; n < 500; n++) {
    const delta = sheepsheadHand(levels, n % 5, rng);
    if (delta) { expertTotal += delta[0]; hands++; }
  }
  assert.ok(hands > 300, 'enough hands played');
  assert.ok(expertTotal > 0, `expert should be up over ${hands} hands, got ${expertTotal}`);
});

test('sheepshead honesty: no bot reads the hidden partner before the ace flips', () => {
  // knownSide must return 'unknown' for a defender judging another defender
  // pre-flip (solid level), and never claim 'mate' about the true partner
  // unless flipped or inferred from public history.
  const rng = mulberry32(7);
  for (let n = 0; n < 40; n++) {
    const s = SH.newHand(n % 5, rng);
    while (s.phase === 'pick') {
      if (SHC.botPickDecision(s, s.turn, 'solid')) SH.pick(s, s.turn); else SH.pass(s);
    }
    if (s.phase === 'alldown') continue;
    const sb = SHC.suggestBury(s.hands[s.picker]);
    SH.buryAndCall(s, sb.bury, sb.calledSuit);
    if (!s.calledSuit || s.partner < 0) continue;
    const defender = [0, 1, 2, 3, 4].find(x => x !== s.picker && x !== s.partner);
    assert.equal(SHC.knownSide(s, defender, s.partner, 'solid'), 'unknown');
    assert.equal(SHC.knownSide(s, s.picker, s.partner, 'solid'), 'unknown');
    assert.equal(SHC.knownSide(s, s.partner, s.picker, 'solid'), 'mate');
  }
});

// ---- euchre ----------------------------------------------------------------
function euchreHand(levels, dealer, rng) {
  const s = E.newHand(dealer, rng);
  while (s.phase === 'call1') E.callRound1(s, s.turn, EC.botCall1(s, s.turn, levels[s.turn]));
  while (s.phase === 'call2') E.callRound2(s, s.turn, EC.botCall2(s, s.turn, levels[s.turn]));
  if (s.phase === 'discard') E.discard(s, EC.discardChoice(s.hands[s.dealer], s.trump));
  while (s.phase === 'play') {
    const seat = E.currentTurn(s);
    const card = EC.botPlay(s, seat, levels[seat]);
    assert.ok(E.legalMoves(s, seat).includes(card), `euchre ${levels[seat]} bot legal`);
    E.playCard(s, seat, card);
  }
  assert.equal(s.tricksWon[0] + s.tricksWon[1], 5);
  return s.result.delta;
}

for (const level of ['novice', 'solid', 'expert']) {
  test(`euchre sim: full table of ${level} bots completes cleanly`, () => {
    const rng = mulberry32(13);
    for (let n = 0; n < 100; n++) euchreHand(Array(4).fill(level), n % 4, rng);
  });
}

test('euchre skill ladder: expert team beats novice team', () => {
  const rng = mulberry32(99);
  const levels = ['expert', 'novice', 'expert', 'novice']; // team 0 expert
  let t0 = 0, t1 = 0;
  for (let n = 0; n < 300; n++) {
    const d = euchreHand(levels, n % 4, rng);
    t0 += d[0]; t1 += d[1];
  }
  assert.ok(t0 > t1, `expert team should lead: ${t0} vs ${t1}`);
});

// ---- hearts ----------------------------------------------------------------
function heartsHand(levels, handNo, rng) {
  const s = H.newHand(handNo, rng);
  if (s.phase === 'pass') {
    for (const seat of [0, 1, 2, 3]) H.submitPass(s, seat, HC.botPass(s.hands[seat], levels[seat]));
  }
  H.startPlay(s);
  while (s.phase === 'play') {
    const seat = H.currentTurn(s);
    const card = HC.botPlay(s, seat, levels[seat]);
    assert.ok(H.legalMoves(s, seat).includes(card), `hearts ${levels[seat]} bot legal`);
    H.playCard(s, seat, card);
  }
  assert.equal(s.result.raw.reduce((a, b) => a + b, 0), 26);
  return s.result.delta;
}

for (const level of ['novice', 'solid', 'expert']) {
  test(`hearts sim: full table of ${level} bots completes cleanly`, () => {
    const rng = mulberry32(17);
    for (let n = 0; n < 80; n++) heartsHand(Array(4).fill(level), n, rng);
  });
}

test('hearts skill ladder: expert takes fewer points than novices', () => {
  const rng = mulberry32(55);
  const levels = ['expert', 'novice', 'novice', 'novice'];
  const totals = [0, 0, 0, 0];
  for (let n = 0; n < 200; n++) {
    const d = heartsHand(levels, n, rng);
    d.forEach((p, i) => { totals[i] += p; });
  }
  const noviceAvg = (totals[1] + totals[2] + totals[3]) / 3;
  assert.ok(totals[0] < noviceAvg, `expert ${totals[0]} should be under novice avg ${noviceAvg.toFixed(0)}`);
});

// ---- oh hell ---------------------------------------------------------------
function ohhellGame(levels, rng) {
  const totals = [0, 0, 0, 0];
  for (let r = 0; r < O.SEQ.length; r++) {
    const s = O.newRound(r, r % 4, rng);
    while (s.phase === 'bid') O.submitBid(s, s.turn, OC.botBid(s, s.turn, levels[s.turn]));
    while (s.phase === 'play') {
      const seat = O.currentTurn(s);
      const card = OC.botPlay(s, seat, levels[seat]);
      assert.ok(O.legalMoves(s, seat).includes(card), `ohhell ${levels[seat]} bot legal`);
      O.playCard(s, seat, card);
    }
    s.result.pts.forEach((p, i) => { totals[i] += p; });
  }
  return totals;
}

for (const level of ['novice', 'solid', 'expert']) {
  test(`oh hell sim: full table of ${level} bots completes cleanly`, () => {
    const rng = mulberry32(19);
    for (let n = 0; n < 12; n++) ohhellGame(Array(4).fill(level), rng);
  });
}

test('oh hell skill ladder: expert outscores novices', () => {
  const rng = mulberry32(77);
  const levels = ['expert', 'novice', 'novice', 'novice'];
  const totals = [0, 0, 0, 0];
  for (let n = 0; n < 40; n++) {
    const g = ohhellGame(levels, rng);
    g.forEach((p, i) => { totals[i] += p; });
  }
  const noviceAvg = (totals[1] + totals[2] + totals[3]) / 3;
  assert.ok(totals[0] > noviceAvg, `expert ${totals[0]} should beat novice avg ${noviceAvg.toFixed(0)}`);
});

// ---- bridge ----------------------------------------------------------------
function bridgeDeal(levels, dealer, rng, board = 0) {
  const a = B.newAuction(dealer, B.deal(rng), B.vulForBoard(board));
  let guard = 0;
  while (a.phase === 'auction' && guard++ < 50) B.makeCall(a, a.turn, BB.botCall(a, a.turn, levels[a.turn]));
  assert.ok(a.phase !== 'auction', 'auction terminates');
  if (a.phase === 'passout') return null;
  while (a.phase === 'play') {
    const seat = B.currentTurn(a);
    const card = BB.botPlay(a, seat, levels[seat]);
    assert.ok(B.legalMoves(a, seat).includes(card), `bridge ${levels[seat]} bot legal`);
    B.playCard(a, seat, card);
  }
  const nsDeclared = a.contract.declarer % 2 === 0;
  return nsDeclared ? a.result.score : -a.result.score; // + = good for NS
}

for (const level of ['novice', 'solid', 'expert']) {
  test(`bridge sim: full table of ${level} bots completes cleanly`, () => {
    const rng = mulberry32(23);
    let played = 0;
    for (let n = 0; n < 60; n++) {
      if (bridgeDeal(Array(4).fill(level), n % 4, rng, n) !== null) played++;
    }
    assert.ok(played > 10, `${level} table reaches contracts (${played}/60)`);
  });
}

// Doubles are variance amplifiers: the ladder must hold across seeds, not on
// one lucky one. Three seeds, each must land positive on its own.
for (const seed of [31, 77, 123]) {
  test(`bridge skill ladder: SAYC pair beats novice pair (seed ${seed})`, () => {
    const rng = mulberry32(seed);
    const levels = ['solid', 'novice', 'solid', 'novice']; // NS system bidders
    let ns = 0, deals = 0;
    for (let n = 0; n < 200; n++) {
      const r = bridgeDeal(levels, n % 4, rng, n);
      if (r !== null) { ns += r; deals++; }
    }
    assert.ok(deals > 50, 'enough contracts reached');
    assert.ok(ns > 0, `NS (system) should net positive over ${deals} deals, got ${ns}`);
  });
}
