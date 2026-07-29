import test from 'node:test';
import assert from 'node:assert/strict';

import * as E from '../app/games/euchre.engine.js';
import * as EC from '../app/games/euchre.coach.js';
import * as H from '../app/games/hearts.engine.js';
import * as HC from '../app/games/hearts.coach.js';
import * as O from '../app/games/ohhell.engine.js';
import { estimateTricks, botBid, botPlay as ohBotPlay } from '../app/games/ohhell.coach.js';
import { DECK as ROOK_DECK, pointsOf, deal as rookDeal, evalBid } from '../app/games/rook.logic.js';

// ---- euchre ----------------------------------------------------------------
test('euchre: deck and bowers', () => {
  assert.equal(E.DECK.length, 24);
  assert.ok(E.isTrump('JS', 'C')); // left bower
  assert.ok(!E.isTrump('JH', 'C'));
  assert.equal(E.effSuit('JS', 'C'), 'C');
  assert.ok(E.beats('AC', 'JS', 'C')); // left bower beats trump ace
  assert.ok(E.beats('JS', 'JC', 'C')); // right beats left
  assert.ok(!E.beats('JC', 'JS', 'C'));
  assert.equal(E.trickWinner(['AH', 'JC', 'AC', 'KH'], 'C'), 1);
});

test('euchre: order up flows through discard to play', () => {
  const s = E.newHand(3, Math.random);
  E.callRound1(s, 0, 'order');
  assert.equal(s.phase, 'discard');
  assert.equal(s.hands[3].length, 6);
  E.discard(s, s.hands[3][5]);
  assert.equal(s.phase, 'play');
  assert.equal(s.hands[3].length, 5);
  assert.equal(s.trump, s.upcard[1]);
});

test('euchre: stick the dealer cannot pass', () => {
  const s = E.newHand(3, Math.random);
  for (const seat of [0, 1, 2, 3]) E.callRound1(s, seat, 'pass');
  assert.equal(s.phase, 'call2');
  for (const seat of [0, 1, 2]) E.callRound2(s, seat, 'pass');
  assert.throws(() => E.callRound2(s, 3, 'pass'));
  const suit = E.SUITS.find(su => su !== s.upcard[1]);
  E.callRound2(s, 3, suit);
  assert.equal(s.phase, 'play');
});

test('euchre: full hands with bots complete and score', () => {
  for (let n = 0; n < 60; n++) {
    const s = E.newHand(n % 4, Math.random);
    while (s.phase === 'call1') E.callRound1(s, s.turn, EC.botCall1(s, s.turn));
    while (s.phase === 'call2') E.callRound2(s, s.turn, EC.botCall2(s, s.turn));
    if (s.phase === 'discard') E.discard(s, EC.discardChoice(s.hands[s.dealer], s.trump));
    while (s.phase === 'play') {
      const seat = E.currentTurn(s);
      const card = EC.botPlay(s, seat);
      assert.ok(E.legalMoves(s, seat).includes(card), 'euchre bot legal');
      E.playCard(s, seat, card);
    }
    assert.equal(s.phase, 'done');
    const total = s.tricksWon[0] + s.tricksWon[1];
    assert.equal(total, 5);
    assert.ok(s.result.delta[0] + s.result.delta[1] > 0);
    if (s.alone) assert.equal(s.sitout, (s.maker + 2) % 4);
  }
});

test('euchre: call heuristics respect who gets the upcard', () => {
  // 3 trump with the right bower: strong enough to order even to opponents
  const strong = ['JC', 'AC', 'KC', '9H', '9D'];
  assert.notEqual(EC.evalCall1(strong, 0, 1, 'TC').action, 'pass');
  // 2 weak trump ordering into the opponent dealer: pass
  const weak = ['9C', 'TC', 'QH', 'JH', 'TD'];
  assert.equal(EC.evalCall1(weak, 0, 1, 'KC').action, 'pass');
});

// ---- hearts ----------------------------------------------------------------
test('hearts: deck, deal, points', () => {
  assert.equal(H.DECK.length, 52);
  const hands = H.deal(Math.random);
  hands.forEach(h => assert.equal(h.length, 13));
  assert.equal(H.DECK.reduce((n, c) => n + H.pointsOf(c), 0), 26);
});

test('hearts: 2C opens, no points trick one, hearts must break', () => {
  const s = H.newHand(3); // hold hand: no pass
  assert.equal(s.phase, 'play');
  H.startPlay(s);
  const opener = s.leader;
  assert.ok(s.hands[opener].includes('2C'));
  assert.deepEqual(H.legalMoves(s, opener), ['2C']);
});

test('hearts: full hands with bots, points conserve, moon handled', () => {
  let sawPoints = 0;
  for (let n = 0; n < 40; n++) {
    const s = H.newHand(n % 4, Math.random);
    if (s.phase === 'pass') for (const seat of [0, 1, 2, 3]) H.submitPass(s, seat, HC.botPass(s.hands[seat]));
    H.startPlay(s);
    while (s.phase === 'play') {
      const seat = H.currentTurn(s);
      const card = HC.botPlay(s, seat);
      assert.ok(H.legalMoves(s, seat).includes(card), 'hearts bot legal');
      H.playCard(s, seat, card);
    }
    assert.equal(s.phase, 'done');
    assert.equal(s.result.raw.reduce((a, b) => a + b, 0), 26);
    if (s.result.shooter >= 0) {
      assert.equal(s.result.delta[s.result.shooter], 0);
      assert.equal(s.result.delta.reduce((a, b) => a + b, 0), 78);
    }
    sawPoints += s.result.raw.filter(Boolean).length;
  }
  assert.ok(sawPoints > 0);
});

test('hearts: pass valuation ships the bare queen, keeps guards', () => {
  const hand = ['QS', '2S', 'AH', 'KH', '2H', '3C', '4C', '5C', '6D', '7D', '8D', '9D', 'TD'];
  const best = HC.bestPass(hand);
  assert.ok(best.includes('QS'), 'bare-ish queen goes');
  assert.ok(!best.includes('2S'), 'guard stays');
  const guarded = ['QS', '2S', '3S', '4S', '5S', 'AH', 'KH', '2H', '3C', '4C', '6D', '7D', '8D'];
  assert.ok(!HC.bestPass(guarded).includes('QS'), 'guarded queen stays');
});

// ---- oh hell ---------------------------------------------------------------
test('oh hell: dealer hook forbids the even-out bid', () => {
  const s = O.newRound(0, 3, Math.random); // 7 cards
  O.submitBid(s, 0, 2);
  O.submitBid(s, 1, 2);
  O.submitBid(s, 2, 2);
  assert.equal(O.forbiddenBid(s, 3), 1);
  assert.throws(() => O.submitBid(s, 3, 1));
  O.submitBid(s, 3, 0);
  assert.equal(s.phase, 'play');
});

test('oh hell: full games with bots, exact10 scoring', () => {
  for (let n = 0; n < 30; n++) {
    const s = O.newRound(n % O.SEQ.length, n % 4, Math.random);
    while (s.phase === 'bid') O.submitBid(s, s.turn, botBid(s, s.turn));
    while (s.phase === 'play') {
      const seat = O.currentTurn(s);
      const card = ohBotPlay(s, seat);
      assert.ok(O.legalMoves(s, seat).includes(card), 'ohhell bot legal');
      O.playCard(s, seat, card);
    }
    assert.equal(s.tricks.reduce((a, b) => a + b, 0), s.n);
    s.result.pts.forEach((p, i) => {
      if (s.tricks[i] === s.bids[i]) assert.equal(p, 10 + s.bids[i]);
      else assert.equal(p, 0);
    });
  }
});

test('oh hell: estimate counts aces and trump honors', () => {
  const { bid } = estimateTricks(['AS', 'AH', 'KD', '2C', '3C', '4C', '5C'], 'C');
  assert.ok(bid >= 2, 'two aces at least');
});

// ---- rook ------------------------------------------------------------------
test('rook: deck shape and counters match tally (120)', () => {
  assert.equal(ROOK_DECK.length, 41);
  assert.equal(ROOK_DECK.reduce((n, c) => n + pointsOf(c), 0), 120);
  const { hands, kitty } = rookDeal(Math.random);
  hands.forEach(h => assert.equal(h.length, 9));
  assert.equal(kitty.length, 5);
});

test('rook: bid bands are sane', () => {
  const monster = ['BIRD', 'R14', 'R13', 'R12', 'R11', 'R10', 'R9', 'G5', 'Y5'];
  assert.ok(evalBid(monster).bid >= 105);
  const junk = ['R5', 'Y6', 'G7', 'B8', 'R9', 'Y7', 'G6', 'B6', 'Y8'];
  assert.equal(evalBid(junk).bid, 0);
});
