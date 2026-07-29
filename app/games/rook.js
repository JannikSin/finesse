// Rook trainer module: bid drill + study. Kentucky Discard, 120-point base
// deck to match Tally's rook scorer (5s=5, 10s=10, 14s=10, bird=20).
// ponytail: no table mode yet; auction + kitty + discard loop when demanded.
import { html } from 'htm/preact';
import { deal, evalBid } from './rook.logic.js';

const TONE = { R: 'red', Y: 'gold', G: 'green', B: 'black' };

const toView = c => (c === 'BIRD'
  ? { label: 'ROOK', glyph: '🐦', tone: 'gold', ring: true }
  : { label: c.slice(1), glyph: '●', tone: TONE[c[0]], ring: false });

const CHOICES = [0, 75, 85, 95, 105, 115];

const bidDrill = {
  id: 'bid', title: 'The Bid', hint: 'Long color + the bird = the kitty is yours.', kind: 'choice',
  scene() {
    const d = deal();
    return {
      hand: d.hands[0],
      prompt: html`Partnership rook, 120-point deck, kitty of 5. Bidding opens at 70, up by 5s. What is this hand worth?`,
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
      lead: `Book: ${v.bid === 0 ? 'PASS' : v.bid}.`,
      detail: v.reasons,
    };
  },
};

// Sources: rookgame.com official rules + strategy series, pagat.com,
// gamerules.com. Numbers below follow the 41-card, bids-70-120 family.
const STUDY = [
  {
    title: 'Level 1 · The deck and the deal',
    body: [
      'Four colors (red, yellow, green, black), 5 through 14, plus the Rook bird: 41 cards.',
      'Counters: each 5 worth 5, each 10 and 14 worth 10, the Rook worth 20. 120 points per hand.',
      '14 is the high card of each color. The Rook is trump; whether it plays HIGH or LOW is a house rule, agree before the deal (high is the common default).',
      'Four players in partnerships, 9 cards each, 5 to the nest (kitty).',
      'Follow the led color; trump wins; trick winner leads. Whoever takes the LAST trick also captures the discarded nest and its points.',
    ],
  },
  {
    title: 'Level 2 · Bidding',
    body: [
      'Bids open at 70, rise by 5s. High bidder takes the nest, discards 5, names trump. Make the bid or LOSE the whole bid ("set"); defenders always keep what they capture.',
      'Count assets: a real trump suit, the Rook, two 14s, a void. Two assets: open 70. Three: 75. Four: 80. Each extra genuine asset is one more step.',
      'Length beats tops: six trump with weak tops outplays four big ones. "The longer your suit, the fewer high cards you need."',
      'The nest averages about 15 points (120 × 5/41) but swings 0-45. Bid your NINE cards; the nest is upside, not income.',
      'Loose 5s and 10s in side suits are liabilities when you are declaring: points you can lose, not points you control.',
      'Raise over your own partner only to 100, and past 100 only with 7+ trump including 3 of the top 5.',
      'Sustained enemy raising is information: the Rook and the suit tops are with them, not waiting in the nest. Pass good hands into hot auctions.',
    ],
  },
  {
    title: 'Level 2 · The discard',
    body: [
      'Aim to leave yourself two-suited: trump plus one strong side color.',
      'Void whole colors: a void trumps the first lead of it.',
      'Shed unprotected lone 14s and 10s: a bare big counter is 10 points delivered to whoever leads the color.',
      'Never discard trump. Point cards in the nest come back to whoever wins the last trick, so bury points only when your side expects to win it.',
    ],
  },
  {
    title: 'Level 3 · Play and the set',
    body: [
      'Declarer pulls trump early and repeatedly: be the only one holding trump when the endgame arrives.',
      'Name trump by length first (7+ is a lock); a shorter but topped suit can still pull all outstanding trump in 3-4 leads.',
      'Defense runs on the set math: points-to-set = bid minus what declarer has banked. Close hands are decided by 5 points, so COUNT.',
      'Sluff the smallest counter that still sets; hoard the 10s and the Rook until the set is safe, then dump everything unprotected.',
      'Offense mirror: once the bid is safe, stop fighting and bank counters onto partner\'s winners.',
      'Fight for the last trick: the buried nest can swing 20+ points after trump is gone.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Overbidding short, top-heavy suits.',
      'Keeping bare 14s instead of discarding them.',
      'Not pulling trump as declarer.',
      'Losing count of banked points and fighting for tricks that no longer matter, or conceding hands still makeable.',
      'Raising a committed partner without a monster.',
      'Bidding into a hot auction because "my hand is good."',
      'Sleepwalking through the last trick and donating the nest.',
    ],
  },
];

export const game = {
  id: 'rook', name: 'Rook', glyph: '♜',
  tagline: 'Bid the kitty, name the trump, make the number.',
  toView, study: STUDY, drills: [bidDrill], Table: null,
  studyNote: 'Kentucky Discard, 120-point base deck, matching Tally\'s rook scorer.',
};
