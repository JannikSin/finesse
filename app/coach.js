// Strategy layer: pick/pass verdicts, bury suggestions, lead grading, bot play.
// Criteria distilled from sheepshead.org, playsheepshead.org, sheepsheadrules.com
// (Wergin-school 5-handed guidelines). ZERO imports except engine.

import {
  FAIL_SUITS, isTrump, suitOf, effSuit, points, handPoints, trumpPower,
  legalMoves, currentTurn, trickWinner, beats, callableSuits, sortHand,
} from './engine.js';

const trumps = h => h.filter(isTrump);
const queens = h => h.filter(c => c[0] === 'Q');
const failsOf = (h, su) => h.filter(c => !isTrump(c) && c[1] === su);
const buryFodder = h => h.filter(c => !isTrump(c) && (c[0] === 'A' || c[0] === 'T'));

// seatPos: 0 = first to pick (left of dealer) ... 4 = dealer (last, leaster looms).
export function evalPick(hand, seatPos) {
  const t = trumps(hand).length;
  const q = queens(hand).length;
  const hasQC = hand.includes('QC'), hasQS = hand.includes('QS');
  const bp = buryFodder(hand).length;
  const reasons = [];
  reasons.push(`${t} trump, ${q} queen${q === 1 ? '' : 's'}, ${bp} buryable point card${bp === 1 ? '' : 's'} (fail A/10).`);

  let verdict = 'pass';
  if (t >= 5) { verdict = 'pick'; reasons.push('Any 5 trump is a pick.'); }
  else if (q >= 2 && t >= 3) { verdict = 'pick'; reasons.push('Two queens plus another trump is a pick.'); }
  else if (q >= 1 && t >= 4) { verdict = 'pick'; reasons.push('A queen plus three more trump is a pick.'); }
  else if (hasQC && hasQS && (seatPos === 0 || seatPos === 4)) {
    verdict = 'pick';
    reasons.push('The two black queens are a pick when you lead or sit on the end: you control the first trump leads.');
  } else if (q >= 1 && t === 3 && bp >= 2) {
    verdict = 'either';
    reasons.push('A queen with two other trump and points to bury is borderline: defensible either way.');
  } else if (t === 4 && seatPos === 4) {
    verdict = 'either';
    reasons.push('Four trump on the end is thin, but passing hands the table a leaster. Defensible either way.');
  } else {
    if (t <= 2) reasons.push('Too little trump: you cannot pull trump or control the hand.');
    else if (q === 0) reasons.push('No queens: without high trump you cannot take control even with length.');
    else reasons.push('A lone queen with thin support gets outdrawn: pass and play defense.');
  }
  if (verdict === 'pick' && seatPos === 0) reasons.push('Leading seat helps: you set the pace with trump from trick one.');
  if (verdict === 'pass' && seatPos === 4) reasons.push('On the end you may stretch a notch below book, but this hand is below even that.');
  return { verdict, reasons, trump: t, queens: q, buryable: bp };
}

// Given the 8-card post-blind hand, choose 2 to bury and a suit to call.
export function suggestBury(hand8) {
  const reasons = [];
  // Call the shortest fail suit we hold without its ace; prefer retaining one card.
  const options = callableSuits(hand8, []);
  let calledSuit = null;
  if (options.length) {
    calledSuit = options.sort((a, b) => failsOf(hand8, a).length - failsOf(hand8, b).length)[0];
    reasons.push(`Call ${calledSuit === 'C' ? 'clubs' : calledSuit === 'S' ? 'spades' : 'hearts'}: your shortest callable suit, so the ace walks and you trump the re-lead.`);
  } else {
    reasons.push('No callable suit (you hold every fail ace or no off-ace fail card): go alone.');
  }
  const keep = calledSuit ? failsOf(hand8, calledSuit).sort((a, b) => points(a) - points(b))[0] : null;
  // Bury the fattest fail cards we are allowed to lose; keep the hold card.
  const candidates = hand8
    .filter(c => !isTrump(c) && c !== keep)
    .sort((a, b) => points(b) - points(a) || failsOf(hand8, suitOf(a)).length - failsOf(hand8, suitOf(b)).length);
  const bury = candidates.slice(0, 2);
  while (bury.length < 2) {
    // Nearly all trump: bury from the bottom of the trump ladder.
    const low = trumps(hand8).filter(c => !bury.includes(c)).sort((a, b) => trumpPower(b) - trumpPower(a))[0];
    bury.push(low);
    reasons.push('Short on fail: bury low trump rather than break your hold card.');
  }
  const pts = handPoints(bury);
  reasons.push(`Bury ${bury.join(' + ')}: ${pts} points straight into your count${pts >= 14 ? ', a fat bury' : ''}.`);
  const voided = FAIL_SUITS.filter(su => failsOf(hand8, su).length > 0 && failsOf(hand8, su).every(c => bury.includes(c)));
  if (voided.length) reasons.push('That voids a suit: you trump the first lead of it.');
  return { bury, calledSuit, reasons };
}

// ---- lead grading ----------------------------------------------------------
// Grade every card in hand for the opening lead, given the role.
// Tiers: best > good > okay > bad > terrible.
const TIERS = ['best', 'good', 'okay', 'bad', 'terrible'];

export function gradeLeads(hand, role, calledSuit) {
  const g = {};
  const hasTrump = trumps(hand).length > 0;
  for (const c of hand) {
    if (role === 'picker') {
      if (c === 'QC' || c === 'QS') g[c] = ['best', 'High queen: certain trick, pulls two rounds of trump value.'];
      else if (c[0] === 'Q' || c[0] === 'J') g[c] = ['good', 'Trump lead: right idea. Highest first keeps you in control.'];
      else if (isTrump(c)) g[c] = ['good', 'Trump lead is correct, though leading low trump can gift a cheap trick.'];
      else if (calledSuit && c[1] === calledSuit) g[c] = ['okay', 'Flushing the called ace is a real tactic, but usually save it until trump is drawn.'];
      else g[c] = ['bad', 'Picker leads trump. A fail lead hands tempo to the defense.'];
    } else if (role === 'partner') {
      if (c === ('A' + calledSuit)) g[c] = ['terrible', 'Never lead the called ace: it announces you and wastes its walk.'];
      else if (isTrump(c)) g[c] = [c === 'QC' ? 'best' : 'good', 'Partner leads trump for the picker. Queen of clubs first is textbook.'];
      else if (!hasTrump && c[0] === 'A') g[c] = ['good', 'No trump to lead: a fail ace is the next best thing.'];
      else if (!hasTrump) g[c] = ['okay', 'No trump: lead your short suit and hunt a trumping chance.'];
      else g[c] = ['bad', 'You hold trump: lead it. Fail leads help the defense.'];
    } else { // defender
      if (calledSuit && c[1] === calledSuit && !isTrump(c)) g[c] = ['best', 'Lead the called suit: forces the ace out early and finds your partners.'];
      else if (!isTrump(c) && failsOf(hand, c[1]).length >= 3) g[c] = ['good', 'Long suit through the picker: someone behind you may trump in.'];
      else if (!isTrump(c) && c[0] === 'A') g[c] = ['okay', 'A fail ace can cash, but the called suit lead comes first.'];
      else if (!isTrump(c)) g[c] = ['okay', 'A neutral fail lead. Called suit or long suit is sharper.'];
      else g[c] = ['bad', 'Defenders do not lead trump into the picker: that does the picker\'s work.'];
    }
  }
  const bestTier = TIERS[Math.min(...hand.map(c => TIERS.indexOf(g[c][0])))];
  return { grades: g, bestTier };
}

// ---- bot policy ------------------------------------------------------------
// ponytail: bots read true team membership from state before the ace is flipped;
// belief-tracking inference if the cheat ever shows at the table.

const sideOf = (s, seat) => (seat === s.picker || seat === s.partner) ? 'P' : 'D';

export function botPickDecision(s, seat) {
  const seatPos = (seat - (s.dealer + 1) + 5) % 5;
  const v = evalPick(s.hands[seat], seatPos).verdict;
  return v === 'pick' || (v === 'either' && seatPos === 4);
}

export function botPlay(s, seat) {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return legal[0];
  const me = sideOf(s, seat);

  if (s.trick.length === 0) {
    const role = seat === s.picker ? 'picker' : seat === s.partner ? 'partner' : 'defender';
    const { grades } = gradeLeads(legal, role, s.calledSuit);
    const ranked = [...legal].sort((a, b) => TIERS.indexOf(grades[a][0]) - TIERS.indexOf(grades[b][0]) ||
      (isTrump(a) && isTrump(b) ? trumpPower(a) - trumpPower(b) : points(a) - points(b)));
    return ranked[0];
  }

  const winIdx = trickWinner(s.trick);
  const winnerSeat = s.trickSeats[winIdx];
  const winCard = s.trick[winIdx];
  const mates = sideOf(s, winnerSeat) === me;
  const last = s.trick.length === 4;
  const winners = legal.filter(c => beats(winCard, c));
  const cheapestWin = winners.sort((a, b) => {
    const at = isTrump(a), bt = isTrump(b);
    if (at !== bt) return at ? 1 : -1; // win with fail rank before spending trump
    return at ? trumpPower(b) - trumpPower(a) : points(a) - points(b);
  })[0];
  const trickPts = handPoints(s.trick);

  // Teammate holds it and it is safe (or we are last): schmear.
  const safe = mates && (last || (isTrump(winCard) && trumpPower(winCard) <= 5));
  if (safe) return [...legal].sort((a, b) => points(b) - points(a) || trumpPower(b) - trumpPower(a))[0];
  if (mates && !winners.length) return dump(legal);
  if (winners.length && (last ? trickPts + points(cheapestWin) >= 4 : trickPts >= 10 || me === 'P' || !mates)) {
    return cheapestWin;
  }
  return dump(legal);
}

// Lowest points first; among zero-pointers throw from short suits, keep trump.
function dump(cards) {
  return [...cards].sort((a, b) =>
    points(a) - points(b) ||
    (isTrump(a) ? 1 : 0) - (isTrump(b) ? 1 : 0) ||
    trumpPower(b) - trumpPower(a))[0];
}

export { sortHand, currentTurn };
