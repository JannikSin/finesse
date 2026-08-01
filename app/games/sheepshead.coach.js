// Strategy layer: pick/pass verdicts, bury suggestions, lead grading, and
// leveled bots (novice / solid / expert) that play from PUBLIC information
// only — no bot reads hidden team membership. EVERY level plays by the book
// (the house standing order): the levels differ only in how DEEP into Strupp
// they go, never in whether they follow him.
//   - novice: the cut-out recap card — picks only the listed hands, buries by
//     the book, leads by role, schmears locked tricks, never over a teammate;
//   - solid: adds the Chapter II table rules (duck early on trump leads,
//     trump fail tricks high, hold then send the called suit);
//   - expert: adds the counting rules — boss-trump tracking, partner
//     inference from public play, and the end-position play.
// Knowledge model:
//   - the partner bot knows both sides (it holds the called ace: legitimate);
//   - the picker knows the partner only once the ace flips; the EXPERT picker
//     infers a probable partner earlier from schmears and trump leads;
//   - defenders know the picker, know the partner once flipped, and otherwise
//     apply the book's "when in doubt, schmear" toward non-picker winners;
//     the EXPERT defender discounts seats showing partner tells.
// PRIMARY SOURCE: Strupp, "How to Play 'Winning' 5 Handed Sheepshead" (the
// Milwaukee book). Rule numbers below cite it. Secondary: sheepshead.org
// (Ten Commandments), playsheepshead.org. Imports engine only.

import {
  TRUMP, FAIL_SUITS, isTrump, suitOf, effSuit, points, handPoints, trumpPower,
  legalMoves, currentTurn, trickWinner, beats, callableSuits, sortHand,
} from './sheepshead.engine.js';

export const LEVELS = ['novice', 'solid', 'expert'];

const trumps = h => h.filter(isTrump);
const queens = h => h.filter(c => c[0] === 'Q');
const failsOf = (h, su) => h.filter(c => !isTrump(c) && c[1] === su);
const buryFodder = h => h.filter(c => !isTrump(c) && (c[0] === 'A' || c[0] === 'T'));

// ---- pick evaluation (Strupp Rule 9: the right picking hand) ---------------
export function evalPick(hand, seatPos) {
  const t = trumps(hand).length;
  const q = queens(hand).length;
  const hasQC = hand.includes('QC'), hasQS = hand.includes('QS');
  const bp = buryFodder(hand).length;
  const reasons = [];
  reasons.push(`${t} trump, ${q} queen${q === 1 ? '' : 's'}, ${bp} buryable point card${bp === 1 ? '' : 's'} (fail A/10).`);

  let verdict = 'pass';
  if (t >= 5) { verdict = 'pick'; reasons.push('Any 5 trump is a pick (Strupp Rule 9).'); }
  else if (q >= 2 && t >= 3 && bp >= 1) { verdict = 'pick'; reasons.push('Two queens, another trump, and points to bury: a Strupp picking hand.'); }
  else if (q >= 1 && t >= 4 && bp >= 1) { verdict = 'pick'; reasons.push('A queen, three more trump, and points to bury: a Strupp picking hand.'); }
  else if (hasQC && hasQS && (seatPos === 0 || seatPos === 4)) {
    verdict = 'pick';
    reasons.push('The two black queens are a pick when you lead or sit on the end: you control the first trump leads. Never pass under the gun with the big queen.');
  } else if (q >= 2 && t >= 3) {
    verdict = 'either';
    reasons.push('Two queens plus a trump, but nothing to bury: the book wants points going down with it. When in doubt, pick (Strupp Rule 18).');
  } else if (q >= 1 && t >= 4) {
    verdict = 'either';
    reasons.push('A queen with three more trump but no buryable points: borderline. When in doubt, pick (Strupp Rule 18).');
  } else if (q >= 1 && t === 3 && bp >= 2) {
    verdict = 'either';
    reasons.push('A queen with two other trump and points to bury is borderline: defensible either way.');
  } else if (t === 4 && seatPos === 4) {
    verdict = 'either';
    reasons.push('Four trump on the end is thin, but you saw everyone pass: fast passes mean trump in the blind. Defensible either way.');
  } else {
    if (t <= 2) reasons.push('Too little trump: you cannot pull trump or control the hand.');
    else if (q === 0) reasons.push('No queens: without high trump you cannot take control even with length.');
    else reasons.push('A lone queen with thin support gets outdrawn: pass and play defense.');
  }
  if (verdict === 'pick' && seatPos === 0) reasons.push('Picking first is an advantage: you control the hand from trick one (the picker wins about 70% of hands).');
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
    reasons.push(`Call ${calledSuit === 'C' ? 'clubs' : calledSuit === 'S' ? 'spades' : 'hearts'}: your shortest callable suit has the best chance of walking (Strupp Rule 23).`);
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
  if (voided.length) reasons.push('That voids a suit: minimize the suits you keep and you trump the first lead of it (Strupp Rule 23A).');
  return { bury, calledSuit, reasons };
}

// Every level buries by the book — suggestBury is the one bury brain.

// ---- lead grading ----------------------------------------------------------
const TIERS = ['best', 'good', 'okay', 'bad', 'terrible'];

// Every reason is checked against the actual hand: no advice ever references
// a card or suit the player does not hold.
export function gradeLeads(hand, role, calledSuit) {
  const g = {};
  const hasTrump = trumps(hand).length > 0;
  const hasCalled = calledSuit ? failsOf(hand, calledSuit).length > 0 : false;
  const qs = queens(hand).length;
  const smallestTrump = trumps(hand).sort((a, b) => trumpPower(b) - trumpPower(a))[0];
  for (const c of hand) {
    if (role === 'picker') {
      if (c === 'QC' || c === 'QS') g[c] = ['best', 'The picker leads trump, big queen first: a certain trick that pulls two enemy trump (Strupp basic play 4).'];
      else if (c[0] === 'Q' || c[0] === 'J') g[c] = ['good', 'Trump lead: right idea. Highest first keeps you in control.'];
      else if (isTrump(c) && qs === 0) g[c] = ['best', 'Weak in big trump: lead the small ones, the smallies bring out the biggies (Strupp Rule 5).'];
      else if (isTrump(c)) g[c] = ['good', 'Trump lead is correct; with queens in hand, the big one first is sharper.'];
      else if (!hasTrump && c[0] === 'A') g[c] = ['good', 'No trump left to lead: cash the ace while it lives.'];
      else if (!hasTrump && calledSuit && c[1] === calledSuit) g[c] = ['good', 'Trump is gone from your hand: send the called suit through, the ace walks home (Strupp Rule 33).'];
      else if (!hasTrump) g[c] = ['okay', 'No trump left to lead: keep it small and lose cheap.'];
      else if (calledSuit && c[1] === calledSuit) g[c] = ['bad', 'Hold the called suit until the trump is gone (Strupp Rule 32): flushing it early gets the ace trumped.'];
      else g[c] = ['bad', 'You hold trump: the picker leads it. A fail lead hands tempo to the defense.'];
    } else if (role === 'partner') {
      if (c === ('A' + calledSuit)) g[c] = ['terrible', 'Never lead the called ace: it announces you and wastes its walk.'];
      else if (c === 'QC') g[c] = ['best', 'Queen of clubs first is textbook: partner leads trump for the picker.'];
      else if (isTrump(c) && c === smallestTrump) g[c] = ['best', 'Partner leads a SMALL trump: it still draws a round and the picker puts a big one on it (Strupp Rule 22).'];
      else if (isTrump(c)) g[c] = ['good', 'Trump lead is right; the book prefers your smallest, the picker covers it.'];
      else if (!hasTrump && c[0] === 'A') g[c] = ['good', 'No trump to lead: a fail ace is the next best thing.'];
      else if (!hasTrump) g[c] = ['okay', 'No trump: lead your short suit and hunt a trumping chance.'];
      else g[c] = ['bad', 'You hold trump: lead it. Fail leads help the defense.'];
    } else { // defender
      if (hasCalled && c[1] === calledSuit && !isTrump(c)) g[c] = ['best', 'Opposition leads the called suit: forces the picker\'s side early and finds your partners (Strupp basic play 3).'];
      else if (!isTrump(c) && failsOf(hand, c[1]).length >= 3) {
        g[c] = [hasCalled ? 'good' : 'best',
          hasCalled ? 'Long suit through the picker: someone behind you may trump in.'
            : 'No called-suit card in your hand, so the long suit through the picker is the book lead (Strupp Rule 5 basic).'];
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
// The picker passes his own bury as alsoSeen: he legitimately knows it.
export function bossOut(s, myHand, alsoSeen = []) {
  const seen = new Set([...seenCards(s), ...myHand, ...alsoSeen]);
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
  const v = evalPick(hand, seatPos).verdict;
  // Novice knows only the recap card's listed hands; solid stretches on the
  // end; expert applies "when in doubt, pick" to late-seat borderlines but
  // respects Rule 25: with the bump always doubling losses, no early-seat
  // coin-flips.
  if (level === 'novice') return v === 'pick';
  if (level === 'expert') return v === 'pick' || (v === 'either' && seatPos >= 3);
  return v === 'pick' || (v === 'either' && seatPos === 4);
}

export function botBuryChoice(s) {
  return suggestBury(s.hands[s.picker]); // every level buries by the book
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

  // Cheapest discard: lowest-point FAIL first (never spend a trump to save
  // fail junk — J/Q outrank K/T/A on points but are power); if the hand is
  // all trump, the weakest trump.
  const lowRank = cards => {
    const fail = cards.filter(c => !isTrump(c));
    return fail.length
      ? [...fail].sort((a, b) => points(a) - points(b))[0]
      : [...cards].sort((a, b) => trumpPower(b) - trumpPower(a))[0];
  };

  // ---- all levels play by the book; deeper rules gate on level ----
  const trumpLeadsSoFar = s.history.filter(t => effSuit(t.cards[0]) === 'T').length;
  if (s.trick.length === 0) {
    // Strupp Rules 32/33: the picker holds the called suit while trump is
    // live, then sends it through once trump has been pulled twice — the
    // ace walks home and the partner is safe.
    if (level !== 'novice' && role === 'picker' && s.calledSuit && !s.calledSuitLed && trumpLeadsSoFar >= 2) {
      const call = hand.filter(c => !isTrump(c) && c[1] === s.calledSuit)
        .sort((a, b) => points(a) - points(b))[0];
      if (call) return { card: call, why: 'Trump has been pulled twice: send the called suit through now, the ace walks home (Strupp Rule 33).' };
    }
    // Grade against the FULL hand (suit lengths, trump holdings), pick from
    // the legal cards only.
    const { grades } = gradeLeads(hand, role, s.calledSuit);
    const ranked = [...legal].sort((a, b) => TIERS.indexOf(grades[a][0]) - TIERS.indexOf(grades[b][0]) ||
      (isTrump(a) && isTrump(b) ? trumpPower(a) - trumpPower(b) : points(a) - points(b)));
    const card = ranked[0];
    // Expert PICKER refinement: with the boss trump in hand, lead it — a
    // certain trick that pulls two enemy trump. Picker-only: the partner
    // sticks to the book's small-trump lead (Rule 22).
    if (level === 'expert' && role === 'picker') {
      const boss = bossOut(s, hand, s.buried); // the picker knows his own bury
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
  const cheapestWin = [...winners].sort((a, b) => {
    const at = isTrump(a), bt = isTrump(b);
    if (at !== bt) return at ? 1 : -1;
    return at ? trumpPower(b) - trumpPower(a) : points(a) - points(b);
  })[0];
  const trickPts = handPoints(s.trick);
  // "Throw low" that actually ducks: prefer the lowest card that does NOT
  // take the trick. Forced to win anyway? A defender over a fail trick sends
  // a man (Strupp Rule 26); everyone else wins as cheaply as possible.
  const duckLow = () => {
    const unders = legal.filter(c => !beats(winCard, c));
    if (unders.length) return lowRank(unders);
    if (role === 'defender' && !isTrump(winCard)) {
      const manly = winners.filter(c => isTrump(c) && c[0] !== 'Q')
        .sort((a, b) => trumpPower(a) - trumpPower(b))[0];
      if (manly) return manly;
    }
    return cheapestWin || lowRank(legal);
  };

  // Is the current winning card safe from the players still to come?
  // Non-experts trust only queens (a jack can still be beaten by any queen);
  // the expert counts what is actually out.
  const winCardIsBoss = (() => {
    if (!isTrump(winCard)) return false;
    if (level !== 'expert') return trumpPower(winCard) <= 3;
    const boss = bossOut(s, hand, seat === s.picker ? s.buried : []);
    return !boss || trumpPower(winCard) <= trumpPower(boss);
  })();

  // End-position play (Strupp bonus tip), checked BEFORE the schmear: trick
  // 4, my mate the picker sits to my immediate right and I am last — take
  // the trick, even over him, so I lead trick 5 and he plays last on it.
  if (level === 'expert' && side === 'mate' && winnerSeat === s.picker && s.trickNo === 3 && last &&
      (s.picker + 1) % 5 === seat && winners.length) {
    return { card: cheapestWin, why: 'Take it from the picker here: you lead the next trick and he plays last on it.' };
  }

  // Schmear: a mate holds it and it will stick — or, as a defender in the
  // dark, the book's 60% rule toward a non-picker winner we cannot beat.
  // Schmear fodder is aces, tens and kings; queens and jacks are power, not
  // points — never "schmear" a queen onto a won trick. The 60% rule only
  // applies once the picker has already played to the trick: with the picker
  // still behind, no non-trump winner is safe (Strupp Rule 26 territory).
  const inTheDark = side === 'unknown' && role === 'defender' && winnerSeat !== s.picker &&
    s.trickSeats.includes(s.picker);
  if ((side === 'mate' || inTheDark) && (last || winCardIsBoss)) {
    // Fat sort: points first, with fail nudged ahead of trump (+1.5) so a
    // fail ten beats the ace of diamonds — the point is nearly the same and
    // the trump stays home for control.
    const fat = [...legal]
      .filter(c => c[0] !== 'Q' && c[0] !== 'J')
      .sort((a, b) => (points(b) + (isTrump(b) ? 0 : 1.5)) - (points(a) + (isTrump(a) ? 0 : 1.5)))[0];
    if (fat && points(fat) > 0) {
      return {
        card: fat,
        why: side === 'mate'
          ? `${last ? 'Last to play and your' : 'Your'} side has the trick locked: schmear the fat, every point counts toward the 61.`
          : 'The picker cannot win this trick. When in doubt, schmear: right about 60% of the time.',
      };
    }
    return { card: duckLow(), why: 'Trick is won but you hold no points to feed it: throw your smallest.' };
  }
  if (side === 'mate' || inTheDark) {
    // Never go over your partner: even holding a winner, the trick already
    // belongs to your side. Keep the power home, throw low.
    return { card: duckLow(), why: 'Your side is winning this trick: never play over your partner, throw low.' };
  }
  // Strupp Rule 31: on a trump lead, 2nd and 3rd hand duck low; the 4th and
  // 5th hands do the overtrumping.
  if (level !== 'novice' && role === 'defender' && isTrump(s.trick[0]) && s.trick.length <= 2 && trickPts < 10) {
    return { card: duckLow(), why: 'Second or third on a trump lead: play low, the players behind you do the overtrumping (Strupp Rule 31).' };
  }
  if (winners.length && (last ? trickPts + points(cheapestWin) >= 4 : trickPts >= 10 || role === 'picker' || side === 'enemy')) {
    // Strupp Rule 26, "don't send a boy": a defender trumping a FAIL trick
    // trumps high — it forces the picker's big trump out, and the high
    // trump would fall to a trump lead anyway. Queens stay home. Only worth
    // a man when real points ride on it.
    if (level !== 'novice' && role === 'defender' && !isTrump(winCard) && isTrump(cheapestWin) &&
        (trickPts >= 4 || last)) {
      const manly = winners.filter(c => isTrump(c) && c[0] !== 'Q')
        .sort((a, b) => trumpPower(a) - trumpPower(b))[0];
      if (manly) {
        return { card: manly, why: 'Trumping a fail trick: send a man, not a boy — trump high and force the picker\'s big trump out (Strupp Rule 26).' };
      }
    }
    return {
      card: cheapestWin,
      why: isTrump(cheapestWin)
        ? `Take it with your cheapest winning trump: ${trickPts} points sit on the table and the queens stay home.`
        : 'Your card wins the trick without spending trump: points before power.',
    };
  }
  return {
    card: duckLow(),
    why: winners.length
      ? 'You could win, but the trick is thin: save your trump for a fatter one.'
      : 'You cannot win this trick: throw your lowest points and wait.',
  };
}

// ---- table talk ------------------------------------------------------------
// Milwaukee tavern voice, original lines. House custom (and the book's advice):
// the picker NEVER admits the blind was good — so every pick line is a grumble,
// which also means the talk leaks zero information about the hidden cards.
export const TALK = {
  pick: [
    'What a load. Who dealt this?',
    'Two stones and a prayer in there.',
    'Ach. The blind owes me money.',
    'It was... fair.',
    'I pick, and I already regret it.',
    'Somebody has to work around here.',
  ],
  pass: [
    'Pass. And no, I am not mauering.',
    'Not with this mess.',
    'Somebody else can be the hero.',
    'My grandma folds this one.',
    'Pass. Wake me for the leaster.',
  ],
  alone: [
    'No partner. No mercy.',
    'Alone. Say your prayers.',
  ],
  schmear: [
    'When in doubt, schmear.',
    'Cream on top.',
    'Every point rides home.',
    'Fatten it up.',
  ],
  trumphigh: [
    'Send a man, not a boy.',
    'No guts, no glory.',
    'Meet the big fella.',
  ],
  win: [
    'Now we bat!',
    'Sixty-one and change. Pay up.',
    'Skill. Pure skill.',
    'The blind was garbage, I swear.',
  ],
  loss: [
    'The bump stings twice.',
    'Not a word. Not one word.',
    'I blame my partner.',
    'That blind was a crime scene.',
  ],
  redeal: [
    'A whole table of mauerers.',
    'Nobody wants to work anymore.',
    'Deal them again, and mean it this time.',
  ],
};

export { sortHand, currentTurn };
