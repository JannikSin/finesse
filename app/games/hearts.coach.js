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

export function botPass(hand, level = 'solid') {
  if (level === 'novice') {
    // ships the three biggest cards, guards and all: the classic beginner pass
    return [...hand].sort((a, b) => rankIdx(b) - rankIdx(a)).slice(0, 3);
  }
  return bestPass(hand);
}

const trickPoints = trick => trick.reduce((n, c) => n + (c === 'QS' ? 13 : c[1] === 'H' ? 1 : 0), 0);
const pilePoints = pile => pile.reduce((n, c) => n + (c === 'QS' ? 13 : c[1] === 'H' ? 1 : 0), 0);

// A shooter is loose: one OTHER player owns every point taken so far.
function moonThreat(s, seat) {
  const pts = s.taken.map(pilePoints);
  const total = pts.reduce((a, b) => a + b, 0);
  if (total < 6) return -1;
  const owner = pts.findIndex(p => p === total);
  return owner >= 0 && owner !== seat ? owner : -1;
}

export function botPlay(s, seat, level = 'solid') {
  return adviseMove(s, seat, level).card;
}

export function adviseMove(s, seat, level = 'expert') {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return { card: legal[0], why: 'Forced: your only legal card.' };
  const hand = s.hands[seat];
  const high = cards => [...cards].sort((a, b) => rankIdx(b) - rankIdx(a))[0];
  const low = cards => [...cards].sort((a, b) => rankIdx(a) - rankIdx(b))[0];

  if (level === 'novice') {
    if (s.trick.length === 0) return { card: high(legal), why: 'Novice habit: lead the biggest card.' };
    const led = s.trick[0][1];
    const follow = legal.filter(c => c[1] === led);
    if (follow.length) return { card: high(follow), why: 'Novice habit: play high, win tricks, eat points.' };
    if (legal.includes('QS')) return { card: 'QS', why: 'Void: at least the queen goes.' };
    return { card: high(legal), why: 'Void: throw a big one.' };
  }

  if (s.trick.length === 0) {
    const qsOut = !s.taken.flat().includes('QS') && !hand.includes('QS');
    const spadeGuards = legal.filter(c => c[1] === 'S' && rankIdx(c) < rankIdx('QS'));
    if (qsOut && spadeGuards.length) {
      return { card: low(spadeGuards), why: 'The queen is still out and you do not hold her: lead low spades, someone has to eat her.' };
    }
    const safe = legal.filter(c => c[1] !== 'H' && c !== 'QS' && !(c[1] === 'S' && rankIdx(c) > rankIdx('QS')));
    return { card: low(safe.length ? safe : legal), why: 'Lead low and stay off the hook: whoever wins is on lead into the pain.' };
  }

  const led = s.trick[0][1];
  const follow = legal.filter(c => c[1] === led);
  if (follow.length) {
    const winIdx = s.trick.reduce((w, c, i) => (c[1] === led && rankIdx(c) > rankIdx(s.trick[w]) ? i : w), 0);
    const winRank = rankIdx(s.trick[winIdx]);
    const under = follow.filter(c => rankIdx(c) < winRank);
    const last = s.trick.length === 3;
    const pts = trickPoints(s.trick);
    // Expert moon defense: spend a point to save 26.
    if (level === 'expert' && pts > 0) {
      const shooter = moonThreat(s, seat);
      if (shooter >= 0 && s.trickSeats[winIdx] === shooter) {
        const over = follow.filter(c => rankIdx(c) > winRank);
        if (over.length) {
          return { card: low(over), why: 'Moon alert: one player owns every point so far. Take this trick — one heart now beats 26 later.' };
        }
      }
    }
    if (under.length) return { card: high(under), why: 'Duck as high as you can: the biggest card that still loses is pure profit.' };
    if (last && pts === 0) {
      const c = high(follow.filter(x => x !== 'QS')) || high(follow);
      return { card: c, why: 'Last to a clean trick: win it with your biggest, that card was a liability anyway.' };
    }
    return { card: low(follow.filter(x => x !== 'QS')) || low(follow), why: 'You must win or risk it: play as small as possible.' };
  }
  if (legal.includes('QS')) return { card: 'QS', why: 'Void in the led suit: the queen leaves NOW. Thirteen points on someone else.' };
  const highSpade = legal.filter(c => c === 'AS' || c === 'KS');
  if (highSpade.length && !s.taken.flat().includes('QS') && !hand.includes('QS')) {
    return { card: high(highSpade), why: 'Queen-bait spades: shed the ace or king before a spade lead forces them to eat her.' };
  }
  const hearts = legal.filter(c => c[1] === 'H');
  if (hearts.length) return { card: high(hearts), why: 'Void: unload your highest heart onto their trick.' };
  return { card: high(legal), why: 'Void: throw your most dangerous card while it costs nothing.' };
}

export { currentTurn };
