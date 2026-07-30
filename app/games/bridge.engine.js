// Pure contract bridge engine: 52 cards, auction with doubles/redoubles, play
// with dummy, full duplicate scoring (doubled, redoubled, vulnerability).
// Seats 0=S(you) 1=W 2=N 3=E; 0+2 (NS) vs 1+3 (EW). ZERO imports.

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
// A call is 'P', 'X' (double), 'XX' (redouble), or level+strain like '1N',
// '2C', '4S' (strain N = notrump).
export const bidRank = b => (Number(b[0]) - 1) * 5 + STRAINS.indexOf(b[1]);
export const isBid = call => call !== 'P' && call !== 'X' && call !== 'XX';

// vul: 'none' | 'ns' | 'ew' | 'both'. Duplicate-style rotation: the offset
// term breaks the dealer/vul lockstep so every dealer sees every vulnerability
// (the standard 16-board table).
export const VULS = ['none', 'ns', 'ew', 'both'];
export const vulForBoard = n => VULS[(n + Math.floor(n / 4)) % 4];
export const sideVul = (vul, seat) =>
  vul === 'both' || (seat % 2 === 0 ? vul === 'ns' : vul === 'ew');

export function newAuction(dealer, hands, vul = 'none') {
  return { phase: 'auction', dealer, hands, vul, turn: dealer, calls: [], contract: null };
}

// The live state of the auction tail: last bid, who made it, and the current
// double level on it (0 plain, 1 doubled, 2 redoubled).
export function auctionState(a) {
  let lastBidIdx = -1, dbl = 0;
  a.calls.forEach((c, i) => {
    if (isBid(c)) { lastBidIdx = i; dbl = 0; }
    else if (c === 'X') dbl = 1;
    else if (c === 'XX') dbl = 2;
  });
  if (lastBidIdx < 0) return { bid: null, bidderSeat: null, dbl: 0 };
  return { bid: a.calls[lastBidIdx], bidderSeat: (a.dealer + lastBidIdx) % 4, dbl };
}

export function legalCalls(a) {
  const { bid, bidderSeat, dbl } = auctionState(a);
  const calls = ['P'];
  if (bid) {
    const mySide = a.turn % 2, theirBid = bidderSeat % 2 !== mySide;
    if (dbl === 0 && theirBid) calls.push('X');
    if (dbl === 1 && !theirBid) calls.push('XX');
  }
  for (let level = 1; level <= 7; level++) {
    for (const st of STRAINS) {
      const b = `${level}${st}`;
      if (!bid || bidRank(b) > bidRank(bid)) calls.push(b);
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
    const { bid, bidderSeat, dbl } = auctionState(a);
    const side = bidderSeat % 2;
    // declarer: first player of that side to name the final strain
    let declarer = bidderSeat;
    for (let i = 0; i < a.calls.length; i++) {
      const s = (a.dealer + i) % 4;
      if (s % 2 === side && isBid(a.calls[i]) && a.calls[i][1] === bid[1]) { declarer = s; break; }
    }
    a.contract = { bid, level: Number(bid[0]), strain: bid[1], declarer, dbl, vul: sideVul(a.vul, declarer) };
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

// Full duplicate scoring: doubles, redoubles, vulnerability.
// contract.dbl: 0 plain, 1 doubled, 2 redoubled. contract.vul: declarer side.
export function scoreContract(contract, tricksTaken) {
  const need = 6 + contract.level;
  const made = tricksTaken >= need;
  const dbl = contract.dbl || 0;
  const vul = !!contract.vul;
  if (!made) {
    const down = need - tricksTaken;
    let pen = 0;
    for (let i = 1; i <= down; i++) {
      if (!dbl) pen += vul ? 100 : 50;
      else pen += dbl * (vul ? (i === 1 ? 200 : 300) : (i === 1 ? 100 : i <= 3 ? 200 : 300));
    }
    return { made, tricksTaken, score: -pen };
  }
  const per = contract.strain === 'C' || contract.strain === 'D' ? 20 : 30;
  let trickScore = contract.level * per;
  if (contract.strain === 'N') trickScore += 10;
  if (dbl) trickScore *= dbl * 2; // doubled x2, redoubled x4
  let score = trickScore + (trickScore >= 100 ? (vul ? 500 : 300) : 50);
  if (contract.level === 6) score += vul ? 750 : 500;
  if (contract.level === 7) score += vul ? 1500 : 1000;
  if (dbl) score += 50 * dbl; // the insult
  const over = tricksTaken - need;
  score += over * (dbl ? dbl * (vul ? 200 : 100) : per);
  return { made, tricksTaken, score, game: trickScore >= 100 };
}
