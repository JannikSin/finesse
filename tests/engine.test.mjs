import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECK, TRUMP, points, handPoints, isTrump, effSuit, beats, trickWinner,
  deal, newHand, pass, pick, buryAndCall, callableSuits, legalMoves,
  currentTurn, playCard, score, sortHand,
} from '../app/engine.js';
import { evalPick, suggestBury, gradeLeads, botPickDecision, botPlay } from '../app/coach.js';

// deterministic rng
const rng = (seed => () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)(42);

test('deck: 32 cards, 120 points, 14 trump', () => {
  assert.equal(DECK.length, 32);
  assert.equal(new Set(DECK).size, 32);
  assert.equal(handPoints(DECK), 120);
  assert.equal(DECK.filter(isTrump).length, 14);
  assert.equal(TRUMP.length, 14);
});

test('trump order and beats', () => {
  assert.ok(beats('QS', 'QC')); // beats(a,b): does later card b beat current winner a
  assert.ok(!beats('QC', 'QS')); // nothing beats QC
  assert.ok(beats('7D', 'QC'));
  assert.ok(beats('AC', 'JD')); // any trump beats fail ace
  assert.ok(!beats('JD', 'AC'));
  assert.ok(beats('KC', 'TC')); // ten over king within fail suit
  assert.ok(!beats('AC', 'AS')); // off-suit fail never wins
});

test('trick winner', () => {
  assert.equal(trickWinner(['AC', 'TC', 'KC', '9C', '8C']), 0);
  assert.equal(trickWinner(['AC', '7D', 'TC', 'KC', '9C']), 1); // low trump takes it
  assert.equal(trickWinner(['9C', 'JH', 'QH', 'JD', 'AC']), 2);
});

test('deal shapes', () => {
  const { hands, blind } = deal(rng);
  assert.equal(hands.length, 5);
  hands.forEach(h => assert.equal(h.length, 6));
  assert.equal(blind.length, 2);
  assert.equal(new Set([...hands.flat(), ...blind]).size, 32);
});

test('full hand plays out with bots and scores zero-sum', () => {
  for (let n = 0; n < 50; n++) {
    const s = newHand(4, Math.random);
    while (s.phase === 'pick') {
      if (botPickDecision(s, s.turn)) pick(s, s.turn); else pass(s);
    }
    if (s.phase === 'alldown') continue;
    const sb = suggestBury(s.hands[s.picker]);
    buryAndCall(s, sb.bury, sb.calledSuit);
    while (s.phase === 'play') {
      const seat = currentTurn(s);
      const card = botPlay(s, seat);
      assert.ok(legalMoves(s, seat).includes(card), 'bot picked legal card');
      playCard(s, seat, card);
    }
    assert.equal(s.phase, 'done');
    assert.equal(s.result.pickerPts + s.result.defPts, 120);
    assert.equal(s.result.delta.reduce((a, b) => a + b, 0), 0, 'zero-sum payout');
    if (s.calledSuit) assert.ok(s.partner !== s.picker && s.partner >= 0);
  }
});

test('cannot call a suit without retaining a card of it', () => {
  const s = newHand(4, Math.random);
  s.hands = [
    sortHand(['QC', 'QS', 'JC', 'JS', 'AD', 'KC']), // seat 0: picker material, no hearts
    sortHand(['AH', '9H', '8S', '7S', '9S', 'TS']),
    sortHand(['TH', 'KH', 'AS', 'KS', '7C', '8C']),
    sortHand(['AC', 'TC', '9C', 'QH', 'JH', 'JD']),
    sortHand(['TD', 'KD', '9D', '8D', '7D', 'QD']),
  ];
  s.blind = ['7H', '8H'];
  pick(s, 0);
  // burying both hearts leaves no heart to hold: hearts must not be callable
  assert.throws(() => buryAndCall(s, ['7H', '8H'], 'H'));
});

test('called ace rules: valid call and forced ace', () => {
  const s = newHand(4, Math.random);
  s.hands = [
    sortHand(['QC', 'QS', 'JC', 'JS', 'AD', '9H']), // seat 0 picker, holds 9H
    sortHand(['AH', 'TH', '8S', '7S', '9S', 'TS']), // seat 1 partner (A hearts)
    sortHand(['KH', '8H', 'AS', 'KS', '7C', '8C']),
    sortHand(['AC', 'TC', '9C', 'QH', 'JH', 'JD']),
    sortHand(['TD', 'KD', '9D', '8D', '7D', 'QD']),
  ];
  s.blind = ['7H', 'KC'];
  pick(s, 0);
  assert.deepEqual(callableSuits(s.hands[0], ['KC', '7H']), ['H']);
  buryAndCall(s, ['KC', '7H'], 'H');
  assert.equal(s.partner, 1);
  // seat 0 leads 9H (called suit): partner must answer with the ace
  playCard(s, 0, '9H');
  assert.deepEqual(legalMoves(s, 1), ['AH']);
  playCard(s, 1, 'AH');
  // partner may not dump the called ace off-suit before the suit is led (checked above by forcing)
  assert.ok(s.aceFlipped && s.calledSuitLed);
});

test('partner cannot throw called ace off-suit early', () => {
  const s = newHand(4, Math.random);
  s.hands = [
    sortHand(['QC', 'QS', 'JC', 'JS', 'AD', '9H']),
    sortHand(['AH', '8S', '7S', '9S', 'TS', 'KS']), // partner: A hearts + spades
    sortHand(['KH', '8H', 'AS', '7C', '8C', 'TH']),
    sortHand(['AC', 'TC', '9C', 'QH', 'JH', 'JD']),
    sortHand(['TD', 'KD', '9D', '8D', '7D', 'QD']),
  ];
  s.blind = ['7H', 'KC'];
  pick(s, 0);
  buryAndCall(s, ['KC', '7H'], 'H');
  playCard(s, 0, 'QC'); // trump led; partner has no trump: may throw anything EXCEPT the ace
  const legal = legalMoves(s, 1);
  assert.ok(!legal.includes('AH'));
  assert.equal(legal.length, 5);
});

test('scoring ladder', () => {
  const base = { picker: 0, partner: 1, alone: false, buried: ['AC', 'TC'] };
  const mk = (pickerPiles, defPiles) => ({ ...base, taken: [pickerPiles[0], pickerPiles[1], defPiles[0], defPiles[1], defPiles[2]] });
  // picker side takes everything
  const s1 = mk([DECK.slice(2, 17), DECK.slice(17, 32)], [[], [], []]);
  const r1 = score(s1);
  assert.ok(r1.win && r1.stake === 3);
  assert.deepEqual(r1.delta, [6, 3, -3, -3, -3]);
  // 60-60: defenders win at stake 1
  // build piles: picker side 60 incl bury(21): need 39 more; give AD TD AH 9C 8C (11+10+11+... = 32) plus KD KC? compute in test:
  const pickerCards = ['AD', 'TD', 'AH', 'KD', 'QD'];
  assert.equal(handPoints(pickerCards) + handPoints(base.buried), 60);
  const rest = DECK.filter(c => !pickerCards.includes(c) && !base.buried.includes(c));
  const s2 = mk([pickerCards, []], [rest, [], []]);
  const r2 = score(s2);
  assert.ok(!r2.win);
  assert.equal(r2.delta[0], -2);
});

test('coach: pick verdicts follow the book', () => {
  assert.equal(evalPick(['QC', 'QS', 'QH', 'JD', '7D', 'AC'], 2).verdict, 'pick'); // 5 trump
  assert.equal(evalPick(['QC', 'QS', '7D', 'AC', 'TC', '9S'], 1).verdict, 'pick'); // 2 queens + trump
  assert.equal(evalPick(['QH', 'JD', '9D', '8D', 'AC', 'TS'], 3).verdict, 'pick'); // queen + 3 trump
  assert.equal(evalPick(['9C', '8C', '7C', '9S', '8S', 'AH'], 0).verdict, 'pass'); // trumpless junk
  assert.equal(evalPick(['QC', 'QS', 'AC', 'TC', '9S', '8H'], 2).verdict, 'pass'); // black queens mid-seat
  assert.equal(evalPick(['QC', 'QS', 'AC', 'TC', '9S', '8H'], 0).verdict, 'pick'); // black queens leading
});

test('coach: bury keeps the hold card and calls a real suit', () => {
  for (let n = 0; n < 50; n++) {
    const d = deal(Math.random);
    const h8 = sortHand([...d.hands[0], ...d.blind]);
    const sb = suggestBury(h8);
    assert.equal(sb.bury.length, 2);
    sb.bury.forEach(c => assert.ok(h8.includes(c)));
    if (sb.calledSuit) {
      const kept = h8.filter(c => !sb.bury.includes(c));
      assert.ok(kept.some(c => !isTrump(c) && c[1] === sb.calledSuit), 'hold card retained');
      assert.ok(!kept.includes('A' + sb.calledSuit), 'did not call own ace');
    }
  }
});

test('coach: lead grades', () => {
  const g1 = gradeLeads(['QC', 'JD', 'AC', '9H'], 'picker', 'H');
  assert.equal(g1.grades['QC'][0], 'best');
  assert.equal(g1.grades['AC'][0], 'bad');
  const g2 = gradeLeads(['AH', 'QD', '9S'], 'partner', 'H');
  assert.equal(g2.grades['AH'][0], 'terrible');
  assert.equal(g2.grades['QD'][0], 'good');
  const g3 = gradeLeads(['9H', 'QD', 'AS'], 'defender', 'H');
  assert.equal(g3.grades['9H'][0], 'best');
  assert.equal(g3.grades['QD'][0], 'bad');
});

test('rules module purity: engine and coach import nothing external', async () => {
  const fs = await import('node:fs');
  for (const f of ['engine.js', 'coach.js', 'study.js']) {
    const src = fs.readFileSync(new URL(`../app/${f}`, import.meta.url), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map(m => m[1]);
    imports.forEach(i => assert.ok(i.startsWith('./'), `${f} imports only siblings, got ${i}`));
    assert.ok(!/innerHTML|eval\(|new Function/.test(src), `${f} clean`);
  }
});
