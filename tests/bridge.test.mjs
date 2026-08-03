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
    else if (!a.contract.dbl) assert.equal(a.result.score, -50 * (need - a.tricksDecl));
    else assert.ok(a.result.score < 0, 'doubled set is negative');
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

test('bridge: practice generators produce valid graded scenes', async () => {
  const { practiceScene, PRACTICE_IDS, buildHand } = await import('../app/games/bridge.learn.js');
  const { CONVENTIONS } = await import('../app/games/bridge.conventions.js');
  // every convention with a hook is practicable
  assert.equal(PRACTICE_IDS.length, CONVENTIONS.length);
  for (const cv of CONVENTIONS) {
    assert.ok(PRACTICE_IDS.includes(cv.id), cv.id + ' has practice');
    assert.ok(cv.hook && cv.hook.length > 20, cv.id + ' hook');
    assert.ok(cv.numbers && cv.numbers.length === 3, cv.id + ' numbers');
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const s = practiceScene(cv.id);
      assert.ok(s, cv.id + ' scene builds');
      assert.equal(s.hand.length, 13, cv.id + ' 13 cards');
      assert.equal(new Set(s.hand).size, 13, cv.id + ' unique cards');
      assert.ok(s.choices.length >= 3 && s.choices.some(c => c.id === s.answer), cv.id + ' answer offered');
      assert.ok(s.prompt && s.why, cv.id + ' prose');
      assert.ok(s.strip.length >= 1 && s.strip[s.strip.length - 1].who === 'You' && s.strip[s.strip.length - 1].call === null, cv.id + ' strip ends on you');
      seen.add(s.answer);
    }
    assert.ok(seen.size >= 2, cv.id + ' varies its answers: ' + [...seen]);
  }
  // buildHand honors shape and points
  for (let i = 0; i < 50; i++) {
    const h = buildHand(Math.random, { S: 5, H: 2, D: 3, C: 3 }, 15, 17);
    assert.equal(h.length, 13);
    assert.equal(h.filter(c => c[1] === 'S').length, 5);
    const p = B.hcp(h);
    assert.ok(p >= 15 && p <= 17, 'hcp in window, got ' + p);
  }
});

// ---- doubles, redoubles, vulnerability (the Elon criteria) -----------------

test('bridge: X/XX legality matrix', () => {
  const a = B.newAuction(0, B.deal(Math.random));
  assert.ok(!B.legalCalls(a).includes('X'), 'no double before any bid');
  B.makeCall(a, 0, '1S');
  assert.ok(B.legalCalls(a).includes('X'), 'opponent may double a bid');
  assert.ok(!B.legalCalls(a).includes('XX'), 'no redouble before a double');
  B.makeCall(a, 1, 'X');
  assert.ok(!B.legalCalls(a).includes('X'), 'no double of a double');
  assert.ok(B.legalCalls(a).includes('XX'), 'doubled side may redouble');
  B.makeCall(a, 2, 'XX');
  assert.ok(!B.legalCalls(a).includes('X'), 'no double of a redouble');
  assert.ok(!B.legalCalls(a).includes('XX'), 'no re-redouble');
  B.makeCall(a, 3, '2H'); // new bid wipes the double state
  assert.ok(B.legalCalls(a).includes('X'), 'fresh bid may be doubled');
  // partner of the bidder cannot double own side
  B.makeCall(a, 0, 'P');
  assert.ok(!B.legalCalls(a).includes('X') || (1 % 2 !== 3 % 2), 'sides checked');
  const b = B.newAuction(0, B.deal(Math.random));
  B.makeCall(b, 0, '1S');
  B.makeCall(b, 1, 'P');
  assert.ok(!B.legalCalls(b).includes('X'), 'partner cannot double own side bid');
});

test('bridge: doubled auction ends into a doubled contract and plays out', () => {
  const a = B.newAuction(0, B.deal(Math.random));
  B.makeCall(a, 0, '1S');
  B.makeCall(a, 1, 'X');
  B.makeCall(a, 2, 'P');
  B.makeCall(a, 3, 'P');
  B.makeCall(a, 0, 'P');
  assert.equal(a.phase, 'play');
  assert.equal(a.contract.bid, '1S');
  assert.equal(a.contract.dbl, 1);
  assert.equal(a.contract.declarer, 0);
  while (a.phase === 'play') {
    const seat = B.currentTurn(a);
    B.playCard(a, seat, botPlay(a, seat, 'solid'));
  }
  assert.equal(a.phase, 'done');
  assert.ok(Number.isFinite(a.result.score), 'doubled contract scores');
});

test('bridge: full duplicate scoring table (doubled/redoubled/vul)', () => {
  const s = (lvl, st, dbl, vul, taken) => B.scoreContract({ level: lvl, strain: st, dbl, vul }, taken).score;
  // undoubled vulnerability
  assert.equal(s(3, 'N', 0, false, 7), -100); // down 2 NV
  assert.equal(s(3, 'N', 0, true, 7), -200);  // down 2 vul: 100 each
  assert.equal(s(3, 'N', 0, true, 9), 100 + 500); // vul game bonus 500
  // doubled making
  assert.equal(s(2, 'S', 1, false, 8), 120 + 300 + 50); // 2S doubled = game, NV: 470
  assert.equal(s(2, 'S', 1, true, 8), 120 + 500 + 50);  // vul: 670
  assert.equal(s(2, 'S', 1, false, 9), 470 + 100); // doubled overtrick NV 100
  assert.equal(s(2, 'S', 1, true, 9), 670 + 200);  // doubled overtrick vul 200
  // doubled down ladders
  assert.equal(s(4, 'S', 1, false, 7), -(100 + 200 + 200)); // X NV down 3 = -500
  assert.equal(s(4, 'S', 1, false, 5), -(100 + 200 + 200 + 300 + 300)); // down 5 = -1100
  assert.equal(s(4, 'S', 1, true, 7), -(200 + 300 + 300)); // X vul down 3 = -800
  // redoubled
  assert.equal(s(2, 'S', 2, false, 6), -2 * (100 + 200)); // XX NV down 2 = -600
  assert.equal(s(1, 'N', 2, false, 7), 160 + 300 + 100); // 1NT XX made NV = 560: game on the redoubled value + 100 insult
  // slam bonuses by vulnerability
  assert.equal(s(6, 'H', 0, true, 12), 180 + 500 + 750);
  assert.equal(s(7, 'N', 0, true, 13), 220 + 500 + 1500);
});

test('bridge: fuzz 2000 all-bot auctions terminate sane at every level and vul', () => {
  let x = 9001;
  const rng = () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) / 4294967296);
  };
  const levels = ['novice', 'solid', 'expert'];
  let doubles = 0;
  for (let n = 0; n < 2000; n++) {
    const a = B.newAuction(n % 4, B.deal(rng), B.vulForBoard(n));
    let guard = 0;
    while (a.phase === 'auction' && guard++ < 60) {
      B.makeCall(a, a.turn, botCall(a, a.turn, levels[n % 3]));
    }
    assert.ok(a.phase === 'play' || a.phase === 'passout', `auction ${n} terminates`);
    if (a.contract) {
      assert.ok(Number.isFinite(a.contract.level) && a.contract.level >= 1 && a.contract.level <= 7, `sane level, deal ${n}`);
      assert.ok(B.STRAINS.includes(a.contract.strain), `sane strain, deal ${n}`);
      assert.ok([0, 1, 2].includes(a.contract.dbl), `sane dbl, deal ${n}`);
      if (a.contract.dbl > 0) doubles++;
    }
    if (a.calls.includes('X')) assert.ok(a.calls.some(B.isBid), 'X never without a bid');
  }
  assert.ok(doubles > 5, `bot doubles actually occur (${doubles} doubled contracts in 2000)`);
});

test('bridge: takeout double fires and gets advanced', () => {
  // classic shape over RHO 1H: 4-1-4-4, 13 HCP -> X
  const doubler = ['AS', 'KS', '3S', '2S', '7H', 'KD', 'QD', '4D', '3D', 'AC', '5C', '4C', '3C'];
  const a = B.newAuction(3, [[], [], [], []]);
  a.hands[3] = ['AH', 'KH', 'QH', 'JH', 'TH', '2H', 'AD', 'KD', '2D', '2C', '3C', '4C', '5C'];
  B.makeCall(a, 3, botCall(a, 3, 'solid') === '1H' ? '1H' : '1H');
  a.hands[0] = doubler;
  assert.equal(botCall(a, 0, 'solid'), 'X');
  // advancer with nothing must still bid
  B.makeCall(a, 0, 'X');
  B.makeCall(a, 1, 'P');
  a.hands[2] = ['5S', '4S', '3S', '2S', '9H', '8H', '7D', '6D', '5D', '4D', '5C', '3C', '2C'];
  const adv = botCall(a, 2, 'solid');
  assert.ok(adv !== 'P', `advancer must bid, got ${adv}`);
});

test('bridge: vulnerability rotation breaks the dealer lockstep', () => {
  // dealer is board % 4; vul must NOT be welded to it
  assert.equal(B.vulForBoard(0), 'none');
  assert.equal(B.vulForBoard(4), 'ns'); // dealer 0 again, different vul
  assert.equal(B.vulForBoard(8), 'ew');
  assert.equal(B.vulForBoard(12), 'both');
  // every dealer sees every vulnerability across 16 boards
  const seen = {};
  for (let n = 0; n < 16; n++) {
    const d = n % 4;
    (seen[d] = seen[d] || new Set()).add(B.vulForBoard(n));
  }
  for (let d = 0; d < 4; d++) assert.equal(seen[d].size, 4, `dealer ${d} sees all four vuls`);
});

test('bridge: miss queue transform (owed hands, cap, dedupe, review)', async () => {
  const { settleMissQueue, practiceScene } = await import('../app/games/bridge.learn.js');
  const mk = n => ({ hand: ['A' + 'SHDC'[n % 4], String(n)], strip: [], prompt: 'p', choices: [{ id: 'P', label: 'Pass' }], answer: 'P', why: 'w' });
  // wrong first try: queued once, deduped
  let q = settleMissQueue([], mk(1), false);
  assert.equal(q.length, 1);
  q = settleMissQueue(q, mk(1), false);
  assert.equal(q.length, 1, 'same hand not queued twice');
  // right first try: nothing queued
  assert.equal(settleMissQueue([], mk(2), true).length, 0);
  // cap at 10
  q = [];
  for (let i = 0; i < 15; i++) q = settleMissQueue(q, mk(i * 7 + 3), false);
  assert.equal(q.length, 10);
  // correct review clears the head
  const head = q[0];
  const cleared = settleMissQueue(q, { ...head, review: true }, true);
  assert.equal(cleared.length, 9);
  assert.ok(!cleared.some(s => s.hand.join('') === head.hand.join('')));
  // wrong review rotates to the back, keeps length
  const rotated = settleMissQueue(cleared, { ...cleared[0], review: true }, false);
  assert.equal(rotated.length, 9);
  assert.equal(rotated[rotated.length - 1].hand.join(''), cleared[0].hand.join(''));
  // real scenes serialize clean (no htm nodes)
  const s = practiceScene('stayman');
  const roundtrip = JSON.parse(JSON.stringify(settleMissQueue([], s, false)));
  assert.equal(roundtrip.length, 1);
  assert.equal(typeof roundtrip[0].prompt, 'string');
});

test('bridge: negative doubles fire, natural bids stay natural', async () => {
  const { negativeDouble } = await import('../app/games/bridge.bid.js');
  const seatBot = (dealer, calls, hand) => {
    const a = B.newAuction(dealer, [hand, [], [], []]);
    let s = dealer;
    for (const c of calls) { B.makeCall(a, s, c); s = (s + 1) % 4; }
    return botCall(a, 0, 'solid');
  };
  // 1D - (1S): four hearts, 11 HCP -> negative double
  const fourH = ['KH', 'QH', '7H', '6H', 'AD', '8D', '7D', '6D', '9S', '8S', 'QC', '3C', '2C'];
  assert.equal(seatBot(2, ['1D', '1S'], fourH), 'X');
  // same shape at 6 HCP: two-level negative double needs 8
  const weak = ['QH', 'JH', '7H', '6H', 'KD', '8D', '7D', '6D', '9S', '8S', '4C', '3C', '2C'];
  assert.equal(negativeDouble('1D', '1S', weak), null);
  // 1D - (1H): EXACTLY four spades doubles, five spades bid 1S
  const fourS = ['AS', 'QS', '8S', '2S', 'KD', '7D', '6D', '5D', '9H', '8H', 'QC', '3C', '2C'];
  assert.equal(seatBot(2, ['1D', '1H'], fourS), 'X');
  const fiveS = ['AS', 'QS', '8S', '3S', '2S', 'KD', '7D', '6D', '9H', '8H', 'QC', '3C', '2C'];
  assert.equal(seatBot(2, ['1D', '1H'], fiveS), '1S');
  // 1D - (1S): five hearts with 11 HCP bids 2H naturally, not X
  const fiveH = ['AH', 'QH', '8H', '3H', '2H', 'KD', '7D', '6D', '9S', '8S', 'QC', '3C', '2C'];
  assert.equal(seatBot(2, ['1D', '1S'], fiveH), '2H');
  // opener advances the double: cheap with a minimum, jump with 16+
  const minOpen = ['AH', 'KH', '6H', '5H', 'AD', 'KD', '8D', '7D', '6D', '8S', '7S', '3C', '2C'];
  assert.equal(seatBot(0, ['1D', '1S', 'X', 'P'], minOpen), '2H');
  const bigOpen = ['AH', 'KH', 'QH', '5H', 'AD', 'KD', '8D', '7D', '6D', '8S', '7S', 'KC', '2C'];
  assert.equal(seatBot(0, ['1D', '1S', 'X', 'P'], bigOpen), '3H');
});

test('bridge: weak-two 2NT feature ask, both seats', async () => {
  const { featureReply } = await import('../app/games/bridge.bid.js');
  // responder: 14-16 with a fit asks, 17+ just bids game
  const ask = ['AS', 'KS', '7S', '6S', 'QH', '8H', '2H', 'AD', '8D', '7D', 'QC', '3C', '2C'];
  assert.equal(responseTo('2H', ask).call, '2N');
  const drive = ['AS', 'KS', 'QS', '6S', 'QH', '8H', '2H', 'AD', 'KD', '7D', 'QC', '3C', '2C'];
  assert.equal(responseTo('2H', drive).call, '4H');
  // opener: maximum shows the outside honor, minimum rebids the suit
  const maxHand = ['KH', 'QH', 'JH', '9H', '8H', '7H', 'KD', '5D', '4D', '3S', '2S', '3C', '2C'];
  assert.equal(featureReply(maxHand, 'H').call, '3D');
  const minHand = ['KH', 'QH', 'JH', '9H', '8H', '7H', '6D', '5D', '4D', '3S', '2S', '3C', '2C'];
  assert.equal(featureReply(minHand, 'H').call, '3H');
  // full bot loop: ask answered, game reached over a feature
  const a = B.newAuction(0, [
    ['KH', 'QH', 'JH', '9H', '8H', '7H', 'KD', '5D', '4D', '3S', '2S', '3C', '2C'],
    ['6S', '5S', '4S', '6H', '5H', '4H', 'JD', '9D', '8D', '7C', '6C', '5C', '4C'],
    ['AS', 'KS', '7S', '6S', 'QH', '8H', '2H', 'AD', '8D', '7D', 'QC', '3C', '2C'],
    ['QS', 'JS', 'TS', '9S', '8S', 'TH', '3H', 'QD', 'TD', '2D', 'KC', 'TC', '9C'],
  ]);
  let guard = 0;
  while (a.phase === 'auction' && guard++ < 30) {
    B.makeCall(a, a.turn, botCall(a, a.turn, 'solid'));
  }
  assert.equal(a.phase, 'play');
  assert.deepEqual(a.calls.slice(0, 6), ['2H', 'P', '2N', 'P', '3D', 'P']);
  assert.equal(a.contract.bid, '4H');
});

test('bridge: doubles of notrump read as penalty', () => {
  const mk = (dealer, hands) => B.newAuction(dealer, hands);
  const doubler = ['AS', 'KS', '2S', 'QH', 'JH', '3H', 'AD', '4D', '5D', 'KC', '6C', '7C', '8C']; // 16
  const sitter = ['KS', '5S', '4S', 'TH', '8H', '6H', '5H', 'QD', '8D', '3D', 'JC', '9C', '2C']; // 6
  const bust = ['JC', '9C', '8C', '7C', '6C', '2C', '5S', '4S', '3S', '8D', '3D', '6H', '5H']; // 1, six clubs
  // 15+ sitting over their 1NT doubles for penalty
  let a = mk(3, [doubler, [], [], ['2H', '2D', '2C', '2S', '3C', '3D', '3H', '3S', '4C', '4D', '4H', '4S', '5C']]);
  B.makeCall(a, 3, '1N');
  assert.equal(botCall(a, 0, 'solid'), 'X');
  // partner of the doubler sits with any values
  B.makeCall(a, 0, 'X');
  B.makeCall(a, 1, 'P');
  a.hands[2] = sitter;
  assert.equal(botCall(a, 2, 'solid'), 'P');
  // but runs from a bust with a long suit
  a.hands[2] = bust;
  assert.equal(botCall(a, 2, 'solid'), '2C');
});
