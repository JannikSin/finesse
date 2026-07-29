// Pure rook logic: deck, deal, counters, bid bands. ZERO imports.
export const COLORS = ['R', 'Y', 'G', 'B'];
export const COLOR_NAME = { R: 'red', Y: 'yellow', G: 'green', B: 'black' };
export const DECK = [...COLORS.flatMap(c => Array.from({ length: 10 }, (_, i) => c + (i + 5))), 'BIRD'];

export const pointsOf = c =>
  c === 'BIRD' ? 20 : c.slice(1) === '5' ? 5 : c.slice(1) === '10' || c.slice(1) === '14' ? 10 : 0;

export function deal(rng = Math.random) {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  const sort = h => [...h].sort((a, b) => {
    if (a === 'BIRD') return -1;
    if (b === 'BIRD') return 1;
    return COLORS.indexOf(a[0]) - COLORS.indexOf(b[0]) || Number(b.slice(1)) - Number(a.slice(1));
  });
  return { hands: [0, 1, 2, 3].map(i => sort(d.slice(i * 9, i * 9 + 9))), kitty: d.slice(36) };
}

// Bid bands from hand shape: longest color, the bird, high cards, counters.
export function evalBid(hand) {
  const bird = hand.includes('BIRD');
  const byColor = COLORS.map(col => hand.filter(c => c !== 'BIRD' && c[0] === col));
  const best = byColor.reduce((a, b) => (b.length > a.length ? b : a));
  const L = best.length + (bird ? 1 : 0); // bird plays as a trump
  const highs = best.filter(c => Number(c.slice(1)) >= 13).length;
  const pts = hand.reduce((n, c) => n + pointsOf(c), 0);
  const strength = L * 10 + (bird ? 12 : 0) + highs * 5 + pts / 5;
  const bid = strength >= 78 ? 115 : strength >= 68 ? 105 : strength >= 58 ? 95 : strength >= 48 ? 85 : strength >= 41 ? 75 : 0;
  const reasons = [
    `Longest color: ${best.length} ${COLOR_NAME[best[0]?.[0]] || ''}${bird ? ' plus the Rook (it plays as your lowest trump)' : ''} → ${L} trump if you name it.`,
    `${highs} of the 13/14 top cards in that color, ${pts} counter points in hand.`,
  ];
  if (bid === 0) reasons.push('Under five likely trump: let the others fight for the kitty and play for the set.');
  else if (bid >= 105) reasons.push('Long trump with the top cards: bid to win the kitty, the discard makes this hand even stronger.');
  else reasons.push('Enough to compete for the kitty, not enough to chase a big number: partner strength must cover the rest.');
  return { bid, strength, reasons };
}
