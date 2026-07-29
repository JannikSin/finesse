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

export function botBid(s, seat, level = 'solid') {
  let bid;
  if (level === 'novice') {
    // counts every trump and ace as a whole trick: chronic overbidder
    const hand = s.hands[seat];
    bid = hand.filter(c => c[1] === s.trump || c[0] === 'A').length;
  } else {
    bid = estimateTricks(s.hands[seat], s.trump).bid;
    if (level === 'expert') {
      // read the public bid gap: scarce tricks → shade down, surplus → up
      const placed = s.bids.filter(b => b !== null);
      if (placed.length >= 2) {
        const gap = s.n - placed.reduce((a, b) => a + b, 0);
        if (gap <= 0 && bid > 0) bid -= 1;
        else if (gap > bid + 2) bid += 1;
      }
    }
  }
  bid = Math.min(Math.max(bid, 0), s.n);
  const forbidden = forbiddenBid(s, seat);
  if (bid === forbidden) bid = bid > 0 ? bid - 1 : bid + 1;
  return Math.min(Math.max(bid, 0), s.n);
}

export function botPlay(s, seat, level = 'solid') {
  return adviseMove(s, seat, level).card;
}

export function adviseMove(s, seat, level = 'expert') {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return { card: legal[0], why: 'Forced: your only legal card.' };
  const need = s.bids[seat] > s.tricks[seat];
  const high = cards => [...cards].sort((a, b) => rankIdx(b) - rankIdx(a))[0];
  const low = cards => [...cards].sort((a, b) => rankIdx(a) - rankIdx(b))[0];

  if (level === 'novice') {
    if (s.trick.length === 0) return { card: high(legal), why: 'Novice habit: lead big.' };
    const led0 = s.trick[0][1];
    const f = legal.filter(c => c[1] === led0);
    return { card: f.length ? high(f) : high(legal), why: 'Novice habit: play high whether the bid needs it or not.' };
  }

  if (s.trick.length === 0) {
    return need
      ? { card: high(legal), why: `You still need ${s.bids[seat] - s.tricks[seat]}: lead strength while you control the trick.` }
      : { card: low(legal), why: 'Bid made: lead your smallest and let the overbidders fight.' };
  }

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
  if (need && winners.length) {
    return { card: low(winners), why: 'You need this trick: take it with the smallest card that wins.' };
  }
  if (!need && legal.some(c => !beatsWin(c))) {
    return { card: high(legal.filter(c => !beatsWin(c))), why: 'At your bid: duck high — shed the biggest card that still loses.' };
  }
  return {
    card: low(legal),
    why: need ? 'Cannot win this one: throw your smallest and wait for your tricks.'
      : 'Every card wins — the small one keeps future tricks smaller.',
  };
}
