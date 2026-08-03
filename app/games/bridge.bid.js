// SAYC bidding subset with explanations: openings, responses (incl. Stayman,
// Jacoby transfers, Blackwood), simple overcalls and rebids for the bots.
// Imports engine only. Calls are 'P' or level+strain ('1N','2C','4S').

import {
  SUITS, hcp, lengthPoints, totalPoints, isBalanced, shape, suitCards,
  rankIdx, legalCalls, bidRank, isBid,
} from './bridge.engine.js';

const GL = { C: '♣', D: '♦', H: '♥', S: '♠', N: 'NT' };
export const callLabel = c => (c === 'P' ? 'Pass' : c === 'X' ? 'Double' : c === 'XX' ? 'Redouble' : `${c[0]}${GL[c[1]]}`);

// Opening threshold. Book SAYC opens 13+ total points; the house game opens
// 12 (Standard American played light, the modern 2/1 style). bridge.js sets it
// from the saved pref; drills, bots and the coach all follow it.
let OPEN_MIN = 13;
export const setOpenMin = n => { OPEN_MIN = n === 12 ? 12 : 13; };
export const getOpenMin = () => OPEN_MIN;

const len = (hand, su) => suitCards(hand, su).length;
const longest = hand => [...SUITS].sort((a, b) => len(hand, b) - len(hand, a) || SUITS.indexOf(b) - SUITS.indexOf(a))[0];
const goodSuit = (hand, su) => suitCards(hand, su).filter(c => 'AKQJT'.includes(c[0])).length >= 2;
export const aces = hand => hand.filter(c => c[0] === 'A').length;

// A stopper in a suit: A, K with cover, Q with two, J with three.
export const hasStopper = (hand, su) => {
  const s = suitCards(hand, su);
  return s.some(c => c[0] === 'A')
    || (s.some(c => c[0] === 'K') && s.length >= 2)
    || (s.some(c => c[0] === 'Q') && s.length >= 3)
    || (s.some(c => c[0] === 'J') && s.length >= 4);
};

// Takeout double shape: opening values, short in theirs, help everywhere else.
export function takeoutShape(hand, theirSu) {
  return hcp(hand) >= 12 && theirSu !== 'N'
    && len(hand, theirSu) <= 2
    && SUITS.filter(su => su !== theirSu).every(su => len(hand, su) >= 3);
}

// ---- opening bids ----------------------------------------------------------
export function openingBid(hand) {
  const p = hcp(hand), tp = totalPoints(hand), sh = shape(hand);
  const why = base => `${p} HCP${tp > p ? ` (${tp} with length)` : ''}, shape ${[...sh].sort((a, b) => b - a).join('-')}. ${base}`;
  if (p >= 22) return { call: '2C', why: why('22+ points: open 2♣, the artificial strong bid. Any other opening risks being passed out.') };
  if (p >= 20 && p <= 21 && isBalanced(hand)) return { call: '2N', why: why('20-21 balanced: 2NT describes this hand in one bid.') };
  if (p >= 15 && p <= 17 && isBalanced(hand)) return { call: '1N', why: why('15-17 balanced: the 1NT opening. The most descriptive call in the system.') };
  if (tp >= OPEN_MIN) {
    if (len(hand, 'S') >= 5 && len(hand, 'S') >= len(hand, 'H')) return { call: '1S', why: why('Opening points with a 5-card spade suit: majors need five to open.') };
    if (len(hand, 'H') >= 5) return { call: '1H', why: why('Opening points with a 5-card heart suit: majors need five to open.') };
    if (len(hand, 'D') >= len(hand, 'C') && len(hand, 'D') >= 4) return { call: '1D', why: why('No 5-card major: open the longer minor.') };
    if (len(hand, 'C') >= 3) return { call: '1C', why: why('No 5-card major, no 4-card diamond suit: 1♣ on 3+ clubs.') };
    return { call: '1D', why: why('No 5-card major: the minors split 4-4 or 3-3, prefer 1♦ with 4, 1♣ with 3.') };
  }
  for (const su of ['S', 'H', 'D']) {
    if (len(hand, su) === 6 && p >= 5 && p <= 11 && goodSuit(hand, su)) {
      return { call: '2' + su, why: why(`Weak two: 5-11 points and a decent 6-card ${GL[su]} suit. Preempt now, before they find their fit.`) };
    }
  }
  const lg = longest(hand);
  if (len(hand, lg) >= 7 && p >= 5 && p <= 10 && lg !== 'C') {
    return { call: '3' + lg, why: why(`A 7-card suit with weak values: preempt at the three level and steal their auction.`) };
  }
  return { call: 'P', why: why(`Under ${OPEN_MIN} points with no preempt shape: pass. Discipline now pays later.`) };
}

// ---- responses -------------------------------------------------------------
export function responseTo(open, hand) {
  const p = hcp(hand), tp = totalPoints(hand);
  const why = base => `${p} HCP opposite partner's ${callLabel(open)}. ${base}`;

  if (open === '1N') {
    const mj = ['H', 'S'].filter(su => len(hand, su) >= 5)[0];
    if (mj && p >= 0) {
      const transfer = mj === 'H' ? '2D' : '2H';
      return { call: transfer, why: why(`Jacoby transfer: ${callLabel(transfer)} shows 5+ ${GL[mj]} and makes the strong hand declarer. Works on ANY point count.`) };
    }
    if (p >= 8 && (len(hand, 'H') === 4 || len(hand, 'S') === 4)) {
      return { call: '2C', why: why('Stayman: 8+ points and a 4-card major. Ask opener for a 4-card major before settling on notrump.') };
    }
    if (p >= 10) return { call: '3N', why: why('10+ opposite 15-17: the partnership holds 25+, bid the game.') };
    if (p >= 8) return { call: '2N', why: why('8-9: invite. Opener carries on with 17, passes with 15.') };
    return { call: 'P', why: why('Under 8 with no 5-card major: pass and let 1NT play.') };
  }
  if (open === '2C') return { call: '2D', why: why('2♦ is the waiting response: says nothing yet, lets the big hand describe itself.') };
  if (open === '1H' || open === '1S') {
    const su = open[1];
    if (len(hand, su) >= 4 && tp >= 13) return { call: '2N', why: why('Jacoby 2NT: 13+ with 4-card support, the game-forcing raise. The direct jump to game would be preemptive, not strong.') };
    if (len(hand, su) >= 3) {
      if (tp >= 10 && tp <= 12 && len(hand, su) >= 4) return { call: '3' + su, why: why('Limit raise: 10-12 support points with 4 trumps invites game.') };
      if (tp >= 6 && tp <= 9) return { call: '2' + su, why: why('Simple raise: 6-9 with 3-card support. Support with support.') };
      if (tp >= 10) {
        const lg2 = longest(hand);
        const other = lg2 !== su && len(hand, lg2) >= 4 ? lg2 : SUITS.find(x => x !== su && len(hand, x) >= 4);
        if (other) return { call: '2' + other, why: why('10+ with only 3-card support: show a new suit first (two-level promises 10+), support next turn.') };
        return { call: '3' + su, why: why('10-12 support points: the limit raise, inviting game.') };
      }
    }
    if (open === '1H' && len(hand, 'S') >= 4 && p >= 6) return { call: '1S', why: why('6+ points and 4 spades: show the other major at the one level.') };
    if (p >= 10) {
      const lg = longest(hand);
      if (lg !== su && len(hand, lg) >= 4) return { call: '2' + lg, why: why(`A two-level new suit promises 10+ points. Bid the long suit.`) };
    }
    if (p >= 6) return { call: '1N', why: why('6-10 without support or a biddable suit at the one level: 1NT keeps the auction alive.') };
    return { call: 'P', why: why('Under 6 points: pass even with support. Bidding invites a level you cannot survive.') };
  }
  if (open === '1C' || open === '1D') {
    const mj = ['H', 'S'].filter(su => len(hand, su) >= 4).sort((a, b) => len(hand, b) - len(hand, a))[0];
    if (mj && p >= 6) return { call: '1' + mj, why: why(`6+ points and a 4-card major: majors before minor raises, always hunting the 8-card major fit.`) };
    if (len(hand, open[1]) >= 5 && p >= 6) return { call: '2' + open[1], why: why('6-9 with 5-card support: raise the minor.') };
    if (p >= 6 && p <= 10) return { call: '1N', why: why('6-10 balanced, no major: 1NT.') };
    if (p >= 11) return { call: '2N', why: why('11-12 balanced: invitational 2NT.') };
    return { call: 'P', why: why('Under 6: pass.') };
  }
  if (open[0] === '2' && open !== '2N') { // weak two
    if (len(hand, open[1]) >= 3 && p >= 17) return { call: '4' + open[1], why: why('Support and a strong hand opposite a weak two: no need to ask, bid the game.') };
    if (len(hand, open[1]) >= 3 && p >= 14) return { call: '2N', why: why('14-16 with a fit: 2NT asks for a feature. A maximum shows an outside ace or king and you accept game; a minimum rebids the suit and you stop.') };
    if (len(hand, open[1]) >= 3 && p >= 8) return { call: '3' + open[1], why: why('Raise the preempt: furthering the barrage, not inviting.') };
    return { call: 'P', why: why('No fit or values: leave the preempt alone.') };
  }
  return { call: 'P', why: why('No systemic action: pass.') };
}

// Negative double: partner opened one of a suit, RHO overcalled a suit bid
// through 2S. X = the unbid major a natural bid cannot show: exactly 4 cards
// (a 5-card major bids itself), 6+ points at the one level, 8+ when the
// implied bid sits at the two level. Returns null when the shape is not there.
export function negativeDouble(open, over, hand) {
  if (!['1C', '1D', '1H', '1S'].includes(open)) return null;
  if (!over || !isBid(over) || over[1] === 'N' || bidRank(over) > bidRank('2S')) return null;
  const unbid = ['H', 'S'].filter(su => su !== open[1] && su !== over[1]);
  if (!unbid.length) return null;
  const p = hcp(hand);
  const why = base => `${p} HCP after ${callLabel(open)} – (${callLabel(over)}). ${base}`;
  if (unbid.length === 2) { // 1C – (1D): the double shows both majors
    if (len(hand, 'H') >= 4 && len(hand, 'S') >= 4 && p >= 6) {
      return { call: 'X', why: why('The negative double: 4-4 in the unbid majors. One call shows both; opener picks.') };
    }
    return null;
  }
  const su = unbid[0];
  const twoLevel = bidRank('1' + su) <= bidRank(over);
  if (su === 'S' && len(hand, 'S') !== 4) return null; // with five, bid 1S itself
  if (su === 'H' && (len(hand, 'H') < 4 || (len(hand, 'H') >= 5 && totalPoints(hand) >= 10))) return null; // 5+ and 10+ bids the suit
  if (p < (twoLevel ? 8 : 6)) return null;
  return {
    call: 'X',
    why: why(`They stole your bid: the negative double IS the ${GL[su]} call — exactly four of them${twoLevel ? ', without the 10 points a two-level bid would promise' : ' (with five, bid the suit itself)'}.`),
  };
}

// Opener's reply to partner's negative double: bid the shown major.
export function advanceNegative(a, seat, hand) {
  const partner = partnerLastBid(a, seat);
  const theirBid = lastBidBefore(a, partner.idx);
  const overSu = theirBid ? theirBid[1] : null;
  const mine = myBids(a, seat);
  const openSu = mine[0][1];
  const legal = legalCalls(a);
  const tp = totalPoints(hand), p = hcp(hand);
  const why = base => `${p} HCP after partner's negative double. ${base}`;
  const freed = a.calls[a.calls.length - 1] !== 'P';
  if (freed && tp < 16) return { call: 'P', why: why('They bid again over the double: nothing forces a minimum now.') };
  const majors = ['H', 'S'].filter(su => su !== openSu && su !== overSu)
    .sort((x, y) => len(hand, y) - len(hand, x));
  const show = majors.find(su => len(hand, su) >= 4);
  if (show) {
    const cheap = ['1', '2', '3', '4'].map(l => l + show).find(b => legal.includes(b));
    const jump = cheap && `${Number(cheap[0]) + 1}${show}`;
    if (tp >= 16 && jump && legal.includes(jump)) {
      return { call: jump, why: why(`16+ with four ${GL[show]}: jump. A minimum bid would bury the extras partner asked about.`) };
    }
    if (cheap) return { call: cheap, why: why(`The double asked for ${GL[show]}: bid it at the cheapest level.`) };
  }
  if (overSu && overSu !== 'N' && hasStopper(hand, overSu) && isBalanced(hand)) {
    const nt = ['1N', '2N'].find(b => legal.includes(b));
    if (nt) return { call: nt, why: why('No 4-card major to give partner, but their suit is stopped: notrump says exactly that.') };
  }
  if (len(hand, openSu) >= 6) {
    const rb = ['2', '3'].map(l => l + openSu).find(b => legal.includes(b));
    if (rb) return { call: rb, why: why('No major to show: rebid the 6-card suit, the cheapest true message left.') };
  }
  const scrape = majors.find(su => len(hand, su) >= 3);
  if (scrape) {
    const cheap = ['1', '2'].map(l => l + scrape).find(b => legal.includes(b));
    if (cheap) return { call: cheap, why: why(`Partner's double demands a call: three ${GL[scrape]} is the least lie available.`) };
  }
  return { call: 'P', why: why('Nothing left to say below trouble: pass.') };
}

// Reply to 2NT over our weak two: the feature ask.
export function featureReply(hand, su) {
  const p = hcp(hand);
  if (p >= 9) {
    for (const f of SUITS) {
      if (f === su) continue;
      if (suitCards(hand, f).some(c => c[0] === 'A' || c[0] === 'K')) {
        return { call: '3' + f, why: `2NT asked for a feature: a maximum (${p} of the 5-11) shows its outside ace or king — 3${GL[f]} says "honor here", helping partner count game.` };
      }
    }
    return { call: '3' + su, why: `Maximum (${p}) but no outside ace or king to show: rebid the suit and let partner judge.` };
  }
  return { call: '3' + su, why: `2NT asked for a feature: with a minimum (${p} of the 5-11), rebid the suit. Partner stops unless game was always on.` };
}

// ---- conventions -----------------------------------------------------------
export function staymanReply(hand) {
  if (len(hand, 'H') >= 4) return { call: '2H', why: 'Stayman asks for a 4-card major: with four hearts (even with four spades too), bid 2♥ first.' };
  if (len(hand, 'S') >= 4) return { call: '2S', why: 'Four spades, no four hearts: 2♠.' };
  return { call: '2D', why: 'No 4-card major: the 2♦ denial.' };
}
export function blackwoodReply(hand) {
  const a = aces(hand);
  const call = ['5C', '5D', '5H', '5S'][a === 4 ? 0 : a];
  return { call, why: `4NT asks aces: ${['5♣ shows 0 or 4', '5♦ shows 1', '5♥ shows 2', '5♠ shows 3'][a === 4 ? 0 : a]}. You hold ${a}.` };
}
export const transferReply = t => (t === '2D'
  ? { call: '2H', why: 'Partner transferred: complete it. 2♦ commands 2♥, no judgment involved.' }
  : { call: '2S', why: 'Partner transferred: complete it. 2♥ commands 2♠.' });

// ---- bot auction policy ----------------------------------------------------
function partnerLastBid(a, seat) {
  for (let i = a.calls.length - 2; i >= 0; i -= 2) {
    const s = (a.dealer + i) % 4;
    if (s === (seat + 2) % 4) return { call: a.calls[i], idx: i };
  }
  return null;
}
const myBids = (a, seat) => a.calls.filter((c, i) => (a.dealer + i) % 4 === seat && isBid(c));
const lastBidBefore = (a, idx) => {
  for (let i = idx - 1; i >= 0; i--) if (isBid(a.calls[i])) return a.calls[i];
  return null;
};

// Advance partner's takeout double: the command to bid.
export function advanceDouble(a, seat, hand) {
  const partner = partnerLastBid(a, seat);
  const theirBid = lastBidBefore(a, partner.idx);
  const theirSu = theirBid ? theirBid[1] : null;
  const p = hcp(hand);
  const legal = legalCalls(a);
  const why = base => `${p} HCP after partner's takeout double. ${base}`;
  // RHO acted over the double (bid or redouble): bidding is voluntary now
  const freed = a.calls[a.calls.length - 1] !== 'P';
  if (freed && p < 6) return { call: 'P', why: why('Right-hand opponent bid over the double, so you are off the hook: pass with nothing.') };
  if (p >= 8 && p <= 11 && theirSu && theirSu !== 'N' && hasStopper(hand, theirSu) && legal.includes('1N')) {
    return { call: '1N', why: why('8-11 with their suit stopped: 1NT describes it better than a scrappy suit.') };
  }
  const unbid = SUITS.filter(su => su !== theirSu)
    .sort((x, y) => len(hand, y) - len(hand, x) || (['H', 'S'].includes(y) ? 1 : 0) - (['H', 'S'].includes(x) ? 1 : 0));
  for (const su of unbid) {
    const cheap = ['1', '2', '3'].map(l => l + su).find(b => legal.includes(b));
    if (!cheap) continue;
    const jump = `${Number(cheap[0]) + 1}${su}`;
    if (p >= 10 && p <= 12 && legal.includes(jump)) {
      return { call: jump, why: why(`10-12: jump in your best suit to invite. A minimum advance would hide the values partner asked about.`) };
    }
    return { call: cheap, why: why(`The double commands a bid: cheapest length in ${GL[su]}${p < 6 ? ', even broke. Passing converts it to a penalty double your side cannot back up' : ''}.`) };
  }
  return { call: 'P', why: why('Nothing biddable below game: pass.') };
}

// Novice bidder: natural bids, no conventions, chronic optimism.
function noviceCall(a, seat) {
  const hand = a.hands[seat];
  const legal = legalCalls(a);
  const p = hcp(hand);
  const lg = longest(hand);
  const lastBid = [...a.calls].reverse().find(isBid);
  const partner = partnerLastBid(a, seat);
  if (partner && isBid(partner.call) && partner.call[1] !== 'N') {
    const su = partner.call[1];
    if (len(hand, su) >= 2 && p >= 5) {
      const raise = `${Number(partner.call[0]) + 1}${su}`;
      if (legal.includes(raise)) return raise;
    }
  }
  if (p >= 11) {
    for (let lvlN = 1; lvlN <= 3; lvlN++) {
      const b = `${lvlN}${lg}`;
      if (legal.includes(b)) return b;
    }
  }
  return 'P';
}

export function botCall(a, seat, level = 'solid') {
  if (level === 'novice') return noviceCall(a, seat);
  const hand = a.hands[seat];
  const legal = legalCalls(a);
  const lastBid = [...a.calls].reverse().find(isBid);
  const partner = partnerLastBid(a, seat);
  const iBid = myBids(a, seat).length > 0;
  const pick = c => (legal.includes(c.call) ? c.call : 'P');

  if (!lastBid) return pick(openingBid(hand));

  const partnerOpened = partner && isBid(partner.call) && !iBid;
  if (partnerOpened) {
    const o = partner.call;
    // RHO overcalled in between: the negative double comes first
    const rho = a.calls[partner.idx + 1];
    if (rho && isBid(rho) && legal.includes('X') && negativeDouble(o, rho, hand)) return 'X';
    if (o === '1N') {
      // handle our own conventions when responding to 1NT
      return pick(responseTo('1N', hand));
    }
    const r = responseTo(o, hand);
    if (legal.includes(r.call)) return r.call;
    // the overcall stole the level: a one-level new suit bumps to two with the
    // 10+ points and 5 cards a two-level bid promises
    if (isBid(r.call) && r.call[0] === '1' && r.call[1] !== 'N'
      && totalPoints(hand) >= 10 && len(hand, r.call[1]) >= 5 && legal.includes('2' + r.call[1])) {
      return '2' + r.call[1];
    }
    return 'P';
  }
  // partner doubled and we have not bid: read the double by context
  if (partner && partner.call === 'X' && !iBid) {
    const dblOf = lastBidBefore(a, partner.idx);
    if (dblOf && dblOf[1] === 'N') {
      // penalty double of their notrump: leave it in, run only broke with a suit
      const lg = longest(hand);
      if (hcp(hand) <= 3 && len(hand, lg) >= 6) {
        const run = ['2', '3'].map(l => l + lg).find(b => legal.includes(b));
        if (run) return run;
      }
      return 'P';
    }
    return pick(advanceDouble(a, seat, hand));
  }

  if (partner && iBid) {
    const mine = myBids(a, seat);
    const my = mine[mine.length - 1];
    if (my === '1N' && partner.call === '2C') return pick(staymanReply(hand));
    if (my === '1N' && (partner.call === '2D' || partner.call === '2H')) return pick(transferReply(partner.call));
    if (partner.call === '4N') return pick(blackwoodReply(hand));
    if ((my === '1H' || my === '1S') && partner.call === '3' + my[1]) {
      return totalPoints(hand) >= 14 ? pick({ call: '4' + my[1] }) : 'P';
    }
    if ((my === '1H' || my === '1S') && partner.call === '2N') return pick({ call: '4' + my[1] }); // Jacoby: game-forcing
    if (my === '1N' && partner.call === '2N') return hcp(hand) >= 17 ? pick({ call: '3N' }) : 'P';
    // weak-two opener answers the 2NT feature ask
    if (['2D', '2H', '2S'].includes(mine[0]) && partner.call === '2N' && iOpenedAuction(a, seat)) {
      return pick(featureReply(hand, mine[0][1]));
    }
    // responder placed the 2NT feature ask: read the reply
    const pBids = a.calls.filter((c, i) => (a.dealer + i) % 4 === (seat + 2) % 4 && isBid(c));
    if (my === '2N' && ['2D', '2H', '2S'].includes(pBids[0]) && !iOpenedAuction(a, seat)) {
      const su = pBids[0][1];
      if (partner.call === '3' + su) return 'P'; // minimum: stop
      if (isBid(partner.call) && partner.call[0] === '3') return pick({ call: '4' + su }); // feature: game
    }
    // partner doubled after I bid: advance a negative double, sit for penalty
    if (partner.call === 'X') {
      const dblOf = lastBidBefore(a, partner.idx);
      if (dblOf && dblOf[1] === 'N') return 'P'; // penalty: leave it in
      if (iOpenedAuction(a, seat)) return pick(advanceNegative(a, seat, hand));
      return 'P';
    }
    const rb = iOpenedAuction(a, seat)
      ? rebid(a, seat, hand, my, partner)
      : responderRebid(a, seat, hand, my, partner);
    if (rb) return pick(rb);
    return 'P';
  }
  // opponents opened, we have not bid: 1NT overcall, takeout double, or suit overcall
  if (!iBid && lastBid) {
    const p = hcp(hand);
    const theirSu = lastBid[1];
    // sitting over their 1NT with its own values: the penalty double
    if (lastBid === '1N' && p >= 15 && legal.includes('X')) return 'X';
    if (p >= 15 && p <= 18 && isBalanced(hand) && theirSu !== 'N' && hasStopper(hand, theirSu) && legal.includes('1N')) {
      return '1N';
    }
    const lg = longest(hand);
    if (p >= 8 && p <= 16 && len(hand, lg) >= 5 && goodSuit(hand, lg)) {
      const level = bidRank('1' + lg) > bidRank(lastBid) ? '1' : '2';
      const call = level + lg;
      if (legal.includes(call) && (level === '1' || p >= 11)) return call;
    }
    if (takeoutShape(hand, theirSu) && legal.includes('X')) return 'X';
    return 'P';
  }
  return 'P';
}

// Did this seat make the partnership's first bid?
function iOpenedAuction(a, seat) {
  let mine = -1, theirs = -1;
  a.calls.forEach((c, i) => {
    const s = (a.dealer + i) % 4;
    if (!isBid(c)) return;
    if (s === seat && mine < 0) mine = i;
    if (s === (seat + 2) % 4 && theirs < 0) theirs = i;
  });
  return mine >= 0 && (theirs < 0 || mine < theirs);
}

// Responder's second call after opener's rebid. Same strength scale.
function responderRebid(a, seat, hand, my, partner) {
  if (!isBid(partner.call)) return null;
  const legal = legalCalls(a);
  const tp = totalPoints(hand), p = hcp(hand);
  const pc = partner.call;
  // opener raised my suit: invite or drive by strength
  if (isBid(my) && my[1] !== 'N' && pc[1] === my[1]) {
    const su = my[1];
    if (['H', 'S'].includes(su) && tp >= 13 && Number(pc[0]) < 4 && legal.includes('4' + su)) return { call: '4' + su };
    if (tp >= 11 && tp <= 12) {
      const next = `${Number(pc[0]) + 1}${su}`;
      if (Number(pc[0]) + 1 < (su === 'H' || su === 'S' ? 4 : 5) && legal.includes(next)) return { call: next };
    }
    return null;
  }
  // opener rebid notrump: raise toward 3NT on power
  if (pc[1] === 'N') {
    if (p >= 13 && legal.includes('3N')) return { call: '3N' };
    if (p >= 11 && pc === '1N' && legal.includes('2N')) return { call: '2N' };
    return null;
  }
  // opener showed a second suit: with game values, pick a game
  if (tp >= 13) {
    if (['H', 'S'].includes(pc[1]) && len(hand, pc[1]) >= 3 && legal.includes('4' + pc[1])) return { call: '4' + pc[1] };
    if (isBalanced(hand) && legal.includes('3N')) return { call: '3N' };
  }
  return null;
}

// Opener's second call after partner's new-suit response. One strength scale
// (totalPoints), no separate estimator. Returns null when nothing systemic fits.
function rebid(a, seat, hand, my, partner) {
  if (!['1C', '1D', '1H', '1S'].includes(my)) return null;
  if (!isBid(partner.call) || partner.call[1] === 'N' || partner.call[1] === my[1]) return null;
  const legal = legalCalls(a);
  const psu = partner.call[1];
  const tp = totalPoints(hand), p = hcp(hand);
  // raise partner's major with 4-card support, level by strength
  if (['H', 'S'].includes(psu) && len(hand, psu) >= 4) {
    const lvl = tp >= 19 ? 4 : tp >= 16 ? 3 : 2;
    for (let l = lvl; l <= 4; l++) if (legal.includes(l + psu)) return { call: l + psu };
  }
  // balanced rebids: cheapest NT 12-14, jump 2NT 18-19
  if (isBalanced(hand)) {
    if (p >= 18 && p <= 19 && legal.includes('2N')) return { call: '2N' };
    if (p >= 12 && p <= 14) {
      const nt = ['1N', '2N'].find(b => legal.includes(b));
      if (nt === '1N' || (nt === '2N' && Number(partner.call[0]) >= 2)) return { call: nt };
    }
  }
  // 6-card suit: rebid it, jumping with 16+
  if (len(hand, my[1]) >= 6) {
    const from = tp >= 16 ? Number(my[0]) + 2 : Number(my[0]) + 1;
    for (let l = from; l <= 4; l++) if (legal.includes(l + my[1])) return { call: l + my[1] };
  }
  // a second 4-card suit, cheapest
  for (const su of SUITS) {
    if (su === my[1] || su === psu || len(hand, su) < 4) continue;
    const b = ['1', '2', '3'].map(l => l + su).find(x => legal.includes(x));
    if (b && (b[0] === '1' || tp >= 13)) return { call: b };
  }
  return null;
}

// ---- opening lead grading --------------------------------------------------
const TIERS = ['best', 'good', 'okay', 'bad', 'terrible'];
export function gradeLeads(hand, contract) {
  const nt = contract.strain === 'N';
  const trump = nt ? null : contract.strain;
  const g = {};
  const bySuit = Object.fromEntries(SUITS.map(su => [su, suitCards(hand, su).sort((a, b) => rankIdx(b) - rankIdx(a))]));
  const sequenceTop = c => {
    const s = bySuit[c[1]];
    const i = s.indexOf(c);
    return i === 0 && rankIdx(c) >= rankIdx('T' + c[1]) && s[1] && rankIdx(s[1]) === rankIdx(c) - 1;
  };
  for (const c of hand) {
    const s = bySuit[c[1]], l = s.length, i = s.indexOf(c);
    if (nt) {
      const longSuits = Math.max(...SUITS.map(su => bySuit[su].length));
      if (sequenceTop(c)) g[c] = ['best', 'Top of a sequence: builds tricks without giving one away.'];
      else if (l === longSuits && l >= 4 && i === 3) g[c] = ['best', 'Fourth from your longest and strongest: the classic notrump lead. Length beats strength here.'];
      else if (l === longSuits && l >= 4 && rankIdx(c) < rankIdx('T' + c[1])) g[c] = ['good', 'A low card from your long suit: right suit, fourth-best is the standard card.'];
      else if (c[0] === 'A' && l < 4) g[c] = ['bad', 'Cashing a stray ace vs notrump sets up their kings and queens.'];
      else if (l <= 2) g[c] = ['okay', 'A short-suit lead vs notrump helps declarer more often than you.'];
      else g[c] = ['okay', 'Playable, but the long suit is where notrump defense lives.'];
    } else {
      const hasAK = s[0] && s[0][0] === 'A' && s[1] && s[1][0] === 'K';
      if (c[1] === trump && rankIdx(c) < rankIdx('9' + trump) && l <= 3) g[c] = ['okay', 'A trump lead is safe when nothing else appeals, and cuts their ruffs.'];
      else if (c[1] === trump) g[c] = ['bad', 'Leading trump honors does declarer\'s drawing for free.'];
      else if (hasAK && i === 0) g[c] = ['best', 'Ace from ace-king: cash it, keep the lead, see dummy before deciding more.'];
      else if (l === 1 && c[0] !== 'A') g[c] = ['best', 'A singleton: partner wins and gives you a ruff.'];
      else if (sequenceTop(c)) g[c] = ['good', 'Top of a sequence: safe and constructive.'];
      else if (c[0] === 'A') g[c] = ['okay', 'An unsupported ace lead often beats air; aces are meant to capture honors.'];
      else if (s[0][0] === 'A' && i > 0) g[c] = ['terrible', 'Never underlead an ace against a suit contract: declarer scores a singleton king and laughs.'];
      else if (rankIdx(c) < rankIdx('9' + c[1]) && l >= 3) g[c] = ['good', 'Low from length: standard, tells partner you hold something there.'];
      else g[c] = ['okay', 'Playable, nothing special.'];
    }
  }
  const bestTier = TIERS[Math.min(...hand.map(c => TIERS.indexOf(g[c][0])))];
  return { grades: g, bestTier };
}

// Advice for the human's call: the solid bot's choice plus the system reason.
export function adviseCall(a, seat) {
  const call = botCall(a, seat, 'solid');
  const hand = a.hands[seat];
  const lastBid = [...a.calls].reverse().find(isBid);
  const partner = partnerLastBid(a, seat);
  const iBid = myBids(a, seat).length > 0;
  if (!lastBid) {
    const o = openingBid(hand);
    return { call, why: o.call === call ? o.why : 'System pass: nothing to say yet.' };
  }
  if (partner && isBid(partner.call) && !iBid) {
    const r = responseTo(partner.call, hand);
    if (r.call === call) return { call, why: r.why };
  }
  if (partner && partner.call === 'X' && !iBid) {
    const adv = advanceDouble(a, seat, hand);
    if (adv.call === call) return adv;
  }
  if (partner && iBid) {
    const mine = myBids(a, seat);
    const my = mine[mine.length - 1];
    if (my === '1N' && partner.call === '2C') return { call, why: staymanReply(hand).why };
    if (my === '1N' && (partner.call === '2D' || partner.call === '2H')) return { call, why: transferReply(partner.call).why };
    if (partner.call === '4N') return { call, why: blackwoodReply(hand).why };
    if (['2D', '2H', '2S'].includes(mine[0]) && partner.call === '2N') {
      const fr = featureReply(hand, mine[0][1]);
      if (fr.call === call) return fr;
    }
    if (partner.call === 'X') {
      const dblOf = lastBidBefore(a, partner.idx);
      if (dblOf && dblOf[1] === 'N' && call === 'P') {
        return { call, why: 'Partner doubled their notrump for PENALTY: pass and defend. Pulling it rescues them.' };
      }
      if (dblOf && dblOf[1] !== 'N') {
        const adv = advanceNegative(a, seat, hand);
        if (adv.call === call) return adv;
      }
    }
  }
  if (call === 'X') {
    if (partner && isBid(partner.call) && !iBid) {
      const nd = negativeDouble(partner.call, a.calls[partner.idx + 1], hand);
      if (nd) return nd;
    }
    if (lastBid === '1N') {
      return { call, why: `${hcp(hand)} HCP sitting over their 1NT: double for PENALTY. You hold their announced strength; make them play it.` };
    }
    return { call, why: `${hcp(hand)} HCP, short in their suit, support for every unbid suit: the takeout double. Partner picks the trump.` };
  }
  if (call === '1N' && lastBid && !iBid && (!partner || !isBid(partner.call))) {
    return { call, why: `${hcp(hand)} HCP balanced with their suit stopped: the 1NT overcall shows 15-18, a point more than an opening.` };
  }
  return {
    call,
    why: call === 'P'
      ? 'Nothing systemic fits: pass. Discipline is a bid too.'
      : `${hcp(hand)} HCP: ${callLabel(call)} is the system continuation.`,
  };
}

// ---- bot card play ---------------------------------------------------------
export function botPlay(a, seat, level = 'solid') {
  return adviseMove(a, seat, level).card;
}

export function adviseMove(a, seat, level = 'expert') {
  const legal = (a.trick.length === 0 ? [...a.hands[seat]] : (() => {
    const led = a.trick[0][1];
    const f = a.hands[seat].filter(c => c[1] === led);
    return f.length ? f : [...a.hands[seat]];
  })());
  if (legal.length === 1) return { card: legal[0], why: 'Forced: your only legal card.' };
  if (level === 'novice') {
    const c = [...legal].sort((x, y) => rankIdx(y) - rankIdx(x))[0];
    return { card: c, why: 'Novice habit: biggest card first, plan later.' };
  }
  const trump = a.contract.strain === 'N' ? null : a.contract.strain;
  const high = cards => [...cards].sort((x, y) => rankIdx(y) - rankIdx(x))[0];
  const low = cards => [...cards].sort((x, y) => rankIdx(x) - rankIdx(y))[0];

  if (a.trick.length === 0) {
    const declSide = seat % 2 === a.contract.declarer % 2;
    if (declSide && trump) {
      const tr = legal.filter(c => c[1] === trump);
      if (tr.length && a.trickNo < 3) {
        return { card: high(tr), why: 'Declaring side in a suit contract: draw trumps early so your winners live.' };
      }
    }
    const aces = legal.filter(c => c[0] === 'A');
    if (aces.length) return { card: aces[0], why: 'Cash a sure winner while you hold the lead.' };
    return { card: low(legal), why: 'Nothing certain to cash: exit low and keep your honors guarded.' };
  }
  const winIdx = a.trick.reduce((w, c, i) => {
    const better = (trump && c[1] === trump && a.trick[w][1] !== trump) ||
      (c[1] === a.trick[w][1] && rankIdx(c) > rankIdx(a.trick[w]));
    return better ? i : w;
  }, 0);
  const winCard = a.trick[winIdx];
  const mate = a.trickSeats[winIdx] % 2 === seat % 2;
  const beatsWin = c => (trump && c[1] === trump && winCard[1] !== trump) ||
    (c[1] === winCard[1] && rankIdx(c) > rankIdx(winCard));
  const winners = legal.filter(beatsWin);
  const last = a.trick.length === 3;
  if (mate && (last || rankIdx(winCard) >= rankIdx('Q' + winCard[1]))) {
    return { card: low(legal), why: 'Partner already has the trick: signal low and spend nothing.' };
  }
  if (winners.length) {
    const nonTrumpWinners = winners.filter(c => !trump || c[1] !== trump);
    const card = nonTrumpWinners.length ? low(nonTrumpWinners) : low(winners);
    return { card, why: 'Third hand high, but no higher than the trick needs.' };
  }
  return { card: low(legal), why: 'Cannot beat it: second hand low, save the honors for later.' };
}
