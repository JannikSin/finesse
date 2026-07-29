// Euchre strategy: calling heuristics (with the "next" convention), lead
// grading, dealer discard, bot policy. Standard book guidelines.
import {
  SUITS, COLOR_MATE, isTrump, isRight, isLeft, effSuit, trumpPower,
  beats, trickWinner, legalMoves, currentTurn, teamOf, sortHand, RANKS,
} from './euchre.engine.js';

const trumps = (h, t) => h.filter(c => isTrump(c, t));
const offAces = (h, t) => h.filter(c => c[0] === 'A' && !isTrump(c, t));
const bowers = (h, t) => (h.some(c => isRight(c, t)) ? 1 : 0) + (h.some(c => isLeft(c, t)) ? 1 : 0);

export function suitStrength(hand, t) {
  return { tc: trumps(hand, t).length, bw: bowers(hand, t), aces: offAces(hand, t).length };
}

function aloneWorthy(hand, t) {
  const { tc, bw, aces } = suitStrength(hand, t);
  return (bw === 2 && tc >= 3) || (hand.some(c => isRight(c, t)) && tc >= 4 && aces >= 1);
}

// Round 1 verdict. Returns {action, accept, reasons}.
export function evalCall1(hand, seat, dealer, upcard) {
  const t = upcard[1];
  const ourCard = teamOf(seat) === teamOf(dealer);
  const evalHand = seat === dealer ? [...hand, upcard] : hand;
  const { tc, bw, aces } = suitStrength(evalHand, t);
  const reasons = [`${tc} trump (bowers count), ${bw} bower${bw === 1 ? '' : 's'}, ${aces} off ace${aces === 1 ? '' : 's'}${seat === dealer ? ', counting the upcard you would pick up' : ''}.`];
  const strong = tc >= 3 && bw >= 1;
  const decent = tc >= 2 && aces >= 2;
  let action = 'pass';
  if (aloneWorthy(evalHand, t)) {
    action = 'alone';
    reasons.push('Both bowers with support, or the right with length and an ace: play it alone, the march pays 4.');
  } else if (bw === 2) {
    action = 'order'; reasons.push('Both bowers: the two top trump order themselves.');
  } else if (ourCard && (strong || decent)) {
    action = 'order';
    reasons.push(seat === dealer ? 'Dealer picks up: the upcard is a free trump.' : 'Ordering sends the upcard to your partner the dealer: assist with this much.');
  } else if (!ourCard && strong) {
    action = 'order';
    reasons.push('Strong enough to order even though it hands the dealer a trump: three trump with a bower.');
  } else {
    reasons.push(ourCard
      ? 'Not enough: even helping your partner, two weak trump invites a euchre.'
      : 'Ordering gifts the dealer a trump. Without three trump and a bower, pass.');
  }
  const accept = action === 'alone' ? ['alone', 'order'] : [action];
  return { action, accept, reasons };
}

// Round 2 verdict. Choices are the three non-upcard suits or pass (dealer stuck).
export function evalCall2(hand, seat, dealer, upcard) {
  const options = SUITS.filter(su => su !== upcard[1]);
  const next = COLOR_MATE[upcard[1]];
  const scored = options.map(su => ({ su, ...suitStrength(hand, su) }))
    .sort((a, b) => (b.tc * 2 + b.bw) - (a.tc * 2 + a.bw));
  const best = scored[0];
  const reasons = [];
  let action = 'pass';
  if (best.tc >= 3 && best.bw >= 1 || best.tc >= 4) {
    action = best.su;
    reasons.push(`${best.tc} trump with ${best.bw} bower${best.bw === 1 ? '' : 's'} in that suit: a real hand, call it.`);
  } else if (seat === (dealer + 1) % 4) {
    const n = scored.find(x => x.su === next);
    if (n && n.tc >= 2 && n.bw >= 1) {
      action = next;
      reasons.push(`"Next" convention: first seat calls the same color as the turndown. The dealer passed on that color, so the bowers are likely live.`);
    } else reasons.push('Nothing callable, and next is empty too: pass.');
  } else if (seat === dealer) {
    action = best.su;
    reasons.push(`Stuck the dealer: you must call. ${best.su === next ? 'Next' : 'Your best suit'} carries the most trump.`);
  } else {
    reasons.push('No suit has three trump with a bower: pass and defend.');
  }
  const accept = [action];
  if (action !== 'pass' && seat !== dealer && best.su !== action && best.tc >= 3 && best.bw >= 1) accept.push(best.su);
  return { action, accept, reasons, next };
}

const TIERS = ['best', 'good', 'okay', 'bad', 'terrible'];

export function gradeLeads(hand, role, t) {
  const g = {};
  const hasTrump = trumps(hand, t).length > 0;
  for (const c of hand) {
    if (role === 'maker') {
      if (isRight(c, t)) g[c] = ['best', 'The right bower: certain trick, pulls two trump for your side.'];
      else if (isTrump(c, t)) g[c] = ['good', 'Trump lead: the makers pull trump.'];
      else if (c[0] === 'A') g[c] = ['okay', 'A cashing ace is fine, but the makers should be pulling trump.'];
      else g[c] = ['bad', 'A low fail lead gives the defense the tempo.'];
    } else {
      if (c[0] === 'A' && !isTrump(c, t)) g[c] = ['best', 'Off-suit ace: cash it before the makers trump it.'];
      else if (!isTrump(c, t) && hand.filter(x => x[1] === c[1] && !isTrump(x, t)).length === 1) g[c] = ['good', 'Singleton lead builds a void to trump into.'];
      else if (!isTrump(c, t)) g[c] = ['okay', 'A neutral fail lead. An ace or a singleton is sharper.'];
      else g[c] = [hasTrump && hand.every(x => isTrump(x, t)) ? 'okay' : 'bad', 'Never lead trump into the makers: that does their pulling for them.'];
    }
  }
  const bestTier = TIERS[Math.min(...hand.map(c => TIERS.indexOf(g[c][0])))];
  return { grades: g, bestTier };
}

export function discardChoice(hand6, t) {
  const off = hand6.filter(c => !isTrump(c, t) && c[0] !== 'A');
  if (!off.length) {
    const any = hand6.filter(c => !isTrump(c, t));
    if (any.length) return any.sort((a, b) => RANKS.indexOf(b[0]) - RANKS.indexOf(a[0]))[0];
    return [...hand6].sort((a, b) => trumpPower(b, t) - trumpPower(a, t))[0];
  }
  // prefer emptying a suit, then lowest rank
  return off.sort((a, b) => {
    const la = hand6.filter(x => !isTrump(x, t) && x[1] === a[1]).length;
    const lb = hand6.filter(x => !isTrump(x, t) && x[1] === b[1]).length;
    return la - lb || RANKS.indexOf(b[0]) - RANKS.indexOf(a[0]);
  })[0];
}

export function botCall1(s, seat, level = 'solid') {
  if (level === 'novice') {
    // orders on any two trump, blind to who gets the upcard
    const evalHand = seat === s.dealer ? [...s.hands[seat], s.upcard] : s.hands[seat];
    return suitStrength(evalHand, s.upcard[1]).tc >= 2 ? 'order' : 'pass';
  }
  return evalCall1(s.hands[seat], seat, s.dealer, s.upcard).action;
}
export function botCall2(s, seat, level = 'solid') {
  if (level === 'novice') {
    const opts = SUITS.filter(su => su !== s.upcard[1]);
    const best = opts.sort((a, b) => suitStrength(s.hands[seat], b).tc - suitStrength(s.hands[seat], a).tc)[0];
    if (suitStrength(s.hands[seat], best).tc >= 2 || seat === s.dealer) return best;
    return 'pass';
  }
  return evalCall2(s.hands[seat], seat, s.dealer, s.upcard).action;
}

// Strongest trump nobody has seen (outside my hand). The buried dealer card
// stays hidden, so this is what a human at the table can actually know.
function bossTrumpOut(s, myHand) {
  const seen = new Set([...(s.history || []).flatMap(h => h.cards), ...s.trick, ...myHand]);
  const t = s.trump;
  const ladder = ['J' + t, 'J' + COLOR_MATE[t], 'A' + t, 'K' + t, 'Q' + t, 'T' + t, '9' + t];
  return ladder.find(c => !seen.has(c)) || null;
}

export function botPlay(s, seat, level = 'solid') {
  return adviseMove(s, seat, level).card;
}

export function adviseMove(s, seat, level = 'expert') {
  const legal = legalMoves(s, seat);
  if (legal.length === 1) return { card: legal[0], why: 'Forced: your only legal card.' };
  const t = s.trump;
  const myTeam = teamOf(seat);
  const makerSide = myTeam === teamOf(s.maker);
  const high = cards => [...cards].sort((a, b) =>
    (isTrump(b, t) ? 1 : 0) - (isTrump(a, t) ? 1 : 0) ||
    (isTrump(a, t) && isTrump(b, t) ? trumpPower(a, t) - trumpPower(b, t) : RANKS.indexOf(a[0]) - RANKS.indexOf(b[0])))[0];
  const low = cards => [...cards].sort((a, b) =>
    (isTrump(a, t) ? 1 : 0) - (isTrump(b, t) ? 1 : 0) ||
    (isTrump(a, t) ? trumpPower(b, t) - trumpPower(a, t) : RANKS.indexOf(b[0]) - RANKS.indexOf(a[0])))[0];

  if (level === 'novice') {
    if (s.trick.length === 0) return { card: high(legal), why: 'Novice habit: lead the biggest card.' };
    const winIdx = trickWinner(s.trick, t);
    const winners = legal.filter(c => beats(s.trick[winIdx], c, t));
    if (winners.length) return { card: high(winners), why: 'Novice habit: win big, even over a partner.' };
    return { card: low(legal), why: 'Cannot win: throw the smallest.' };
  }

  if (s.trick.length === 0) {
    if (level === 'expert' && makerSide) {
      const boss = bossTrumpOut(s, s.hands[seat]);
      const myTr = legal.filter(c => isTrump(c, t)).sort((a, b) => trumpPower(a, t) - trumpPower(b, t));
      if (myTr.length && (!boss || trumpPower(myTr[0], t) < trumpPower(boss, t))) {
        return { card: myTr[0], why: `${myTr[0]} is the boss trump still out: a free trick that keeps pulling theirs.` };
      }
      if (!myTr.length) {
        const aces = legal.filter(c => c[0] === 'A');
        if (aces.length) return { card: aces[0], why: 'Trump is done: cash the aces while they live.' };
      }
    }
    const { grades } = gradeLeads(legal, makerSide ? 'maker' : 'defender', t);
    const card = [...legal].sort((a, b) => TIERS.indexOf(grades[a][0]) - TIERS.indexOf(grades[b][0]) ||
      (isTrump(a, t) && isTrump(b, t) ? trumpPower(a, t) - trumpPower(b, t) : RANKS.indexOf(a[0]) - RANKS.indexOf(b[0])))[0];
    return { card, why: grades[card][1] };
  }

  const winIdx = trickWinner(s.trick, t);
  const winnerSeat = s.trickSeats[winIdx];
  const winCard = s.trick[winIdx];
  const partnerWinning = teamOf(winnerSeat) === myTeam;
  const last = s.trick.length === (s.sitout === null ? 3 : 2);
  const winners = legal.filter(c => beats(winCard, c, t));

  if (partnerWinning && (last || isTrump(winCard, t) || winCard[0] === 'A')) {
    return { card: low(legal), why: 'Your partner has this trick: never waste a card over a winning partner.' };
  }
  if (winners.length) {
    const cheap = winners.sort((a, b) =>
      (isTrump(a, t) ? 1 : 0) - (isTrump(b, t) ? 1 : 0) ||
      (isTrump(a, t) ? trumpPower(b, t) - trumpPower(a, t) : RANKS.indexOf(b[0]) - RANKS.indexOf(a[0])))[0];
    return {
      card: cheap,
      why: isTrump(cheap, t) ? 'Take it with your smallest trump that wins: third hand plays high, but no higher than needed.'
        : 'Win it without trump: save the trump for when it is forced.',
    };
  }
  return { card: low(legal), why: 'Cannot win: shed your weakest card and keep the trump story hidden.' };
}
