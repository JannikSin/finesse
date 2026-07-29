// Pure euchre rules: 4-handed partnership (0&2 vs 1&3), 24 cards, bowers,
// two-round calling with stick-the-dealer. ZERO imports.

export const SUITS = ['C', 'S', 'H', 'D'];
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9'];
export const DECK = SUITS.flatMap(s => RANKS.map(r => r + s));
export const COLOR_MATE = { C: 'S', S: 'C', H: 'D', D: 'H' };

export const isRight = (c, t) => c === 'J' + t;
export const isLeft = (c, t) => c === 'J' + COLOR_MATE[t];
export const isTrump = (c, t) => c[1] === t || isLeft(c, t);
export const effSuit = (c, t) => (isLeft(c, t) ? t : c[1]);

// Lower is stronger within trump; fail suits rank by RANKS index.
export function trumpPower(c, t) {
  if (isRight(c, t)) return 0;
  if (isLeft(c, t)) return 1;
  return 2 + ['A', 'K', 'Q', 'T', '9'].indexOf(c[0]);
}

export function beats(a, b, t) { // does later card b beat current winner a?
  const at = isTrump(a, t), bt = isTrump(b, t);
  if (at && bt) return trumpPower(b, t) < trumpPower(a, t);
  if (bt) return true;
  if (at) return false;
  if (b[1] !== a[1]) return false;
  return RANKS.indexOf(b[0]) < RANKS.indexOf(a[0]);
}

export function trickWinner(cards, t) {
  let w = 0;
  for (let i = 1; i < cards.length; i++) if (beats(cards[w], cards[i], t)) w = i;
  return w;
}

export function sortHand(h, t) {
  return [...h].sort((a, b) => {
    if (t) {
      const at = isTrump(a, t), bt = isTrump(b, t);
      if (at && bt) return trumpPower(a, t) - trumpPower(b, t);
      if (at) return -1;
      if (bt) return 1;
    }
    if (a[1] !== b[1]) return SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]);
    return RANKS.indexOf(a[0]) - RANKS.indexOf(b[0]);
  });
}

export function deal(rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return { hands: [0, 1, 2, 3].map(i => sortHand(d.slice(i * 5, i * 5 + 5))), upcard: d[20] };
}

export const teamOf = seat => seat % 2;

export function newHand(dealer, rng = Math.random) {
  const { hands, upcard } = deal(rng);
  return {
    phase: 'call1', // call1 -> call2 -> (discard) -> play -> done
    dealer, hands, upcard,
    turn: (dealer + 1) % 4, passes: 0,
    trump: null, maker: null, alone: false, sitout: null,
    leader: (dealer + 1) % 4, trick: [], trickSeats: [], trickNo: 0,
    tricksWon: [0, 0], // by team
  };
}

function startPlay(s) {
  s.phase = 'play';
  if (s.alone) s.sitout = (s.maker + 2) % 4;
  s.leader = (s.dealer + 1) % 4;
  if (s.leader === s.sitout) s.leader = (s.leader + 1) % 4;
  s.turn = s.leader;
}

// action: 'pass' | 'order' | 'alone' (round 1)
export function callRound1(s, seat, action) {
  if (s.phase !== 'call1' || s.turn !== seat) throw new Error('not your call');
  if (action === 'pass') {
    s.passes++;
    if (s.passes === 4) { s.phase = 'call2'; s.turn = (s.dealer + 1) % 4; s.passes = 0; return s; }
    s.turn = (s.turn + 1) % 4;
    return s;
  }
  s.trump = s.upcard[1];
  s.maker = seat;
  s.alone = action === 'alone';
  // Dealer takes the upcard and must shed one.
  s.hands[s.dealer] = sortHand([...s.hands[s.dealer], s.upcard], s.trump);
  s.phase = 'discard';
  s.turn = s.dealer;
  return s;
}

// action: 'pass' | suit (not the upcard suit). Stick the dealer: dealer must call.
export function callRound2(s, seat, action) {
  if (s.phase !== 'call2' || s.turn !== seat) throw new Error('not your call');
  if (action === 'pass') {
    if (seat === s.dealer) throw new Error('stick the dealer: must call');
    s.passes++;
    s.turn = (s.turn + 1) % 4;
    return s;
  }
  const suit = action.endsWith('!') ? action.slice(0, -1) : action; // 'H!' = alone
  if (suit === s.upcard[1]) throw new Error('cannot call the turned-down suit');
  s.trump = suit;
  s.maker = seat;
  s.alone = action.endsWith('!');
  s.hands = s.hands.map(h => sortHand(h, s.trump));
  startPlay(s);
  return s;
}

export function discard(s, card) {
  if (s.phase !== 'discard') throw new Error('not discarding');
  const h = s.hands[s.dealer];
  if (!h.includes(card)) throw new Error('not in hand');
  s.hands[s.dealer] = h.filter(c => c !== card);
  s.hands = s.hands.map(h2 => sortHand(h2, s.trump));
  startPlay(s);
  return s;
}

export const activeSeats = s => [0, 1, 2, 3].filter(x => x !== s.sitout);

export function currentTurn(s) {
  let seat = s.leader;
  for (let i = 0; i < s.trick.length; i++) {
    do { seat = (seat + 1) % 4; } while (seat === s.sitout);
  }
  return seat;
}

export function legalMoves(s, seat) {
  if (s.phase !== 'play' || currentTurn(s) !== seat) return [];
  const hand = s.hands[seat];
  if (s.trick.length === 0) return [...hand];
  const led = effSuit(s.trick[0], s.trump);
  const follow = hand.filter(c => effSuit(c, s.trump) === led);
  return follow.length ? follow : [...hand];
}

export function playCard(s, seat, card) {
  if (!legalMoves(s, seat).includes(card)) throw new Error('illegal card ' + card);
  s.hands[seat] = s.hands[seat].filter(c => c !== card);
  s.trick.push(card);
  s.trickSeats.push(seat);
  if (s.trick.length === activeSeats(s).length) {
    const w = s.trickSeats[trickWinner(s.trick, s.trump)];
    s.tricksWon[teamOf(w)]++;
    s.lastTrick = { cards: [...s.trick], seats: [...s.trickSeats], winner: w };
    s.trick = [];
    s.trickSeats = [];
    s.leader = w;
    s.trickNo++;
    if (s.trickNo === 5) { s.phase = 'done'; s.result = score(s); }
  }
  return s;
}

export function score(s) {
  const makers = teamOf(s.maker);
  const taken = s.tricksWon[makers];
  const delta = [0, 0];
  if (taken === 5) delta[makers] = s.alone ? 4 : 2;
  else if (taken >= 3) delta[makers] = 1;
  else delta[1 - makers] = 2; // euchred
  return { makers, taken, euchred: taken < 3, march: taken === 5, delta };
}
