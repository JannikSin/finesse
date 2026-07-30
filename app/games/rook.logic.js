// Pure rook logic: deck, deal, counters, bid bands, nest/bury evaluation.
// HOUSE RULES: the Rook bird is worth 25 (same as one full color's counters,
// 125 total in play), plays as the LOWEST trump, bidding opens at 50 by 5s,
// and the winner names trump BEFORE looking at the nest. 4 or 6 players,
// alternating seats as partners. ZERO imports.
export const COLORS = ['R', 'Y', 'G', 'B'];
export const COLOR_NAME = { R: 'red', Y: 'yellow', G: 'green', B: 'black' };
export const DECK = [...COLORS.flatMap(c => Array.from({ length: 10 }, (_, i) => c + (i + 5))), 'BIRD'];

export const pointsOf = c =>
  c === 'BIRD' ? 25 : c.slice(1) === '5' ? 5 : c.slice(1) === '10' || c.slice(1) === '14' ? 10 : 0;

export const sortRook = h => [...h].sort((a, b) => {
  if (a === 'BIRD') return -1;
  if (b === 'BIRD') return 1;
  return COLORS.indexOf(a[0]) - COLORS.indexOf(b[0]) || Number(b.slice(1)) - Number(a.slice(1));
});

export function deal(rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return { hands: [0, 1, 2, 3].map(i => sortRook(d.slice(i * 9, i * 9 + 9))), kitty: d.slice(36) };
}

// Bid bands from hand shape. The bird still lengthens your trump, but as the
// LOWEST trump it is 25 points you must protect, not a control card.
export function evalBid(hand) {
  const bird = hand.includes('BIRD');
  const byColor = COLORS.map(col => hand.filter(c => c !== 'BIRD' && c[0] === col));
  const best = byColor.reduce((a, b) => (b.length > a.length ? b : a));
  const L = best.length + (bird ? 1 : 0);
  const highs = best.filter(c => Number(c.slice(1)) >= 13).length;
  const pts = hand.reduce((n, c) => n + pointsOf(c), 0);
  const strength = L * 10 + (bird ? 8 : 0) + highs * 5 + pts / 5;
  const bid = strength >= 80 ? 115 : strength >= 70 ? 100 : strength >= 60 ? 85 : strength >= 50 ? 70 : strength >= 41 ? 55 : 0;
  const reasons = [
    `Longest color: ${best.length} ${COLOR_NAME[best[0]?.[0]] || ''}${bird ? ' plus the Rook (your lowest trump, and 25 points to bring home)' : ''}: ${L} trump if you name it.`,
    `${highs} of the 13/14 top cards in that color, ${pts} counter points in hand (125 in play).`,
  ];
  if (bid === 0) reasons.push('Under five likely trump: let the others fight for the nest and play for the set.');
  else if (bid >= 100) reasons.push('Long trump with the top cards: bid to win the nest. Remember you name trump BEFORE seeing it.');
  else reasons.push('Enough to compete for the nest, not enough to chase a big number: partner strength must cover the rest.');
  return { bid, strength, reasons };
}

// ---- the nest / bury -------------------------------------------------------
// You named trump blind, then picked up 5. Now keep 9 of 14.
export const isTrumpRook = (c, trump) => c === 'BIRD' || c[0] === trump;

export function bestTrumpColor(hand) {
  return COLORS.map(col => [col, hand.filter(c => c !== 'BIRD' && c[0] === col).length])
    .sort((a, b) => b[1] - a[1])[0][0];
}

// Book bury: never bury trump (the bird included), empty the shortest off
// colors to build voids, keep protected counters, shed strays.
export function evalNest(all14, trump) {
  const keepScore = c => {
    if (isTrumpRook(c, trump)) return 1000;
    const colorLen = all14.filter(x => !isTrumpRook(x, trump) && x[0] === c[0]).length;
    return colorLen * 6 + pointsOf(c) * 1.2 + Number(c.slice(1)) / 10;
  };
  const ranked = [...all14].sort((a, b) => keepScore(a) - keepScore(b));
  const bury = ranked.slice(0, 5);
  const kept = all14.filter(c => !bury.includes(c));
  const reasons = [];
  const voided = COLORS.filter(col => col !== trump &&
    all14.some(c => !isTrumpRook(c, trump) && c[0] === col) &&
    !kept.some(c => !isTrumpRook(c, trump) && c[0] === col));
  reasons.push('Keep every trump, the Rook first of all: as your lowest trump it is 25 points that must ride home under protection.');
  if (voided.length) reasons.push(`Bury toward voids: emptying ${voided.map(v => COLOR_NAME[v]).join(' and ')} lets you trump those leads immediately.`);
  const buriedPts = bury.reduce((n, c) => n + pointsOf(c), 0);
  reasons.push(buriedPts > 0
    ? `${buriedPts} counter points go down: the nest rides to whoever wins the last trick, so plan to win it.`
    : 'No counters buried: every point stays where your trump can defend it.');
  return { bury, reasons };
}

export function gradeNest(all14, trump, picks) {
  const book = evalNest(all14, trump);
  const nonTrumpCount = all14.filter(c => !isTrumpRook(c, trump)).length;
  const buriedTrump = picks.filter(c => isTrumpRook(c, trump));
  const overlap = picks.filter(c => book.bury.includes(c)).length;
  const violations = [];
  if (buriedTrump.length && nonTrumpCount >= 5) {
    violations.push(`Never bury trump: ${buriedTrump.join(', ')} ${buriedTrump.length === 1 ? 'is' : 'are'} trump${buriedTrump.includes('BIRD') ? ', and the Rook is 25 points besides' : ''}.`);
  }
  const right = violations.length === 0 && overlap >= 4;
  return { right, overlap, violations, book };
}
