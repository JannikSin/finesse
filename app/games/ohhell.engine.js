// Pure oh hell rules: 4 players, rounds deal down 7..1, turned trump,
// dealer hook (bids may not sum to the tricks), exact-or-bust scoring
// (10 + bid, matching tally's "exact10" default). ZERO imports.

export const SUITS = ['C', 'D', 'S', 'H'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const DECK = SUITS.flatMap(s => RANKS.map(r => r + s));
export const rankIdx = c => RANKS.indexOf(c[0]);
export const SEQ = [7, 6, 5, 4, 3, 2, 1];

export function sortHand(h, trump) {
  return [...h].sort((a, b) => {
    const at = trump && a[1] === trump, bt = trump && b[1] === trump;
    if (at !== bt) return at ? -1 : 1;
    return SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]) || rankIdx(a) - rankIdx(b);
  });
}

export function deal(n, rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  const trumpCard = d[n * 4];
  return {
    hands: [0, 1, 2, 3].map(i => sortHand(d.slice(i * n, i * n + n), trumpCard[1])),
    trumpCard,
    trump: trumpCard[1],
  };
}

export function newRound(roundNo, dealer, rng = Math.random) {
  const n = SEQ[roundNo];
  const { hands, trumpCard, trump } = deal(n, rng);
  return {
    phase: 'bid', roundNo, n, dealer, hands, trumpCard, trump,
    turn: (dealer + 1) % 4, bids: [null, null, null, null],
    leader: (dealer + 1) % 4, trick: [], trickSeats: [],
    tricks: [0, 0, 0, 0], trickNo: 0,
  };
}

export function forbiddenBid(s, seat) {
  if (seat !== s.dealer) return null;
  const others = s.bids.reduce((a, b, i) => (i === seat || b === null ? a : a + b), 0);
  const forbidden = s.n - others;
  return forbidden >= 0 && forbidden <= s.n ? forbidden : null;
}

export function submitBid(s, seat, bid) {
  if (s.phase !== 'bid' || s.turn !== seat) throw new Error('not your bid');
  if (bid < 0 || bid > s.n) throw new Error('bid out of range');
  if (bid === forbiddenBid(s, seat)) throw new Error('dealer hook: bids may not even out');
  s.bids[seat] = bid;
  if (s.bids.every(b => b !== null)) s.phase = 'play';
  else s.turn = (s.turn + 1) % 4;
  return s;
}

export const currentTurn = s => (s.leader + s.trick.length) % 4;

export function legalMoves(s, seat) {
  if (s.phase !== 'play' || currentTurn(s) !== seat) return [];
  const hand = s.hands[seat];
  if (s.trick.length === 0) return [...hand];
  const led = s.trick[0][1];
  const follow = hand.filter(c => c[1] === led);
  return follow.length ? follow : [...hand];
}

export function playCard(s, seat, card) {
  if (!legalMoves(s, seat).includes(card)) throw new Error('illegal card ' + card);
  s.hands[seat] = s.hands[seat].filter(c => c !== card);
  s.trick.push(card);
  s.trickSeats.push(seat);
  if (s.trick.length === 4) {
    const led = s.trick[0][1];
    let w = 0;
    for (let i = 1; i < 4; i++) {
      const better =
        (s.trick[i][1] === s.trump && s.trick[w][1] !== s.trump) ||
        (s.trick[i][1] === s.trick[w][1] && rankIdx(s.trick[i]) > rankIdx(s.trick[w]));
      if (better) w = i;
    }
    const winner = s.trickSeats[w];
    s.tricks[winner]++;
    s.lastTrick = { cards: [...s.trick], seats: [...s.trickSeats], winner };
    s.trick = [];
    s.trickSeats = [];
    s.leader = winner;
    s.trickNo++;
    if (s.trickNo === s.n) { s.phase = 'done'; s.result = score(s); }
  }
  return s;
}

// tally's "exact10": 10 + bid if exact, else 0.
export function score(s) {
  return { pts: s.bids.map((bid, i) => (s.tricks[i] === bid ? 10 + bid : 0)) };
}
