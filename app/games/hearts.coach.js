// Hearts strategy: pass-three valuation, bot pass and play. Standard book
// guidance: dump bare high spades, keep QS guarded, ship high hearts, build
// voids, never waste a pass on low cards.
import { RANKS, rankIdx, isPoint, legalMoves, currentTurn } from './hearts.engine.js';

const suitLen = (h, su) => h.filter(c => c[1] === su).length;
const lowSpades = h => h.filter(c => c[1] === 'S' && rankIdx(c) < rankIdx('QS'));

// Score how much we want to PASS each card, with reasons. Higher = pass it.
export function passValue(hand, c) {
  const spades = suitLen(hand, 'S');
  const guards = lowSpades(hand).length;
  const len = suitLen(hand, c[1]);
  if (c === 'QS') {
    return guards >= 3 ? [2, 'Q♠ with three guards is a weapon: keep it and pick your victim.']
      : [14, 'A short queen of spades is a 13-point time bomb: ship it.'];
  }
  if ((c === 'AS' || c === 'KS') && spades <= 3) return [12, 'A high spade above the queen with no length gets forced to eat her: pass it.'];
  if (c === 'AS' || c === 'KS') return [3, 'High spade, but you have the length to survive spade leads.'];
  if (c[1] === 'S') return [-2, 'Low spades guard you against the queen: never pass them.'];
  if (c[1] === 'H') {
    const r = rankIdx(c);
    if (r >= rankIdx('QH')) return [9 + (r - rankIdx('QH')), 'High hearts win hearts tricks: exactly what you do not want.'];
    if (r <= rankIdx('5H')) return [-1, 'Low hearts are your escape cards: keep them.'];
    return [3, 'A middling heart: passable, not urgent.'];
  }
  // clubs and diamonds
  const r = rankIdx(c);
  if (len <= 2 && r >= rankIdx('J' + c[1])) return [8 + (3 - len), 'High card in a short suit: pass it and build a void.'];
  if (len <= 2) return [5 + (3 - len), 'Short suit: passing toward a void beats keeping a stray.'];
  if (r >= rankIdx('K' + c[1])) return [5, 'A high card that will win a trick late, when the hearts come out.'];
  return [0, 'A safe middle card: passing it wastes the pass.'];
}

export function bestPass(hand) {
  return [...hand]
    .map(c => ({ c, v: passValue(hand, c)[0] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map(x => x.c);
}

export function botPass(hand) { return bestPass(hand); }

export function botPlay(s, seat) {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return legal[0];
  const hand = s.hands[seat];
  const high = cards => [...cards].sort((a, b) => rankIdx(b) - rankIdx(a))[0];
  const low = cards => [...cards].sort((a, b) => rankIdx(a) - rankIdx(b))[0];

  if (s.trick.length === 0) {
    // Flush the queen with low spades if we don't hold her; otherwise lead low.
    const qsOut = !s.taken.flat().includes('QS') && !hand.includes('QS');
    const spadeGuards = legal.filter(c => c[1] === 'S' && rankIdx(c) < rankIdx('QS'));
    if (qsOut && spadeGuards.length) return low(spadeGuards);
    const safe = legal.filter(c => c[1] !== 'H' && c !== 'QS' && !(c[1] === 'S' && rankIdx(c) > rankIdx('QS')));
    return low(safe.length ? safe : legal);
  }

  const led = s.trick[0][1];
  const follow = legal.filter(c => c[1] === led);
  if (follow.length) {
    const winIdx = s.trick.reduce((w, c, i) => (c[1] === led && rankIdx(c) > rankIdx(s.trick[w]) ? i : w), 0);
    const winRank = rankIdx(s.trick[winIdx]);
    const under = follow.filter(c => rankIdx(c) < winRank);
    const last = s.trick.length === 3;
    const trickPts = s.trick.reduce((n, c) => n + (c === 'QS' ? 13 : c[1] === 'H' ? 1 : 0), 0);
    if (under.length) return high(under); // duck as high as possible
    if (last && trickPts === 0) return high(follow.filter(c => c !== 'QS')) || high(follow);
    return low(follow.filter(c => c !== 'QS')) || low(follow);
  }
  // Void: dump the queen, then bare high spades, then high hearts, then highest.
  if (legal.includes('QS')) return 'QS';
  const highSpade = legal.filter(c => c === 'AS' || c === 'KS');
  if (highSpade.length && !s.taken.flat().includes('QS') && !hand.includes('QS')) return high(highSpade);
  const hearts = legal.filter(c => c[1] === 'H');
  if (hearts.length) return high(hearts);
  return high(legal);
}

export { currentTurn };
