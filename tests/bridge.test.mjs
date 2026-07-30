import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../app/games/bridge.engine.js';
import {
  openingBid, responseTo, staymanReply, transferReply, blackwoodReply,
  botCall, botPlay, gradeLeads,
} from '../app/games/bridge.bid.js';

test('bridge: deck, hcp, balance', () => {
  assert.equal(B.DECK.length, 52);
  assert.equal(B.DECK.reduce((n, c) => n + B.hcp([c]), 0), 40);
  assert.ok(B.isBalanced(['AS', 'KS', 'QS', '2H', '3H', '4H', 'AD', 'KD', '2D', '2C', '3C', '4C', '5C']));
  assert.ok(!B.isBalanced(['AS', 'KS', 'QS', 'JS', 'TS', '9S', '8S', '2H', 'AD', 'KD', '2D', '2C', '3C']));
});

test('bridge: SAYC openings', () => {
  // 16 HCP balanced -> 1NT
  assert.equal(openingBid(['AS', 'KS', '2S', 'QH', 'JH', '3H', 'AD', '4D', '5D', 'KC', '6C', '7C', '8C']).call, '1N');
  // 22+ -> 2C
  assert.equal(openingBid(['AS', 'KS', 'QS', 'AH', 'KH', 'QH', 'AD', 'KD', '2D', '2C', '3C', '4C', '5C']).call, '2C');
  // 13 with 5 spades -> 1S
  assert.equal(openingBid(['AS', 'KS', 'QS', '3S', '2S', '2H', '3H', 'AD', '4D', '5D', '6C', '7C', '8C']).call, '1S');
  // weak six-card heart suit, 8 HCP -> 2H
  assert.equal(openingBid(['KH', 'QH', 'JH', '9H', '8H', '7H', '2S', '3S', '4D', '5D', '6D', '2C', '7C']).call, '2H');
  // 8 HCP flat junk -> pass
  assert.equal(openingBid(['KS', '2S', '3S', 'QH', '4H', '5H', 'JD', '6D', '7D', 'JC', '8C', '9C', '2C']).call, 'P');
});

test('bridge: responses to 1NT use conventions', () => {
  // 5-card spade suit -> transfer 2H
  assert.equal(responseTo('1N', ['AS', 'KS', '2S', '3S', '4S', '2H', '3H', '4D', '5D', '6D', '2C', '3C', '4C']).call, '2H');
  // 9 HCP with 4 hearts -> Stayman
  assert.equal(responseTo('1N', ['AS', '2S', '3S', 'KH', 'QH', '4H', '2H', '4D', '5D', '6D', 'JC', '3C', '4C']).call, '2C');
  // 11 HCP flat, no major -> 3NT
  assert.equal(responseTo('1N', ['AS', '2S', '3S', 'KH', '4H', '5H', 'QD', 'JD', '6D', 'JC', '3C', '4C', '5C']).call, '3N');
});

test('bridge: major raises follow SAYC ladders', () => {
  // 7 support points, 3 hearts -> 2H
  assert.equal(responseTo('1H', ['2H', '3H', '4H', 'AS', '2S', '3S', 'KD', '4D', '5D', '2C', '3C', '4C', '5C']).call, '2H');
  // 13+, 4-card support -> Jacoby 2NT
  assert.equal(responseTo('1H', ['KH', 'QH', '3H', '2H', 'AS', '2S', '3S', 'AD', '4D', '5D', 'KC', '3C', '4C']).call, '2N');
});

test('bridge: convention replies', () => {
  assert.equal(staymanReply(['AH', 'KH', 'QH', '2H', 'AS', '2S', '3S', 'KD', '4D', '5D', 'AC', '3C', '4C']).call, '2H');
  assert.equal(staymanReply(['AH', 'KH', '2H', 'AS', 'QS', '2S', '3S', 'KD', '4D', '5D', 'AC', '3C', '4C']).call, '2S');
  assert.equal(transferReply('2D').call, '2H');
  assert.equal(blackwoodReply(['AS', 'AH', 'AD', '2C', '3C', '4C', '5C', '6C', '2D', '3D', '2H', '3H', '2S']).call, '5S');
  assert.equal(blackwoodReply(['AS', 'AH', '2C', '3C', '4C', '5C', '6C', '7C', '2D', '3D', '2H', '3H', '2S']).call, '5H');
});

test('bridge: auction machine ends and finds declarer', () => {
  const a = B.newAuction(0, B.deal(Math.random));
  B.makeCall(a, 0, '1S');
  B.makeCall(a, 1, 'P');
  B.makeCall(a, 2, '2S');
  B.makeCall(a, 3, 'P');
  B.makeCall(a, 0, 'P');
  B.makeCall(a, 1, 'P');
  assert.equal(a.phase, 'play');
  assert.equal(a.contract.bid, '2S');
  assert.equal(a.contract.declarer, 0); // first to name spades
  assert.equal(a.leader, 1);
});

test('bridge: passout redeals', () => {
  const a = B.newAuction(2, B.deal(Math.random));
  for (const s of [2, 3, 0, 1]) B.makeCall(a, s, 'P');
  assert.equal(a.phase, 'passout');
});

test('bridge: full deals with bots complete and score', () => {
  let played = 0;
  for (let n = 0; n < 40; n++) {
    const a = B.newAuction(n % 4, B.deal(Math.random));
    let guard = 0;
    while (a.phase === 'auction' && guard++ < 40) B.makeCall(a, a.turn, botCall(a, a.turn));
    assert.ok(a.phase !== 'auction', 'auction terminates');
    if (a.phase === 'passout') continue;
    played++;
    while (a.phase === 'play') {
      const seat = B.currentTurn(a);
      const card = botPlay(a, seat);
      assert.ok(B.legalMoves(a, seat).includes(card), 'bridge bot legal');
      B.playCard(a, seat, card);
    }
    assert.equal(a.phase, 'done');
    assert.equal(a.tricksDecl >= 0 && a.tricksDecl <= 13, true);
    const need = 6 + a.contract.level;
    if (a.tricksDecl >= need) assert.ok(a.result.score > 0);
    else assert.equal(a.result.score, -50 * (need - a.tricksDecl));
  }
  assert.ok(played > 10, 'bots actually reach contracts');
});

test('bridge: scoring table', () => {
  assert.equal(B.scoreContract({ level: 3, strain: 'N' }, 9).score, 100 + 300); // 3NT exactly
  assert.equal(B.scoreContract({ level: 4, strain: 'S' }, 11).score, 120 + 300 + 30); // 4S+1
  assert.equal(B.scoreContract({ level: 2, strain: 'D' }, 8).score, 40 + 50); // partscore
  assert.equal(B.scoreContract({ level: 3, strain: 'N' }, 7).score, -100); // down 2
  assert.equal(B.scoreContract({ level: 6, strain: 'H' }, 12).score, 180 + 300 + 500); // small slam
});

test('bridge: lead grading', () => {
  const hand = ['AS', 'KS', '2S', 'QH', 'JH', 'TH', '4H', '2D', '3D', '4D', '5D', '2C', '3C'];
  const nt = gradeLeads(hand, { strain: 'N', level: 3 });
  assert.equal(nt.grades['QH'][0], 'best'); // top of sequence
  const suit = gradeLeads(hand, { strain: 'C', level: 4 });
  assert.equal(suit.grades['AS'][0], 'best'); // ace from AK
  const under = gradeLeads(['AS', '2S', '3S', '4S', 'QH', '2H', '3H', '2D', '3D', '4D', '2C', '3C', '4C'], { strain: 'H', level: 4 });
  assert.equal(under.grades['2S'][0], 'terrible'); // underleading an ace vs suit
});

test('bridge: opening threshold toggle (12 vs 13)', async () => {
  const { setOpenMin, getOpenMin } = await import('../app/games/bridge.bid.js');
  // 12 HCP, flat, no 5-card major: book passes, home game opens 1C
  const hand = ['KS', 'QS', '2S', 'KH', '3H', '4H', 'KD', '5D', '6D', 'JC', '7C', '8C', '2C'];
  assert.equal(getOpenMin(), 13);
  assert.equal(openingBid(hand).call, 'P');
  setOpenMin(12);
  assert.equal(getOpenMin(), 12);
  assert.equal(openingBid(hand).call, '1C');
  setOpenMin(99); // anything not 12 snaps back to book
  assert.equal(getOpenMin(), 13);
  assert.equal(openingBid(hand).call, 'P');
});

test('bridge: convention quiz bank is well-formed', async () => {
  const { CONVENTIONS, QUIZ } = await import('../app/games/bridge.conventions.js');
  assert.ok(CONVENTIONS.length >= 10);
  const ids = new Set(CONVENTIONS.map(c => c.id));
  assert.equal(ids.size, CONVENTIONS.length, 'unique ids');
  for (const c of CONVENTIONS) {
    assert.ok(c.name && c.bid && c.when && c.trap, c.id);
    assert.ok(c.schedule.length >= 3, c.id + ' schedule');
    assert.ok(c.quiz.length >= 2, c.id + ' quiz');
    for (const q of c.quiz) {
      assert.ok(q.choices.length >= 2 && Number.isInteger(q.a), c.id);
      assert.ok(q.a >= 0 && q.a < q.choices.length, c.id + ' answer in range');
      assert.ok(q.q && q.why, c.id + ' prose');
    }
  }
  assert.equal(QUIZ.length, CONVENTIONS.reduce((n, c) => n + c.quiz.length, 0));
});

test('bridge: bid-only auctions terminate at both opening thresholds', async () => {
  const { setOpenMin } = await import('../app/games/bridge.bid.js');
  for (const min of [13, 12]) {
    setOpenMin(min);
    let contracts = 0;
    for (let n = 0; n < 60; n++) {
      const a = B.newAuction(n % 4, B.deal(Math.random));
      let guard = 0;
      while (a.phase === 'auction' && guard++ < 80) B.makeCall(a, a.turn, botCall(a, a.turn, 'solid'));
      assert.ok(a.phase === 'play' || a.phase === 'passout', 'auction ends');
      if (a.contract) { contracts++; assert.ok(a.contract.declarer >= 0 && a.contract.declarer <= 3); }
    }
    assert.ok(contracts > 15, `bots reach contracts opening on ${min}`);
  }
  setOpenMin(13);
});
