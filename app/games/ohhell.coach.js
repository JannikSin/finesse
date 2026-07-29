// Oh hell strategy: bid estimation and bot play. Imports engine only.
import { forbiddenBid, legalMoves, rankIdx } from './ohhell.engine.js';

const GL = { C: '♣', S: '♠', H: '♥', D: '♦' };
const lbl = c => `${c[0] === 'T' ? '10' : c[0]}${GL[c[1]]}`;

export function estimateTricks(hand, trump) {
  let est = 0;
  const reasons = [];
  for (const c of hand) {
    const r = rankIdx(c);
    if (c[1] === trump) {
      const v = r >= rankIdx('Q' + trump) ? 1 : r >= rankIdx('8' + trump) ? 0.6 : 0.35;
      est += v;
      if (v === 1) reasons.push(`${lbl(c)} is a near-certain trump trick.`);
    } else if (c[0] === 'A') { est += 0.85; reasons.push(`${lbl(c)} usually cashes.`); }
    else if (c[0] === 'K') {
      const guarded = hand.some(x => x[1] === c[1] && x !== c);
      est += guarded ? 0.5 : 0.25;
    } else if (c[0] === 'Q') est += 0.2;
  }
  return { est, bid: Math.max(0, Math.round(est)), reasons };
}

export function botBid(s, seat) {
  let { bid } = estimateTricks(s.hands[seat], s.trump);
  bid = Math.min(bid, s.n);
  const forbidden = forbiddenBid(s, seat);
  if (bid === forbidden) bid = bid > 0 ? bid - 1 : bid + 1;
  return Math.min(Math.max(bid, 0), s.n);
}

export function botPlay(s, seat) {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return legal[0];
  const need = s.bids[seat] > s.tricks[seat];
  const high = cards => [...cards].sort((a, b) => rankIdx(b) - rankIdx(a))[0];
  const low = cards => [...cards].sort((a, b) => rankIdx(a) - rankIdx(b))[0];

  if (s.trick.length === 0) return need ? high(legal) : low(legal);

  const winIdx = s.trick.reduce((w, c, i) => {
    const better = (c[1] === s.trump && s.trick[w][1] !== s.trump) ||
      (c[1] === s.trick[w][1] && rankIdx(c) > rankIdx(s.trick[w]));
    return better ? i : w;
  }, 0);
  const winCard = s.trick[winIdx];
  const beatsWin = c =>
    (c[1] === s.trump && winCard[1] !== s.trump) ||
    (c[1] === winCard[1] && rankIdx(c) > rankIdx(winCard));
  const winners = legal.filter(beatsWin);
  if (need && winners.length) return low(winners);
  if (!need && legal.some(c => !beatsWin(c))) return high(legal.filter(c => !beatsWin(c)));
  return low(legal);
}
