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

const STUDY = [
  {
    title: 'The deck',
    body: [
      'Four colors (red, yellow, green, black), 5 through 14, plus the Rook bird: 41 cards.',
      'Counters: 5s are worth 5, 10s and 14s worth 10, the Rook worth 20. 120 points per hand.',
      '14 is the high card of each color. The Rook is the LOWEST trump (house rules vary; agree before the deal).',
      'Four players in partnerships, 9 cards each, 5 to the kitty (the "nest").',
    ],
  },
  {
    title: 'The auction',
    body: [
      'Bidding opens at 70 and rises by 5s; the high bidder takes the kitty, discards 5, and names trump.',
      'Your bid is a contract: capture at least that many of the 120 points or lose the whole bid ("the set").',
      'Count your hand: 10 per expected trump, extra for 13s/14s in your color, the bird is worth a full bump.',
      'The kitty is worth roughly one bid step: it adds cards, but you have not seen them. Never pay 15 for it.',
      'Partner covers about 20-30 points of any bid. Bidding 110+ means YOUR hand does nearly everything.',
    ],
  },
  {
    title: 'The discard (Kentucky Discard)',
    body: [
      'Winning the kitty means discarding 5. Discarded counters are safe: they count for your side in most house rules; agree first.',
      'Discard toward voids in your off colors so trump can take the counter tricks.',
      'Never discard trump, and never strand your 14s bare if the color might get led twice.',
    ],
  },
  {
    title: 'Play',
    body: [
      'Follow the led color; trump wins the trick; the winner leads next.',
      'Declarer pulls trump first, exactly like every other trump game.',
      'Defense: bank your 5s and 10s onto your partner\'s winning tricks, and make the declarer trump early and often.',
      'The set is the game. If the declarer bid 95, defenders need only 26 of the 120 to break the contract.',
    ],
  },
];

export const game = {
  id: 'rook', name: 'Rook', glyph: '♜',
  tagline: 'Bid the kitty, name the trump, make the number.',
  toView, study: STUDY, drills: [bidDrill], Table: null,
  studyNote: 'Kentucky Discard, 120-point base deck, matching Tally\'s rook scorer.',
};
