// Pure Sheepshead rules — 5-handed, called-ace partner, Wisconsin standard.
// ZERO imports. Cards are 2-char strings: rank (A T K Q J 9 8 7) + suit (C S H D).

export const TRUMP = ['QC','QS','QH','QD','JC','JS','JH','JD','AD','TD','KD','9D','8D','7D'];
export const FAIL_RANKS = ['A','T','K','9','8','7'];
export const FAIL_SUITS = ['C','S','H'];
export const DECK = [...TRUMP, ...FAIL_SUITS.flatMap(s => FAIL_RANKS.map(r => r + s))];

const PTS = { A: 11, T: 10, K: 4, Q: 3, J: 2 };
export const points = c => PTS[c[0]] || 0;
export const handPoints = cards => cards.reduce((n, c) => n + points(c), 0);
export const isTrump = c => c[0] === 'Q' || c[0] === 'J' || c[1] === 'D';
export const suitOf = c => c[1];
export const effSuit = c => (isTrump(c) ? 'T' : c[1]);
export const trumpPower = c => TRUMP.indexOf(c); // 0 = strongest

// Does b beat a (the current winning card)? a was played before b.
export function beats(a, b) {
  const at = isTrump(a), bt = isTrump(b);
  if (at && bt) return trumpPower(b) < trumpPower(a);
  if (bt) return true;
  if (at) return false;
  if (suitOf(b) !== suitOf(a)) return false;
  return FAIL_RANKS.indexOf(b[0]) < FAIL_RANKS.indexOf(a[0]);
}

// cards[0] is the led card. Returns index of the winner within cards.
export function trickWinner(cards) {
  let w = 0;
  for (let i = 1; i < cards.length; i++) if (beats(cards[w], cards[i])) w = i;
  return w;
}

export const sortHand = h => [...h].sort((a, b) => {
  const at = isTrump(a), bt = isTrump(b);
  if (at && bt) return trumpPower(a) - trumpPower(b);
  if (at) return -1;
  if (bt) return 1;
  if (a[1] !== b[1]) return FAIL_SUITS.indexOf(a[1]) - FAIL_SUITS.indexOf(b[1]);
  return FAIL_RANKS.indexOf(a[0]) - FAIL_RANKS.indexOf(b[0]);
});

export function shuffle(rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function deal(rng = Math.random) {
  const d = shuffle(rng);
  return { hands: [0, 1, 2, 3, 4].map(i => sortHand(d.slice(i * 6, i * 6 + 6))), blind: d.slice(30) };
}

// ---- hand state machine ----------------------------------------------------
// Seats 0..4. Seat (dealer+1)%5 leads trick 1 and gets first chance to pick.

export function newHand(dealer, rng = Math.random) {
  const { hands, blind } = deal(rng);
  const first = (dealer + 1) % 5;
  return {
    phase: 'pick', // pick -> bury -> play -> done | alldown
    dealer, hands, blind,
    turn: first, passes: 0,
    picker: null, alone: false,
    calledSuit: null, calledAce: null, partner: null,
    calledSuitLed: false, aceFlipped: false,
    buried: [],
    leader: first, trick: [], trickSeats: [], trickNo: 0,
    taken: [[], [], [], [], []],
    history: [], // completed tricks: {cards, seats, winner} — public info for honest bots
  };
}

export function pass(s) {
  if (s.phase !== 'pick') throw new Error('not picking');
  s.passes++;
  if (s.passes === 5) { s.phase = 'alldown'; return s; }
  s.turn = (s.turn + 1) % 5;
  return s;
}

export function pick(s, seat) {
  if (s.phase !== 'pick' || s.turn !== seat) throw new Error('not your pick');
  s.picker = seat;
  s.hands[seat] = sortHand([...s.hands[seat], ...s.blind]);
  s.phase = 'bury';
  return s;
}

// Suits the picker may call, given the 8-card hand minus an intended bury.
export function callableSuits(hand8, bury) {
  const kept = hand8.filter(c => !bury.includes(c));
  return FAIL_SUITS.filter(su =>
    !kept.includes('A' + su) && !bury.includes('A' + su) &&
    kept.some(c => !isTrump(c) && c[1] === su));
}

export function buryAndCall(s, bury, calledSuit) {
  if (s.phase !== 'bury') throw new Error('not burying');
  const hand = s.hands[s.picker];
  if (bury.length !== 2 || !bury.every(c => hand.includes(c))) throw new Error('bad bury');
  if (calledSuit) {
    if (!callableSuits(hand, bury).includes(calledSuit)) throw new Error('cannot call ' + calledSuit);
  }
  s.buried = bury;
  s.hands[s.picker] = hand.filter(c => !bury.includes(c));
  s.calledSuit = calledSuit || null;
  if (calledSuit) {
    s.calledAce = 'A' + calledSuit;
    s.partner = s.hands.findIndex(h => h.includes(s.calledAce));
    if (s.partner === s.picker) throw new Error('picker holds called ace'); // callableSuits prevents this
  } else {
    s.alone = true;
  }
  s.phase = 'play';
  return s;
}

export function legalMoves(s, seat) {
  if (s.phase !== 'play' || currentTurn(s) !== seat) return [];
  const hand = s.hands[seat];
  const lastTrick = s.trickNo === 5;

  if (s.trick.length === 0) {
    // Leading. Partner may lead the called suit only with the ace itself.
    if (seat === s.partner && !s.calledSuitLed) {
      return hand.filter(c => isTrump(c) || c[1] !== s.calledSuit || c === s.calledAce);
    }
    return [...hand];
  }

  const led = effSuit(s.trick[0]);
  const follow = hand.filter(c => effSuit(c) === led);
  if (follow.length) {
    // Called suit led: partner must surrender the ace.
    if (led === s.calledSuit && seat === s.partner && !s.aceFlipped && follow.includes(s.calledAce)) {
      return [s.calledAce];
    }
    return follow;
  }

  // Cannot follow: anything goes, except protected called-suit cards.
  let legal = [...hand];
  if (!s.calledSuitLed && !lastTrick && s.calledSuit) {
    if (seat === s.partner) legal = legal.filter(c => c !== s.calledAce);
    if (seat === s.picker) {
      const keptCall = hand.filter(c => !isTrump(c) && c[1] === s.calledSuit);
      if (keptCall.length === 1) legal = legal.filter(c => c !== keptCall[0]);
    }
  }
  return legal.length ? legal : [...hand]; // never strand a player with no move
}

export const currentTurn = s => (s.leader + s.trick.length) % 5;

export function playCard(s, seat, card) {
  const legal = legalMoves(s, seat);
  if (!legal.includes(card)) throw new Error('illegal card ' + card);
  s.hands[seat] = s.hands[seat].filter(c => c !== card);
  s.trick.push(card);
  s.trickSeats.push(seat);
  if (s.trick.length === 1 && effSuit(card) === s.calledSuit) s.calledSuitLed = true;
  if (card === s.calledAce) s.aceFlipped = true;
  if (s.trick.length === 5) {
    const w = s.trickSeats[trickWinner(s.trick)];
    s.taken[w].push(...s.trick);
    s.history.push({ cards: [...s.trick], seats: [...s.trickSeats], winner: w });
    s.lastTrickWinner = w;
    s.trick = [];
    s.trickSeats = [];
    s.leader = w;
    s.trickNo++;
    if (s.trickNo === 6) { s.phase = 'done'; s.result = score(s); }
  }
  return s;
}

// Game points per hand. Picker side needs 61; defenders win ties at 60.
export function score(s) {
  const side = seat => (seat === s.picker || seat === s.partner) ? 'P' : 'D';
  const pickerPts = handPoints(s.buried) +
    s.taken.reduce((n, pile, seat) => n + (side(seat) === 'P' ? handPoints(pile) : 0), 0);
  const defPts = 120 - pickerPts;
  const pickerTricks = s.taken.reduce((n, pile, seat) => n + (side(seat) === 'P' ? pile.length / 5 : 0), 0);
  const defTricks = 6 - pickerTricks;
  const win = pickerPts >= 61;
  let stake = 1;
  if (win) { if (defTricks === 0) stake = 3; else if (defPts < 31) stake = 2; }
  else { if (pickerTricks === 0) stake = 3; else if (pickerPts < 31) stake = 2; }
  const sign = win ? 1 : -1;
  const delta = [0, 0, 0, 0, 0];
  for (let seat = 0; seat < 5; seat++) {
    if (seat === s.picker) delta[seat] = sign * stake * (s.alone ? 4 : 2);
    else if (seat === s.partner) delta[seat] = sign * stake;
    else delta[seat] = -sign * stake;
  }
  return { pickerPts, defPts, win, stake, delta };
}
