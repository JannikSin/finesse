// Pure hearts rules: 4 players, pass 3 (left/right/across/hold), 2♣ opens,
// no points on trick one, hearts must be broken, queen of spades 13,
// shoot the moon. ZERO imports.

export const SUITS = ['C', 'D', 'S', 'H'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const DECK = SUITS.flatMap(s => RANKS.map(r => r + s));
export const rankIdx = c => RANKS.indexOf(c[0]);
export const isPoint = c => c[1] === 'H' || c === 'QS';
export const pointsOf = c => (c === 'QS' ? 13 : c[1] === 'H' ? 1 : 0);
export const PASS_CYCLE = ['left', 'right', 'across', 'hold'];

export function sortHand(h) {
  return [...h].sort((a, b) =>
    SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]) || rankIdx(a) - rankIdx(b));
}

export function deal(rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return [0, 1, 2, 3].map(i => sortHand(d.slice(i * 13, i * 13 + 13)));
}

export function newHand(handNo, rng = Math.random) {
  return {
    phase: PASS_CYCLE[handNo % 4] === 'hold' ? 'play' : 'pass',
    passDir: PASS_CYCLE[handNo % 4],
    hands: deal(rng),
    passed: [null, null, null, null],
    heartsBroken: false,
    leader: null, trick: [], trickSeats: [], trickNo: 0,
    taken: [[], [], [], []],
  };
}

const PASS_OFFSET = { left: 1, right: 3, across: 2 };

export function submitPass(s, seat, three) {
  if (s.phase !== 'pass') throw new Error('not passing');
  if (three.length !== 3 || !three.every(c => s.hands[seat].includes(c))) throw new Error('bad pass');
  s.passed[seat] = three;
  if (s.passed.every(Boolean)) {
    const off = PASS_OFFSET[s.passDir];
    const incoming = [0, 1, 2, 3].map(to => s.passed[(to - off + 4) % 4]);
    s.hands = s.hands.map((h, i) => sortHand([...h.filter(c => !s.passed[i].includes(c)), ...incoming[i]]));
    s.phase = 'play';
  }
  return s;
}

export function startPlay(s) {
  s.leader = s.hands.findIndex(h => h.includes('2C'));
  return s;
}

export const currentTurn = s => (s.leader + s.trick.length) % 4;

export function legalMoves(s, seat) {
  if (s.phase !== 'play' || currentTurn(s) !== seat) return [];
  const hand = s.hands[seat];
  if (s.trick.length === 0) {
    if (s.trickNo === 0) return ['2C'];
    if (!s.heartsBroken) {
      const nonHearts = hand.filter(c => c[1] !== 'H');
      if (nonHearts.length) return nonHearts;
    }
    return [...hand];
  }
  const led = s.trick[0][1];
  const follow = hand.filter(c => c[1] === led);
  if (follow.length) return follow;
  if (s.trickNo === 0) {
    const clean = hand.filter(c => !isPoint(c));
    if (clean.length) return clean;
  }
  return [...hand];
}

export function playCard(s, seat, card) {
  if (s.leader === null) throw new Error('call startPlay first');
  if (!legalMoves(s, seat).includes(card)) throw new Error('illegal card ' + card);
  s.hands[seat] = s.hands[seat].filter(c => c !== card);
  s.trick.push(card);
  s.trickSeats.push(seat);
  if (card[1] === 'H') s.heartsBroken = true;
  if (s.trick.length === 4) {
    const led = s.trick[0][1];
    let w = 0;
    for (let i = 1; i < 4; i++) {
      if (s.trick[i][1] === led && rankIdx(s.trick[i]) > rankIdx(s.trick[w])) w = i;
    }
    const winner = s.trickSeats[w];
    s.taken[winner].push(...s.trick);
    s.lastTrick = { cards: [...s.trick], seats: [...s.trickSeats], winner };
    s.trick = [];
    s.trickSeats = [];
    s.leader = winner;
    s.trickNo++;
    if (s.trickNo === 13) { s.phase = 'done'; s.result = score(s); }
  }
  return s;
}

export function score(s) {
  const raw = s.taken.map(pile => pile.reduce((n, c) => n + pointsOf(c), 0));
  const shooter = raw.findIndex(p => p === 26);
  const delta = shooter >= 0 ? raw.map((_, i) => (i === shooter ? 0 : 26)) : raw;
  return { raw, shooter, delta };
}
