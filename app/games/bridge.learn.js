// Per-convention practice: CONSTRUCTED hands, not random deals. Each scene
// builds a 13-card hand that lands exactly in one convention's decision zone
// (both seats of the partnership take turns), states the auction so far, and
// grades against the same system functions the bots use, so the coach, the
// bots, and the trainer can never disagree. Where the engine has no function
// yet (doubles, Gerber, Rule of 20) the scene computes the book answer itself.
// Pure module: imports engine + bid only.

import { SUITS, RANKS, hcp, sortHand, suitCards } from './bridge.engine.js';
import {
  openingBid, responseTo, staymanReply, transferReply, blackwoodReply,
  callLabel, aces, getOpenMin,
} from './bridge.bid.js';

const HON = 'AKQJ';
const suitDeck = su => RANKS.map(r => r + su);
const shuffled = (rng, arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Build a hand with exact suit lengths (lens: {S,H,D,C}, sum 13) inside an
// HCP window, by random fill then honor swaps toward the window.
export function buildHand(rng, lens, lo = 0, hi = 40) {
  const hand = SUITS.flatMap(su => shuffled(rng, suitDeck(su)).slice(0, lens[su]));
  const has = c => hand.includes(c);
  for (let i = 0; i < 60 && hcp(hand) < lo; i++) {
    // swap in the smallest missing honor whose suit holds a spot to give up
    let done = false;
    for (const h of ['J', 'Q', 'K', 'A']) {
      for (const su of shuffled(rng, SUITS)) {
        if (!lens[su] || has(h + su)) continue;
        const spot = hand.filter(c => c[1] === su && !HON.includes(c[0]))
          .sort((a, b) => RANKS.indexOf(a[0]) - RANKS.indexOf(b[0]))[0];
        if (!spot) continue;
        hand[hand.indexOf(spot)] = h + su;
        done = true; break;
      }
      if (done) break;
    }
    if (!done) break;
  }
  for (let i = 0; i < 60 && hcp(hand) > hi; i++) {
    // swap out the smallest honor for a missing spot in its suit
    const hs = hand.filter(c => HON.includes(c[0]))
      .sort((a, b) => HON.indexOf(b[0]) - HON.indexOf(a[0]));
    let done = false;
    for (const h of hs) {
      const spot = shuffled(rng, suitDeck(h[1]))
        .filter(c => !HON.includes(c[0]) && !has(c))[0];
      if (!spot) continue;
      hand[hand.indexOf(h)] = spot;
      done = true; break;
    }
    if (!done) break;
  }
  return sortHand(hand);
}

// Force a suit to hold at least n of its top honors (for good-suit scenes).
function strengthenSuit(rng, hand, su, n) {
  const tops = ['A', 'K', 'Q'].map(r => r + su);
  let have = tops.filter(c => hand.includes(c)).length;
  for (const t of tops) {
    if (have >= n) break;
    if (hand.includes(t)) continue;
    const spot = hand.filter(c => c[1] === su && !HON.includes(c[0]))
      .sort((a, b) => RANKS.indexOf(a[0]) - RANKS.indexOf(b[0]))[0];
    if (!spot) break;
    hand[hand.indexOf(spot)] = t;
    have++;
  }
  return sortHand(hand);
}

const lensOf = perm => ({ S: perm[0], H: perm[1], D: perm[2], C: perm[3] });
// balanced fills around fixed major counts
function balancedLens(rng, s, h) {
  const rest = 13 - s - h;
  const d = Math.max(2, Math.min(5, Math.floor(rng() * 3) + Math.floor(rest / 2) - 1));
  const c = rest - d;
  if (c < 2 || c > 5) return balancedLens(rng, s, h);
  return { S: s, H: h, D: d, C: c };
}

const callChoices = ids => ids.map(b => ({ id: b, label: b === 'X' ? 'Double' : callLabel(b) }));
const strip = pairs => pairs.map(([who, call]) => ({ who, call }));

// Each generator returns {hand, strip, prompt, choices, answer, why} or null
// to signal "constraints missed, rebuild". practiceScene retries.
const GEN = {
  stayman: [
    rng => { // responder: ask or stay quiet
      const major = pick(rng, ['S', 'H']);
      const lens = balancedLens(rng, major === 'S' ? 4 : 3, major === 'H' ? 4 : 3);
      const strong = rng() < 0.6;
      const hand = buildHand(rng, lens, strong ? 8 : 4, strong ? 12 : 6);
      const v = responseTo('1N', hand);
      if (![['2C'], ['P']].flat().includes(v.call)) return null;
      return {
        hand, strip: strip([['Partner', '1N'], ['RHO', 'P'], ['You', null]]),
        prompt: 'Partner opens 1NT (15-17). Do you have the Stayman hand?',
        choices: callChoices(['P', '2C', '2N', '3N']),
        answer: v.call, why: v.why,
      };
    },
    rng => { // opener replies to the ask
      const s = pick(rng, [2, 3, 4]);
      const h = pick(rng, s === 4 ? [2, 3, 4] : [2, 3, 4]);
      if (s + h > 8) return null;
      const hand = buildHand(rng, balancedLens(rng, Math.max(s, 2), Math.max(h, 2)), 15, 17);
      const v = staymanReply(hand);
      return {
        hand, strip: strip([['You', '1N'], ['LHO', 'P'], ['Partner', '2C'], ['RHO', 'P'], ['You', null]]),
        prompt: 'You opened 1NT. Partner bids 2♣, Stayman: got a 4-card major?',
        choices: callChoices(['2D', '2H', '2S']),
        answer: v.call, why: v.why,
      };
    },
  ],
  transfer: [
    rng => { // responder transfers at any strength
      const major = pick(rng, ['S', 'H']);
      const len5 = pick(rng, [5, 6]);
      const lens = major === 'S' ? lensOf([len5, 2, 13 - len5 - 5, 3]) : lensOf([2, len5, 13 - len5 - 5, 3]);
      const band = pick(rng, [[0, 5], [6, 9], [10, 14]]);
      const hand = buildHand(rng, lens, band[0], band[1]);
      const v = responseTo('1N', hand);
      if (v.call !== (major === 'H' ? '2D' : '2H')) return null;
      return {
        hand, strip: strip([['Partner', '1N'], ['RHO', 'P'], ['You', null]]),
        prompt: `Partner opens 1NT. You hold a 5+ card major and ${hcp(hand)} HCP. Your call?`,
        choices: callChoices(['P', '2C', '2D', '2H', '2S']),
        answer: v.call, why: v.why,
      };
    },
    rng => { // opener must complete
      const t = pick(rng, ['2D', '2H']);
      const hand = buildHand(rng, balancedLens(rng, pick(rng, [2, 3]), pick(rng, [2, 3])), 15, 17);
      const v = transferReply(t);
      return {
        hand, strip: strip([['You', '1N'], ['LHO', 'P'], ['Partner', t], ['RHO', 'P'], ['You', null]]),
        prompt: `You opened 1NT. Partner bids ${callLabel(t)}, a Jacoby transfer. Your call?`,
        choices: callChoices(['P', '2H', '2S', '2N']),
        answer: v.call, why: v.why,
      };
    },
  ],
  jacoby2n: [
    rng => { // the 12/13 boundary: strong raise vs limit raise
      const su = pick(rng, ['H', 'S']);
      const lens = su === 'H' ? lensOf([3, 4, 3, 3]) : lensOf([4, 3, 3, 3]);
      const strong = rng() < 0.55;
      const hand = buildHand(rng, lens, strong ? 13 : 10, strong ? 16 : 12);
      const v = responseTo('1' + su, hand);
      if (!['2N', '3' + su].includes(v.call)) return null;
      return {
        hand, strip: strip([['Partner', '1' + su], ['RHO', 'P'], ['You', null]]),
        prompt: `Partner opens ${callLabel('1' + su)}. You hold 4 trumps and ${hcp(hand)} HCP. Strong raise or limit raise?`,
        choices: callChoices(['2' + su, '3' + su, '2N', '4' + su]),
        answer: v.call, why: v.why,
      };
    },
  ],
  limitraise: [
    rng => { // all three bands of the thermometer
      const su = pick(rng, ['H', 'S']);
      const four = rng() < 0.6;
      const lens = su === 'H'
        ? lensOf([3, four ? 4 : 3, 3, four ? 3 : 4])
        : lensOf([four ? 4 : 3, 3, 3, four ? 3 : 4]);
      const band = pick(rng, four ? [[10, 12], [13, 15], [6, 9]] : [[6, 9], [6, 9]]);
      const hand = buildHand(rng, lens, band[0], band[1]);
      const v = responseTo('1' + su, hand);
      if (!['2' + su, '3' + su, '2N'].includes(v.call)) return null;
      return {
        hand, strip: strip([['Partner', '1' + su], ['RHO', 'P'], ['You', null]]),
        prompt: `Partner opens ${callLabel('1' + su)}. Which band of the raise thermometer is this?`,
        choices: callChoices(['2' + su, '3' + su, '2N', 'P']),
        answer: v.call, why: v.why,
      };
    },
  ],
  weaktwo: [
    rng => { // open the weak two (or pass junk)
      const su = pick(rng, ['S', 'H', 'D']);
      const good = rng() < 0.7;
      const lens = { S: 2, H: 2, D: 2, C: 2 };
      lens[su] = 6;
      const others = SUITS.filter(x => x !== su);
      lens[pick(rng, others)] += 1; // 6-3-2-2
      let hand = buildHand(rng, lens, 5, 9);
      if (good) hand = strengthenSuit(rng, hand, su, 2);
      const v = openingBid(hand);
      if (!['2' + su, 'P'].includes(v.call)) return null;
      return {
        hand, strip: strip([['You', null]]),
        prompt: 'First seat, nobody has bid. Weak two, or discipline?',
        choices: callChoices(['P', '2D', '2H', '2S', '3' + su]),
        answer: v.call, why: v.why,
      };
    },
    rng => { // responding to partner's weak two
      const su = pick(rng, ['S', 'H']);
      const fit = rng() < 0.7;
      const lens = su === 'S' ? lensOf([fit ? 3 : 1, 4, 3, fit ? 3 : 5]) : lensOf([4, fit ? 3 : 1, 3, fit ? 3 : 5]);
      const band = pick(rng, [[8, 11], [14, 16], [4, 7]]);
      const hand = buildHand(rng, lens, band[0], band[1]);
      const v = responseTo('2' + su, hand);
      return {
        hand, strip: strip([['Partner', '2' + su], ['RHO', 'P'], ['You', null]]),
        prompt: `Partner opens a weak ${callLabel('2' + su)}. Further the barrage, bid game, or leave it?`,
        choices: callChoices(['P', '3' + su, '4' + su, '2N']),
        answer: v.call, why: v.why,
      };
    },
  ],
  strong2c: [
    rng => { // 22+ opens 2C; 20-21 balanced opens 2NT
      const monster = rng() < 0.6;
      const hand = buildHand(rng, balancedLens(rng, pick(rng, [3, 4]), pick(rng, [3, 4])), monster ? 22 : 20, monster ? 24 : 21);
      const v = openingBid(hand);
      if (!['2C', '2N'].includes(v.call)) return null;
      return {
        hand, strip: strip([['You', null]]),
        prompt: 'First seat with a monster. Which strong opening?',
        choices: callChoices(['1C', '2C', '2N', '3N']),
        answer: v.call, why: v.why,
      };
    },
    rng => { // the waiting response
      const hand = buildHand(rng, balancedLens(rng, pick(rng, [2, 3, 4]), pick(rng, [2, 3])), 0, 7);
      const v = responseTo('2C', hand);
      return {
        hand, strip: strip([['Partner', '2C'], ['RHO', 'P'], ['You', null]]),
        prompt: `Partner opens 2♣, the strong artificial bid. You hold ${hcp(hand)} HCP of nothing. Your call?`,
        choices: callChoices(['P', '2D', '2N', '3C']),
        answer: v.call, why: v.why,
      };
    },
  ],
  blackwood: [
    rng => { // answer the ace ask
      const n = Math.floor(rng() * 4);
      const lens = lensOf([4, 3, 3, 3]);
      let hand = buildHand(rng, lens, 8, 14);
      const aceCards = SUITS.map(su => 'A' + su);
      // force exactly n aces
      let held = hand.filter(c => c[0] === 'A');
      while (held.length > n) {
        const out = held.pop();
        const spot = suitDeck(out[1]).filter(c => !HON.includes(c[0]) && !hand.includes(c))[0];
        hand[hand.indexOf(out)] = spot;
      }
      while (held.length < n) {
        const want = aceCards.find(a => !hand.includes(a));
        const spot = hand.filter(c => c[1] === want[1] && !HON.includes(c[0]))[0]
          || hand.filter(c => !HON.includes(c[0]))[0];
        if (!spot) return null;
        hand[hand.indexOf(spot)] = want;
        held = hand.filter(c => c[0] === 'A');
      }
      hand = sortHand(hand);
      if (aces(hand) !== n) return null;
      const v = blackwoodReply(hand);
      return {
        hand, strip: strip([['You', '1S'], ['Partner', '2N'], ['You', '4S'], ['Partner', '4N'], ['You', null]]),
        prompt: 'Spades are agreed and partner bids 4NT, Blackwood. Count your aces and climb the ladder.',
        choices: callChoices(['5C', '5D', '5H', '5S']),
        answer: v.call, why: v.why,
      };
    },
  ],
  gerber: [
    rng => { // Gerber reply, one floor below Blackwood
      const n = Math.floor(rng() * 4);
      let hand = buildHand(rng, balancedLens(rng, 3, 3), 15, 17);
      let held = hand.filter(c => c[0] === 'A');
      while (held.length > n) {
        const out = held.pop();
        const spot = suitDeck(out[1]).filter(c => !HON.includes(c[0]) && !hand.includes(c))[0];
        hand[hand.indexOf(out)] = spot;
        held = hand.filter(c => c[0] === 'A');
      }
      while (held.length < n) {
        const want = SUITS.map(su => 'A' + su).find(a => !hand.includes(a));
        const spot = hand.filter(c => c[1] === want[1] && !HON.includes(c[0]))[0]
          || hand.filter(c => !HON.includes(c[0]))[0];
        if (!spot) return null;
        hand[hand.indexOf(spot)] = want;
        held = hand.filter(c => c[0] === 'A');
      }
      hand = sortHand(hand);
      if (aces(hand) !== n || hcp(hand) < 14 || hcp(hand) > 18) return null;
      const answer = ['4D', '4H', '4S', '4N'][n];
      return {
        hand, strip: strip([['You', '1N'], ['LHO', 'P'], ['Partner', '4C'], ['RHO', 'P'], ['You', null]]),
        prompt: 'You opened 1NT and partner jumps to 4♣: Gerber, asking aces. Same ladder as Blackwood, one floor down.',
        choices: callChoices(['4D', '4H', '4S', '4N']),
        answer,
        why: `The Gerber ladder mirrors Blackwood one level lower: 4♦ 0 or 4, 4♥ 1, 4♠ 2, 4NT 3. You hold ${n}.`,
      };
    },
  ],
  takeout: [
    rng => { // double, overcall, or pass over their opening
      const their = pick(rng, ['H', 'D', 'C']);
      const kind = pick(rng, ['double', 'double', 'overcall', 'pass']);
      const others = SUITS.filter(s => s !== their);
      let hand, answer, why;
      if (kind === 'double') {
        const lens = { S: 4, H: 4, D: 4, C: 4 };
        lens[their] = 1;
        hand = buildHand(rng, lens, 12, 15);
        answer = 'X';
        why = `${hcp(hand)} HCP, a singleton ${callLabel('1' + their).slice(1)} and 4 cards in every unbid suit: the perfect takeout double. Partner picks the suit.`;
      } else if (kind === 'overcall') {
        // spades always outrank their 1-level opening
        const lens = { S: 5, H: 2, D: 3, C: 3 };
        hand = strengthenSuit(rng, buildHand(rng, lens, 10, 14), 'S', 2);
        answer = '1S';
        why = `A good 5-card suit and ${hcp(hand)} HCP: overcall, do not double. Doubling promises support for every unbid suit.`;
      } else {
        hand = buildHand(rng, { S: 3, H: 3, D: 3, C: 4 }, 7, 10);
        answer = 'P';
        why = `${hcp(hand)} flat points, no 5-card suit, no shortness in theirs: no double, no overcall. Pass and defend.`;
      }
      const oc = '1S';
      return {
        hand, strip: strip([['RHO', '1' + their], ['You', null]]),
        prompt: `Right-hand opponent opens ${callLabel('1' + their)}. Double, overcall, or pass?`,
        choices: callChoices(['P', 'X', oc, '1N']),
        answer, why,
      };
    },
  ],
  overcall: [
    rng => { // quality suit or discipline
      const their = pick(rng, ['C', 'D']);
      const kind = pick(rng, ['overcall', 'overcall', 'pass']);
      let hand, answer, why;
      const su = pick(rng, ['S', 'H']);
      if (kind === 'overcall') {
        const lens = { S: 2, H: 2, D: 3, C: 3 };
        lens[su] = 5;
        const total = Object.values(lens).reduce((a, b) => a + b, 0);
        lens.D += 13 - total;
        hand = strengthenSuit(rng, buildHand(rng, lens, 9, 14), su, 2);
        answer = '1' + su;
        why = `Two of the top three honors in a 5-card suit and ${hcp(hand)} HCP: the textbook one-level overcall.`;
      } else {
        hand = buildHand(rng, { S: 4, H: 3, D: 3, C: 3 }, 9, 12);
        // make the 4-card suit honor-thin so nothing is biddable
        answer = 'P';
        why = `${hcp(hand)} HCP but no 5-card suit: overcalling on four cards hands declarer the lead through you. Pass; a reopening double may come later.`;
      }
      return {
        hand, strip: strip([['RHO', '1' + their], ['You', null]]),
        prompt: `They open ${callLabel('1' + their)}. Is your suit worth showing?`,
        choices: callChoices(['P', '1' + su, '2' + su, '1N']),
        answer, why,
      };
    },
  ],
  rule20: [
    rng => { // 11-counts: shape opens, flat passes
      const shapely = rng() < 0.6;
      const su = pick(rng, ['S', 'H']);
      const lens = shapely
        ? (su === 'S' ? lensOf([5, 2, 4, 2]) : lensOf([2, 5, 4, 2]))
        : lensOf([4, 3, 3, 3]);
      const hand = buildHand(rng, lens, 11, 11);
      if (hcp(hand) !== 11) return null;
      const lengths = SUITS.map(s => suitCards(hand, s).length).sort((a, b) => b - a);
      const r20 = 11 + lengths[0] + lengths[1];
      const answer = r20 >= 20 ? '1' + su : 'P';
      const why = r20 >= 20
        ? `Rule of 20: 11 HCP + ${lengths[0]} + ${lengths[1]} = ${r20}. Open the long suit. (House note: the bots here open all 12s but stay stricter on 11s.)`
        : `Rule of 20: 11 HCP + ${lengths[0]} + ${lengths[1]} = ${r20}. Under 20, flat hand: pass. 4-3-3-3 never qualifies.`;
      return {
        hand, strip: strip([['You', null]]),
        prompt: `First seat, 11 HCP (opening floor here: ${getOpenMin()}). Does the Rule of 20 open this?`,
        choices: callChoices(['P', '1' + su, '1N', '1D']),
        answer, why,
      };
    },
  ],
};

export const PRACTICE_IDS = Object.keys(GEN);

export function practiceScene(convId, rng = Math.random) {
  const gens = GEN[convId];
  if (!gens) return null;
  for (let t = 0; t < 60; t++) {
    const scene = pick(rng, gens)(rng);
    if (!scene) continue;
    if (scene.hand.length !== 13 || new Set(scene.hand).size !== 13) continue;
    if (!scene.choices.some(c => c.id === scene.answer)) continue;
    return scene;
  }
  return null;
}
