// Strategy layer: pick/pass verdicts, bury suggestions, lead grading, and
// leveled bots (novice / solid / expert) that play from PUBLIC information
// only — no bot reads hidden team membership. Knowledge model:
//   - the partner bot knows both sides (it holds the called ace: legitimate);
//   - the picker knows the partner only once the ace flips; the EXPERT picker
//     infers a probable partner earlier from schmears and trump leads;
//   - defenders know the picker, know the partner once flipped, and otherwise
//     apply the book's "when in doubt, schmear" toward non-picker winners;
//     the EXPERT defender discounts seats showing partner tells.
// Criteria distilled from sheepshead.org (Ten Commandments), playsheepshead.org,
// sheepsheadrules.com. Imports engine only.

import {
  TRUMP, FAIL_SUITS, isTrump, suitOf, effSuit, points, handPoints, trumpPower,
  legalMoves, currentTurn, trickWinner, beats, callableSuits, sortHand,
} from './sheepshead.engine.js';

export const LEVELS = ['novice', 'solid', 'expert'];

const trumps = h => h.filter(isTrump);
const queens = h => h.filter(c => c[0] === 'Q');
const failsOf = (h, su) => h.filter(c => !isTrump(c) && c[1] === su);
const buryFodder = h => h.filter(c => !isTrump(c) && (c[0] === 'A' || c[0] === 'T'));

// ---- pick evaluation (the drill's coach: book-accurate) --------------------
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

// ---- bury ------------------------------------------------------------------
export function suggestBury(hand8) {
  const reasons = [];
  const options = callableSuits(hand8, []);
  let calledSuit = null;
  if (options.length) {
    calledSuit = options.sort((a, b) => failsOf(hand8, a).length - failsOf(hand8, b).length)[0];
    reasons.push(`Call ${calledSuit === 'C' ? 'clubs' : calledSuit === 'S' ? 'spades' : 'hearts'}: your shortest callable suit, so the ace walks and you trump the re-lead.`);
  } else {
    reasons.push('No callable suit (you hold every fail ace or no off-ace fail card): go alone.');
  }
  const keep = calledSuit ? failsOf(hand8, calledSuit).sort((a, b) => points(a) - points(b))[0] : null;
  const candidates = hand8
    .filter(c => !isTrump(c) && c !== keep)
    .sort((a, b) => points(b) - points(a) || failsOf(hand8, suitOf(a)).length - failsOf(hand8, suitOf(b)).length);
  const bury = candidates.slice(0, 2);
  while (bury.length < 2) {
    const low = trumps(hand8).filter(c => !bury.includes(c)).sort((a, b) => trumpPower(b) - trumpPower(a))[0];
    bury.push(low);
    reasons.push('Short on fail: bury low trump rather than break your hold card.');
  }
  const pts = handPoints(bury);
  const pretty = c => (c[0] === 'T' ? '10' : c[0]) + ({ C: '♣', S: '♠', H: '♥', D: '♦' }[c[1]]);
  reasons.push(`Bury ${bury.map(pretty).join(' + ')}: ${pts} points straight into your count${pts >= 14 ? ', a fat bury' : ''}.`);
  const voided = FAIL_SUITS.filter(su => failsOf(hand8, su).length > 0 && failsOf(hand8, su).every(c => bury.includes(c)));
  if (voided.length) reasons.push('That voids a suit: you trump the first lead of it.');
  return { bury, calledSuit, reasons };
}

// Novice bury: the classic beginner error — hoards the aces, buries junk.
export function noviceBury(hand8) {
  const options = callableSuits(hand8, []);
  const calledSuit = options[0] || null;
  const keep = calledSuit ? failsOf(hand8, calledSuit).sort((a, b) => points(a) - points(b))[0] : null;
  const bury = hand8
    .filter(c => !isTrump(c) && c !== keep)
    .sort((a, b) => points(a) - points(b)) // lowest points first: wrong on purpose
    .slice(0, 2);
  while (bury.length < 2) {
    const low = trumps(hand8).filter(c => !bury.includes(c)).sort((a, b) => trumpPower(b) - trumpPower(a))[0];
    bury.push(low);
  }
  return { bury, calledSuit };
}

// ---- lead grading ----------------------------------------------------------
const TIERS = ['best', 'good', 'okay', 'bad', 'terrible'];

// Every reason is checked against the actual hand: no advice ever references
// a card or suit the player does not hold.
export function gradeLeads(hand, role, calledSuit) {
  const g = {};
  const hasTrump = trumps(hand).length > 0;
  const hasCalled = calledSuit ? failsOf(hand, calledSuit).length > 0 : false;
  for (const c of hand) {
    if (role === 'picker') {
      if (c === 'QC' || c === 'QS') g[c] = ['best', 'High queen: certain trick, pulls two rounds of trump value.'];
      else if (c[0] === 'Q' || c[0] === 'J') g[c] = ['good', 'Trump lead: right idea. Highest first keeps you in control.'];
      else if (isTrump(c)) g[c] = ['good', 'Trump lead is correct, though leading low trump can gift a cheap trick.'];
      else if (!hasTrump && c[0] === 'A') g[c] = ['good', 'No trump left to lead: cash the ace while it lives.'];
      else if (!hasTrump) g[c] = ['okay', 'No trump left to lead: keep it small and lose cheap.'];
      else if (calledSuit && c[1] === calledSuit) g[c] = ['okay', 'Flushing the called ace is a real tactic, but usually save it until trump is drawn.'];
      else g[c] = ['bad', 'You hold trump: the picker leads it. A fail lead hands tempo to the defense.'];
    } else if (role === 'partner') {
      if (c === ('A' + calledSuit)) g[c] = ['terrible', 'Never lead the called ace: it announces you and wastes its walk.'];
      else if (isTrump(c)) g[c] = [c === 'QC' ? 'best' : 'good', 'Partner leads trump for the picker. Queen of clubs first is textbook.'];
      else if (!hasTrump && c[0] === 'A') g[c] = ['good', 'No trump to lead: a fail ace is the next best thing.'];
      else if (!hasTrump) g[c] = ['okay', 'No trump: lead your short suit and hunt a trumping chance.'];
      else g[c] = ['bad', 'You hold trump: lead it. Fail leads help the defense.'];
    } else { // defender
      if (hasCalled && c[1] === calledSuit && !isTrump(c)) g[c] = ['best', 'Lead the called suit: forces the ace out early and finds your partners.'];
      else if (!isTrump(c) && failsOf(hand, c[1]).length >= 3) {
        g[c] = [hasCalled ? 'good' : 'best',
          hasCalled ? 'Long suit through the picker: someone behind you may trump in.'
            : 'No called-suit card in your hand, so the long suit through the picker is the book lead.'];
      } else if (!isTrump(c) && c[0] === 'A') {
        g[c] = [hasCalled ? 'okay' : 'good',
          hasCalled ? 'A fail ace can cash, but the called-suit lead comes first.'
            : 'No called-suit card to lead: cash the fail ace before it gets trumped.'];
      } else if (!isTrump(c)) {
        g[c] = ['okay', hasCalled ? 'A neutral fail lead. The called suit or a long suit is sharper.'
          : 'A neutral fail lead. A longer suit or an ace works harder.'];
      } else if (hand.every(isTrump)) g[c] = ['okay', 'Nothing but trump in hand: lead your smallest and keep the queens home.'];
      else g[c] = ['bad', 'Defenders do not lead trump into the picker: that does the picker\'s work.'];
    }
  }
  const bestTier = TIERS[Math.min(...hand.map(c => TIERS.indexOf(g[c][0])))];
  return { grades: g, bestTier };
}

// ---- public-information helpers -------------------------------------------
const seenCards = s => [...s.taken.flat(), ...s.trick];

// Strongest trump not yet seen and not in my hand. May secretly sit in the
// bury, so this is an upper bound on the danger — exactly what a human knows.
export function bossOut(s, myHand) {
  const seen = new Set([...seenCards(s), ...myHand]);
  return TRUMP.find(c => !seen.has(c)) || null;
}

// Expert inference: which seat LOOKS like the picker's partner, from public
// play. Tells: schmeared big points onto a picker-won trick while not
// following suit, or led trump without being the picker.
export function probablePartner(s) {
  if (s.aceFlipped) return s.partner;
  for (const t of s.history) {
    if (t.winner !== s.picker) continue;
    for (let i = 0; i < 5; i++) {
      const seat = t.seats[i];
      if (seat === s.picker) continue;
      if (points(t.cards[i]) >= 10 && effSuit(t.cards[i]) !== effSuit(t.cards[0])) return seat;
    }
  }
  for (const t of s.history) {
    if (t.seats[0] !== s.picker && isTrump(t.cards[0])) return t.seats[0];
  }
  return null;
}

// What `seat` knows about whether `other` is on its team.
// Returns 'mate' | 'enemy' | 'unknown'. Never reads hidden state.
export function knownSide(s, seat, other, level) {
  if (seat === other) return 'mate';
  if (seat === s.partner) {
    // holder of the called ace legitimately knows both teams
    return other === s.picker ? 'mate' : 'enemy';
  }
  if (seat === s.picker) {
    if (s.aceFlipped) return other === s.partner ? 'mate' : 'enemy';
    if (s.alone) return 'enemy';
    if (level === 'expert' && probablePartner(s) === other) return 'mate';
    return 'unknown';
  }
  // defender
  if (other === s.picker || (s.aceFlipped && other === s.partner)) return 'enemy';
  if (s.aceFlipped || s.alone) return 'mate'; // partner revealed: the rest are defenders
  if (level === 'expert' && probablePartner(s) === other) return 'enemy';
  return 'unknown';
}

// ---- bots ------------------------------------------------------------------
export function botPickDecision(s, seat, level = 'solid') {
  const seatPos = (seat - (s.dealer + 1) + 5) % 5;
  const hand = s.hands[seat];
  if (level === 'novice') {
    // ignores position, picks on shiny queens with thin support
    return queens(hand).length >= 1 && trumps(hand).length >= 3;
  }
  const v = evalPick(hand, seatPos).verdict;
  if (level === 'expert') return v === 'pick' || v === 'either';
  return v === 'pick' || (v === 'either' && seatPos === 4);
}

export function botBuryChoice(s, level = 'solid') {
  return level === 'novice' ? noviceBury(s.hands[s.picker]) : suggestBury(s.hands[s.picker]);
}

export function botPlay(s, seat, level = 'solid') {
  return adviseMove(s, seat, level).card;
}

// The one brain: returns {card, why}. Bots take the card; the human coach
// shows both. Level changes depth, never legality.
export function adviseMove(s, seat, level = 'expert') {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return { card: legal[0], why: 'Forced: your only legal card.' };
  const hand = s.hands[seat];
  const role = seat === s.picker ? 'picker' : seat === s.partner ? 'partner' : 'defender';

  const lowRank = cards => [...cards].sort((a, b) =>
    points(a) - points(b) ||
    (isTrump(a) ? 1 : 0) - (isTrump(b) ? 1 : 0) ||
    trumpPower(b) - trumpPower(a))[0];

  if (level === 'novice') {
    if (s.trick.length === 0) {
      const c = [...legal].sort((a, b) => (isTrump(a) && isTrump(b) ? trumpPower(a) - trumpPower(b) : points(b) - points(a)))[0];
      return { card: c, why: 'Novice habit: lead the biggest thing you hold.' };
    }
    const winIdx = trickWinner(s.trick);
    const winners = legal.filter(c => beats(s.trick[winIdx], c));
    if (winners.length) {
      const c = winners.sort((a, b) => trumpPower(a) - trumpPower(b))[0];
      return { card: c, why: 'Novice habit: win it with the biggest winner, queens first.' };
    }
    return { card: lowRank(legal), why: 'Cannot win: throw the smallest card.' };
  }

  // ---- solid / expert ----
  if (s.trick.length === 0) {
    const { grades } = gradeLeads(legal, role, s.calledSuit);
    const ranked = [...legal].sort((a, b) => TIERS.indexOf(grades[a][0]) - TIERS.indexOf(grades[b][0]) ||
      (isTrump(a) && isTrump(b) ? trumpPower(a) - trumpPower(b) : points(a) - points(b)));
    const card = ranked[0];
    // Expert refinement: with the boss trump in hand, lead it — a certain
    // trick that pulls two enemy trump.
    if (level === 'expert' && (role === 'picker' || role === 'partner')) {
      const boss = bossOut(s, hand);
      const myBest = trumps(legal).sort((a, b) => trumpPower(a) - trumpPower(b))[0];
      if (myBest && (!boss || trumpPower(myBest) < trumpPower(boss))) {
        return { card: myBest, why: `Your ${myBest} is the boss trump right now: a certain trick that pulls two enemy trump.` };
      }
    }
    return { card, why: grades[card][1] };
  }

  const winIdx = trickWinner(s.trick);
  const winnerSeat = s.trickSeats[winIdx];
  const winCard = s.trick[winIdx];
  const side = knownSide(s, seat, winnerSeat, level);
  const last = s.trick.length === 4;
  const winners = legal.filter(c => beats(winCard, c));
  const cheapestWin = winners.sort((a, b) => {
    const at = isTrump(a), bt = isTrump(b);
    if (at !== bt) return at ? 1 : -1;
    return at ? trumpPower(b) - trumpPower(a) : points(a) - points(b);
  })[0];
  const trickPts = handPoints(s.trick);

  // Is the current winning card safe from the players still to come?
  const winCardIsBoss = (() => {
    if (!isTrump(winCard)) return false;
    if (level !== 'expert') return trumpPower(winCard) <= 5;
    const boss = bossOut(s, hand);
    return !boss || trumpPower(winCard) <= trumpPower(boss);
  })();

  // Schmear: a mate holds it and it will stick — or, as a defender in the
  // dark, the book's 60% rule toward a non-picker winner we cannot beat.
  const inTheDark = side === 'unknown' && role === 'defender' && winnerSeat !== s.picker && !winners.length;
  if ((side === 'mate' || inTheDark) && (last || winCardIsBoss)) {
    const fat = [...legal].sort((a, b) => points(b) - points(a) || trumpPower(b) - trumpPower(a))[0];
    if (points(fat) > 0) {
      return {
        card: fat,
        why: side === 'mate'
          ? `${last ? 'Last to play and your' : 'Your'} side has the trick locked: schmear the fat, every point counts toward the 61.`
          : 'The picker cannot win this trick. When in doubt, schmear: right about 60% of the time.',
      };
    }
    return { card: lowRank(legal), why: 'Trick is won but you hold no points to feed it: throw your smallest.' };
  }
  if (side === 'mate' && !winners.length) {
    return { card: lowRank(legal), why: 'Teammate is winning but the trick is not safe yet: keep your points, throw low.' };
  }
  if (winners.length && (last ? trickPts + points(cheapestWin) >= 4 : trickPts >= 10 || role === 'picker' || side === 'enemy')) {
    return {
      card: cheapestWin,
      why: isTrump(cheapestWin)
        ? `Take it with your cheapest winning trump: ${trickPts} points sit on the table and the queens stay home.`
        : 'Your card wins the trick without spending trump: points before power.',
    };
  }
  return {
    card: lowRank(legal),
    why: winners.length
      ? 'You could win, but the trick is thin: save your trump for a fatter one.'
      : 'You cannot win this trick: throw your lowest points and wait.',
  };
}

export { sortHand, currentTurn };
