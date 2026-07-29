// SAYC bidding subset with explanations: openings, responses (incl. Stayman,
// Jacoby transfers, Blackwood), simple overcalls and rebids for the bots.
// Imports engine only. Calls are 'P' or level+strain ('1N','2C','4S').

import {
  SUITS, hcp, lengthPoints, totalPoints, isBalanced, shape, suitCards,
  rankIdx, legalCalls, bidRank, isBid,
} from './bridge.engine.js';

const GL = { C: '♣', D: '♦', H: '♥', S: '♠', N: 'NT' };
export const callLabel = c => (c === 'P' ? 'Pass' : `${c[0]}${GL[c[1]]}`);

const len = (hand, su) => suitCards(hand, su).length;
const longest = hand => [...SUITS].sort((a, b) => len(hand, b) - len(hand, a) || SUITS.indexOf(b) - SUITS.indexOf(a))[0];
const goodSuit = (hand, su) => suitCards(hand, su).filter(c => 'AKQJT'.includes(c[0])).length >= 2;
export const aces = hand => hand.filter(c => c[0] === 'A').length;

// ---- opening bids ----------------------------------------------------------
export function openingBid(hand) {
  const p = hcp(hand), tp = totalPoints(hand), sh = shape(hand);
  const why = base => `${p} HCP${tp > p ? ` (${tp} with length)` : ''}, shape ${[...sh].sort((a, b) => b - a).join('-')}. ${base}`;
  if (p >= 22) return { call: '2C', why: why('22+ points: open 2♣, the artificial strong bid. Any other opening risks being passed out.') };
  if (p >= 20 && p <= 21 && isBalanced(hand)) return { call: '2N', why: why('20-21 balanced: 2NT describes this hand in one bid.') };
  if (p >= 15 && p <= 17 && isBalanced(hand)) return { call: '1N', why: why('15-17 balanced: the 1NT opening. The most descriptive call in the system.') };
  if (tp >= 13) {
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
  return { call: 'P', why: why('Under 13 points with no preempt shape: pass. Discipline now pays later.') };
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
    if (len(hand, open[1]) >= 3 && p >= 14) return { call: '4' + open[1], why: why('Support and opening values opposite a weak two: raise to game, part preempt, part hope.') };
    if (len(hand, open[1]) >= 3 && p >= 8) return { call: '3' + open[1], why: why('Raise the preempt: furthering the barrage, not inviting.') };
    return { call: 'P', why: why('No fit or values: leave the preempt alone.') };
  }
  return { call: 'P', why: why('No systemic action: pass.') };
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
    if (o === '1N') {
      // handle our own conventions when responding to 1NT
      return pick(responseTo('1N', hand));
    }
    if (legal.includes(responseTo(o, hand).call)) return responseTo(o, hand).call;
    return 'P';
  }
  if (partner && iBid) {
    // one continuation round: complete transfers/Stayman, raise to game with extras
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
    return 'P';
  }
  // opponents opened, we have not bid: simple overcall
  if (!iBid && lastBid) {
    const lg = longest(hand);
    const p = hcp(hand);
    if (p >= 8 && p <= 16 && len(hand, lg) >= 5 && goodSuit(hand, lg)) {
      const level = bidRank('1' + lg) > bidRank(lastBid) ? '1' : '2';
      const call = level + lg;
      if (legal.includes(call) && (level === '1' || p >= 11)) return call;
    }
    return 'P';
  }
  return 'P';
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
  if (partner && iBid) {
    const mine = myBids(a, seat);
    const my = mine[mine.length - 1];
    if (my === '1N' && partner.call === '2C') return { call, why: staymanReply(hand).why };
    if (my === '1N' && (partner.call === '2D' || partner.call === '2H')) return { call, why: transferReply(partner.call).why };
    if (partner.call === '4N') return { call, why: blackwoodReply(hand).why };
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
