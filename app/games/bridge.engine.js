// Pure contract bridge engine: 52 cards, auction (no doubles yet), play with
// dummy, duplicate scoring (non-vulnerable). Seats 0=S(you) 1=W 2=N 3=E;
// 0+2 vs 1+3. ZERO imports.

export const SUITS = ['C', 'D', 'H', 'S'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const DECK = SUITS.flatMap(s => RANKS.map(r => r + s));
export const STRAINS = ['C', 'D', 'H', 'S', 'N'];
export const rankIdx = c => RANKS.indexOf(c[0]);

const HCP = { A: 4, K: 3, Q: 2, J: 1 };
export const hcp = hand => hand.reduce((n, c) => n + (HCP[c[0]] || 0), 0);
export const suitCards = (hand, su) => hand.filter(c => c[1] === su);
export const shape = hand => SUITS.map(su => suitCards(hand, su).length);
export function isBalanced(hand) {
  const s = shape(hand).sort((a, b) => a - b);
  return s[0] >= 2 && s[1] >= 3; // no singleton/void, at most one doubleton
}
// length points: +1 per card beyond four in each suit
export const lengthPoints = hand => shape(hand).reduce((n, l) => n + Math.max(0, l - 4), 0);
export const totalPoints = hand => hcp(hand) + lengthPoints(hand);

export function sortHand(h) {
  return [...h].sort((a, b) => {
    const order = ['S', 'H', 'C', 'D']; // alternating colors for display
    if (a[1] !== b[1]) return order.indexOf(a[1]) - order.indexOf(b[1]);
    return rankIdx(b) - rankIdx(a);
  });
}

export function deal(rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return [0, 1, 2, 3].map(i => sortHand(d.slice(i * 13, i * 13 + 13)));
}

// ---- auction ---------------------------------------------------------------
// A call is 'P' or level+strain like '1N', '2C', '4S' (strain N = notrump).
export const bidRank = b => (Number(b[0]) - 1) * 5 + STRAINS.indexOf(b[1]);
export const isBid = call => call !== 'P';

export function newAuction(dealer, hands) {
  return { phase: 'auction', dealer, hands, turn: dealer, calls: [], contract: null };
}

export function legalCalls(a) {
  const last = [...a.calls].reverse().find(isBid);
  const calls = ['P'];
  for (let level = 1; level <= 7; level++) {
    for (const st of STRAINS) {
      const b = `${level}${st}`;
      if (!last || bidRank(b) > bidRank(last)) calls.push(b);
    }
  }
  return calls;
}

export function makeCall(a, seat, call) {
  if (a.phase !== 'auction' || a.turn !== seat) throw new Error('not your call');
  if (!legalCalls(a).includes(call)) throw new Error('illegal call ' + call);
  a.calls.push(call);
  a.turn = (a.turn + 1) % 4;
  const n = a.calls.length;
  const tail3 = n >= 3 && a.calls.slice(-3).every(c => c === 'P');
  if ((n === 4 && a.calls.every(c => c === 'P'))) { a.phase = 'passout'; return a; }
  if (tail3 && a.calls.some(isBid)) {
    const lastBidIdx = a.calls.map(isBid).lastIndexOf(true);
    const bid = a.calls[lastBidIdx];
    const bidderSeat = (a.dealer + lastBidIdx) % 4;
    const side = bidderSeat % 2;
    // declarer: first player of that side to name the final strain
    let declarer = bidderSeat;
    for (let i = 0; i < a.calls.length; i++) {
      const s = (a.dealer + i) % 4;
      if (s % 2 === side && isBid(a.calls[i]) && a.calls[i][1] === bid[1]) { declarer = s; break; }
    }
    a.contract = { bid, level: Number(bid[0]), strain: bid[1], declarer };
    a.phase = 'play';
    a.leader = (declarer + 1) % 4;
    a.trick = []; a.trickSeats = []; a.trickNo = 0;
    a.tricksDecl = 0;
    a.dummy = (declarer + 2) % 4;
  }
  return a;
}

// ---- play ------------------------------------------------------------------
export const currentTurn = a => (a.leader + a.trick.length) % 4;
export const dummyVisible = a => a.phase === 'play' && (a.trickNo > 0 || a.trick.length > 0);

export function legalMoves(a, seat) {
  if (a.phase !== 'play' || currentTurn(a) !== seat) return [];
  const hand = a.hands[seat];
  if (a.trick.length === 0) return [...hand];
  const led = a.trick[0][1];
  const follow = hand.filter(c => c[1] === led);
  return follow.length ? follow : [...hand];
}

export function playCard(a, seat, card) {
  if (!legalMoves(a, seat).includes(card)) throw new Error('illegal card ' + card);
  a.hands[seat] = a.hands[seat].filter(c => c !== card);
  a.trick.push(card);
  a.trickSeats.push(seat);
  if (a.trick.length === 4) {
    const trump = a.contract.strain === 'N' ? null : a.contract.strain;
    const led = a.trick[0][1];
    let w = 0;
    for (let i = 1; i < 4; i++) {
      const better =
        (trump && a.trick[i][1] === trump && a.trick[w][1] !== trump) ||
        (a.trick[i][1] === a.trick[w][1] && rankIdx(a.trick[i]) > rankIdx(a.trick[w]));
      if (better) w = i;
    }
    const winner = a.trickSeats[w];
    if (winner % 2 === a.contract.declarer % 2) a.tricksDecl++;
    a.lastTrick = { cards: [...a.trick], seats: [...a.trickSeats], winner };
    a.trick = []; a.trickSeats = [];
    a.leader = winner;
    a.trickNo++;
    if (a.trickNo === 13) { a.phase = 'done'; a.result = scoreContract(a.contract, a.tricksDecl); }
  }
  return a;
}

// Duplicate scoring, non-vulnerable, undoubled.
// ponytail: vulnerability and doubles when the table mode grows a rubber.
export function scoreContract(contract, tricksTaken) {
  const need = 6 + contract.level;
  const made = tricksTaken >= need;
  if (!made) return { made, tricksTaken, score: -50 * (need - tricksTaken) };
  const per = contract.strain === 'C' || contract.strain === 'D' ? 20 : 30;
  let trickScore = contract.level * per;
  if (contract.strain === 'N') trickScore += 10;
  let score = trickScore + (trickScore >= 100 ? 300 : 50);
  if (contract.level === 6) score += 500;
  if (contract.level === 7) score += 1000;
  score += (tricksTaken - need) * per;
  return { made, tricksTaken, score, game: trickScore >= 100 };
}
