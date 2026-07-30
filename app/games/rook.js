// Rook trainer module: bid drill, nest/bury drill, study. HOUSE RULES deck:
// Rook bird worth 25 (one full color's counters), bird plays LOWEST trump,
// bids open at 50 by 5s, trump is named BEFORE the nest is seen, 4 or 6
// players with alternating seats as partners.
// ponytail: no table mode yet; auction + nest + discard loop when demanded.
import { html } from 'htm/preact';
import {
  deal, evalBid, sortRook, bestTrumpColor, evalNest, gradeNest, isTrumpRook,
  COLOR_NAME,
} from './rook.logic.js';

const TONE = { R: 'red', Y: 'gold', G: 'green', B: 'black' };

const toView = c => (c === 'BIRD'
  ? { label: 'ROOK', glyph: '🐦', tone: 'gold', ring: true }
  : { label: c.slice(1), glyph: '●', tone: TONE[c[0]], ring: false });

const CHOICES = [0, 55, 70, 85, 100, 115];

const bidDrill = {
  id: 'bid', title: 'The Bid', hint: 'Long color plus the bird: bid for the nest.', kind: 'choice',
  scene() {
    const d = deal();
    return {
      hand: d.hands[0],
      prompt: html`Partnership rook, 125 points in play, nest of 5. Bidding opens at 50, up by 5s, and you will name trump BEFORE seeing the nest. What is this hand worth?`,
      choices: CHOICES.map(b => ({ id: String(b), label: b === 0 ? 'Pass' : String(b) })),
    };
  },
  grade(scene, answer) {
    const a = Number(answer);
    const v = evalBid(scene.hand);
    const ai = CHOICES.indexOf(a), bi = CHOICES.indexOf(v.bid);
    const off = Math.abs(ai - bi);
    return {
      right: off === 0,
      title: off === 0 ? 'On the money.' : off === 1 ? 'One band off: defensible.' : 'The hand disagrees.',
      lead: `Book: ${v.bid === 0 ? 'PASS' : 'about ' + v.bid}.`,
      detail: v.reasons,
    };
  },
};

const nestDrill = {
  id: 'nest', title: 'The Nest', hint: 'You named trump blind. Now bury five.', kind: 'cards',
  count: 5,
  scene() {
    const d = deal();
    const trump = bestTrumpColor(d.hands[0]);
    const all14 = sortRook([...d.hands[0], ...d.kitty]);
    return {
      hand: all14, trump,
      prompt: html`You won the bid and named <b>${COLOR_NAME[trump]}</b> trump before touching the nest (house rules). The five nest cards are now mixed into your hand. Tap FIVE to bury.`,
    };
  },
  grade(scene, picks) {
    const r = gradeNest(scene.hand, scene.trump, picks);
    const label = c => (c === 'BIRD' ? 'ROOK' : `${COLOR_NAME[c[0]]} ${c.slice(1)}`);
    return {
      right: r.right,
      title: r.right ? (r.overlap === 5 ? 'Textbook.' : 'A sound bury.') : r.violations.length ? 'That bury gives points away.' : 'The book buries differently.',
      lead: `Book bury: ${r.book.bury.map(label).join(', ')}.`,
      detail: [...r.violations, ...r.book.reasons],
    };
  },
};

// House-rule study. General doctrine from rookgame.com strategy series and
// pagat.com, adapted to bird-low, 25-point bird, 125-point deck, blind nest.
const STUDY = [
  {
    title: 'Level 1 · The deck and the deal',
    body: [
      'Four colors (red, yellow, green, black), 5 through 14, plus the Rook bird: 41 cards.',
      'Counters: each 5 worth 5, each 10 and 14 worth 10, and the Rook worth 25, the same as one whole color. 125 points in play.',
      '14 is the high card of each color. The Rook is always trump and always the LOWEST trump: it wins nothing on its own, it is 25 points that must be protected home.',
      'Four or six players, partners alternating around the table. 9 cards each with 5 to the nest at four players; 6 each with 5 down at six.',
      'Follow the led color; trump wins; trick winner leads. Whoever takes the LAST trick captures the buried nest and its points.',
    ],
  },
  {
    title: 'Level 2 · Bidding',
    body: [
      'Bids open at 50 and rise by 5s. The high bidder must NAME TRUMP FIRST, then pick up the nest and bury five. Make the bid or lose the whole bid ("set"); defenders always keep what they capture.',
      'Because the nest is sealed until after you commit to a color, bid and name on your nine cards alone. The nest is upside, never income: it averages about 15 points but swings from nothing to the bird.',
      'Count assets: a long color, two 14s, a void, the Rook. Two assets: opening range. Each genuine extra asset is worth another band.',
      'Length beats tops: six trump with weak tops outplays four big ones.',
      'Holding the Rook cuts both ways here: one more trump for length, but 25 points that CANNOT win its own trick. Value it like a fat counter that needs an escort, not like a boss card.',
      'Raise over your own partner only with real extras; sustained enemy raising means the suit tops sit with them, not in the nest.',
    ],
  },
  {
    title: 'Level 2 · The nest and the bury',
    body: [
      'Keep every trump, the Rook first among them. Burying trump shortens the only suit that wins tricks.',
      'Aim to leave yourself two-suited: trump plus one strong side color. Void whole colors so you can trump their first lead.',
      'Shed unprotected strays: a lone 14 or 10 with no cover is delivered to the enemy the moment that color is led twice.',
      'Buried counters ride to whoever wins the LAST trick. Bury points only if your side plans to be standing at the end, and fight for that last trick either way.',
    ],
  },
  {
    title: 'Level 3 · Play and the set',
    body: [
      'Declarer pulls trump early and repeatedly, but NEVER leads the Rook: it is the one trump that loses to every other trump. Slip it under your own winning trick.',
      'Defenders: catching the declarer\'s Rook is a 25-point swing, the biggest single play in the game. Force trump leads while their high trump is gone.',
      'The set math: points-to-set = bid minus what the declarer has banked, out of 125. Close hands come down to 5 points, so count.',
      'Sluff the smallest counter that still sets; hoard the 10s until the set is safe.',
      'Once the bid is safe on offense, stop fighting and bank counters onto partner\'s winners.',
      'At six players your partnership is three seats: two hands you cannot see are still on your side, so trust the alternating pattern and feed points to any teammate\'s winner.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Overbidding short, top-heavy suits, or bidding on nest dreams you have not seen.',
      'Leading the Rook as if it were the high trump. It is the lowest: it dies to a 5 of trump.',
      'Burying trump, or keeping bare 14s instead of shedding them.',
      'Losing count of banked points out of 125.',
      'Raising a committed partner without a monster.',
      'Sleepwalking through the last trick and donating the nest.',
    ],
  },
];

export const game = {
  id: 'rook', name: 'Rook', glyph: '♜',
  tagline: 'Name it blind, bury five, make the number.',
  toView, study: STUDY, drills: [bidDrill, nestDrill], Table: null,
  studyNote: 'House rules: 25-point Rook played as lowest trump, 125 points in play, bids from 50, nest sealed until trump is named.',
};
