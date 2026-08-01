import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECK, TRUMP, points, handPoints, isTrump, effSuit, beats, trickWinner,
  deal, newHand, pass, pick, buryAndCall, callableSuits, legalMoves,
  currentTurn, playCard, score, sortHand,
} from '../app/games/sheepshead.engine.js';
import { evalPick, suggestBury, gradeLeads, botPickDecision, botPlay, adviseMove } from '../app/games/sheepshead.coach.js';

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
  // double on the bump: picker-side losses always pay x2
  assert.equal(r2.bump, 2);
  assert.equal(r2.delta[0], -4);
  assert.equal(r2.delta.reduce((a, b) => a + b, 0), 0, 'zero-sum with bump');
});

test('coach: never over a winning teammate, schmears are never queens', () => {
  // Trick so far: seat3 led AC, seat4 threw 9C, seat0 (the picker) trumped in.
  // Seat1 is the partner (holds the called ace) and could overtrump with QS.
  const mk = winCard => {
    const s = newHand(2, rng); // first seat = 3
    s.phase = 'play'; s.picker = 0; s.partner = 1;
    s.calledSuit = 'H'; s.calledAce = 'AH'; s.buried = ['KD', '9H'];
    s.hands = [
      sortHand(['QH', 'JD', '9D', '8D', '7D']),
      sortHand(['QS', 'AH', '8H', '7S', 'KS', 'TS']), // partner, void in clubs
      sortHand(['JC', 'JS', 'KH', 'TH', '8S', '9S']),
      sortHand(['TC', '7H', '7C', '8C', 'QD']),
      sortHand(['AS', 'AD', 'TD', 'KC', winCard === 'JH' ? 'QC' : 'JH']),
    ];
    s.trick = ['AC', '9C', winCard]; s.trickSeats = [3, 4, 0]; s.leader = 3;
    return s;
  };
  for (const level of ['solid', 'expert']) {
    // Picker winning with JH: not safe yet, but it is still the partner's side —
    // never go over, keep the queen home, throw a blank.
    const low = botPlay(mk('JH'), 1, level);
    assert.notEqual(low, 'QS', level + ': must not trump over the winning picker');
    assert.equal(points(low), 0, level + ': throws a blank, not points');
    // Picker winning with QC (boss): schmear the ten, never a queen.
    assert.equal(botPlay(mk('QC'), 1, level), 'TS', level + ': schmear the fat ten');
  }
});

test('coach: expert end-position play fires on trick 4 (and only for expert)', () => {
  // Trick 4, seats 2,3,4,0 have played, the picker (0) is winning with JD,
  // and the partner (seat 1, holding the picker on his right) is last with
  // QC + ducks in hand. Expert takes the trick to hand the picker last
  // position on trick 5; solid never plays over its mate.
  const s = newHand(1, rng); // first seat = 2
  s.phase = 'play'; s.picker = 0; s.partner = 1;
  s.calledSuit = 'H'; s.calledAce = 'AH'; s.aceFlipped = true; s.calledSuitLed = true;
  s.buried = ['KD', '9H']; s.trickNo = 3;
  s.hands = [
    sortHand(['QD', 'TD', '8D']),        // picker: played JD this trick
    sortHand(['QC', '7H', '8H']),        // partner, last to play
    sortHand(['TS', 'KS']),
    sortHand(['AC', 'TC']),
    sortHand(['AS', '9C']),
  ];
  s.trick = ['9S', '8S', '7S', 'JD']; s.trickSeats = [2, 3, 4, 0]; s.leader = 2;
  const expert = adviseMove(s, 1, 'expert');
  assert.equal(expert.card, 'QC');
  assert.ok(expert.why.includes('Take it from the picker'), 'end-position reason shown');
  const solid = botPlay(s, 1, 'solid');
  assert.notEqual(solid, 'QC', 'solid never plays over its mate here');
});

test('coach: pick verdicts follow the book', () => {
  assert.equal(evalPick(['QC', 'QS', 'QH', 'JD', '7D', 'AC'], 2).verdict, 'pick'); // 5 trump
  assert.equal(evalPick(['QC', 'QS', '7D', 'AC', 'TC', '9S'], 1).verdict, 'pick'); // 2 queens + trump + bury points
  assert.equal(evalPick(['QH', 'JD', '9D', '8D', 'AC', 'TS'], 3).verdict, 'pick'); // queen + 3 trump + bury points
  assert.equal(evalPick(['9C', '8C', '7C', '9S', '8S', 'AH'], 0).verdict, 'pass'); // trumpless junk
  assert.equal(evalPick(['QC', 'QS', 'AC', 'TC', '9S', '8H'], 2).verdict, 'pass'); // black queens mid-seat
  assert.equal(evalPick(['QC', 'QS', 'AC', 'TC', '9S', '8H'], 0).verdict, 'pick'); // black queens leading
  // Strupp: the 2Q and 1Q picking hands want points to bury; without them, borderline
  assert.equal(evalPick(['QC', 'QH', 'JD', '9C', '8S', '7H'], 2).verdict, 'either');
  assert.equal(evalPick(['QH', 'JC', 'JD', '9D', '9C', '8S'], 2).verdict, 'either');
});

test('coach: Strupp play rules at the table', () => {
  // Rule 22: the partner in the lead plays a SMALL trump, not a big queen.
  const lead = gradeLeads(['QS', 'JD', 'AH', '9S', '8C', '7C'], 'partner', 'H');
  assert.equal(lead.grades['JD'][0], 'best');
  assert.notEqual(lead.grades['QS'][0], 'best');
  // Rule 26: defender trumping a fail trick sends a man, not a boy. Play
  // order is 3,4,0,1,2 — seat 4 plays second, the picker (seat 0) is still
  // behind, so the 60% rule stays out of it.
  const s = newHand(2, rng); // first seat = 3
  s.phase = 'play'; s.picker = 0; s.partner = 1;
  s.calledSuit = 'H'; s.calledAce = 'AH'; s.buried = ['KD', '9H'];
  s.hands = [
    sortHand(['QH', 'JH', 'QD', '8D', '7D', 'KH']),  // picker, still to play
    sortHand(['QS', 'AH', '8H', '7S', 'KS', 'TS']),  // partner, still to play
    sortHand(['AD', 'TD', 'KC', '9C', 'QC', '8C']),
    sortHand(['TC', '7C', '9D', 'AS', 'JS']),        // led AC
    sortHand(['JC', 'JD', 'TH', '8S', '9S', '7H']),  // to play now, void in clubs
  ];
  s.trick = ['AC']; s.trickSeats = [3]; s.leader = 3;
  for (const level of ['solid', 'expert']) {
    assert.equal(botPlay(s, 4, level), 'JC', level + ': trump the fail trick with the man, not the boy');
  }
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
  assert.equal(g2.grades['QD'][0], 'best'); // his only trump IS the small trump lead (Strupp Rule 22)
  const g3 = gradeLeads(['9H', 'QD', 'AS'], 'defender', 'H');
  assert.equal(g3.grades['9H'][0], 'best');
  assert.equal(g3.grades['QD'][0], 'bad');
});

test('rules module purity: engine and coach import nothing external', async () => {
  const fs = await import('node:fs');
  for (const f of ['sheepshead.engine.js', 'sheepshead.coach.js', 'sheepshead.study.js', 'euchre.engine.js', 'euchre.coach.js', 'hearts.engine.js', 'hearts.coach.js', 'ohhell.engine.js', 'ohhell.coach.js', 'rook.logic.js']) {
    const src = fs.readFileSync(new URL(`../app/games/${f}`, import.meta.url), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map(m => m[1]);
    imports.forEach(i => assert.ok(i.startsWith('./'), `${f} imports only siblings, got ${i}`));
    // coaches may only reach their engine: the one-way layering is load-bearing
    if (f.endsWith('.coach.js')) {
      imports.forEach(i => assert.ok(i.endsWith('.engine.js'), `${f} imports only its engine, got ${i}`));
    }
  }
});

test('hard rules: no dangerous DOM sinks anywhere, sw cache prefix intact', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  // every first-party source file that can touch the DOM
  const roots = [new URL('../app/', import.meta.url), new URL('../app/games/', import.meta.url)];
  const files = roots.flatMap(dir =>
    fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => new URL(f, dir)));
  files.push(new URL('../index.html', import.meta.url), new URL('../sw.js', import.meta.url));
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/innerHTML|dangerouslySetInnerHTML|\beval\(|new Function/.test(src),
      `${path.basename(f.pathname)} contains a forbidden DOM sink`);
  }
  // the sw cleanup MUST stay scoped to this app's caches: the origin is shared
  // with sibling PWAs and an unprefixed cleanup evicts their caches
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const CACHE = 'finesse-v\d+'/, 'CACHE name keeps the finesse- prefix');
  assert.match(sw, /keys\.filter\(k => k\.startsWith\('finesse-'\)/, 'activate cleanup filters to finesse- caches');
  assert.match(sw, /cacheName: CACHE/, 'fetch lookup scoped to our own cache');
});

