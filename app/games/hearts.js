// Hearts trainer module: pass-three drill, table vs bots, study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Card, Hand, GLYPH, rankLabel, frenchView } from '../cards.js';
import {
  deal, newHand, submitPass, startPlay, legalMoves, currentTurn, playCard,
  PASS_CYCLE, isPoint,
} from './hearts.engine.js';
import { passValue, bestPass, botPass, botPlay } from './hearts.coach.js';

const toView = c => frenchView(c, x => x === 'QS');
const cardLabel = c => `${rankLabel(c[0])}${GLYPH[c[1]]}`;

// ---- drill -----------------------------------------------------------------
const passDrill = {
  id: 'pass', title: 'Pass Three', hint: 'Which three cards leave the safest hand?', kind: 'cards',
  count: 3,
  scene() {
    const dir = ['left', 'right', 'across'][Math.floor(Math.random() * 3)];
    return {
      hand: deal()[0], dir,
      prompt: html`Passing <b>${dir}</b>. Pick the three cards to ship.`,
    };
  },
  grade(scene, picks) {
    const best = bestPass(scene.hand);
    const overlap = picks.filter(c => best.includes(c)).length;
    const blunder = picks.find(c => passValue(scene.hand, c)[0] < 0);
    const right = overlap >= 2 && !blunder;
    return {
      right,
      title: right ? (overlap === 3 ? 'Textbook.' : 'Sound pass.') : blunder ? 'One of those should never leave your hand.' : 'The book passes differently.',
      lead: `Book pass: ${best.map(cardLabel).join(', ')}.`,
      detail: picks.map(c => `${cardLabel(c)}: ${passValue(scene.hand, c)[1]}`),
    };
  },
};

// ---- table -----------------------------------------------------------------
const NAMES = ['You', 'Fly', 'Moss', 'Bella'];

function Table({ onResult }) {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) ref.current = { s: prep(newHand(0)), handNo: 0, scores: [0, 0, 0, 0], passSel: [], showTrick: null };
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);

  function prep(hand) {
    // Bots pass immediately; hold hands go straight to play.
    if (hand.phase === 'pass') for (const seat of [1, 2, 3]) submitPass(hand, seat, botPass(hand.hands[seat]));
    if (hand.phase === 'play') startPlay(hand);
    return hand;
  }

  function afterPlay() {
    if (s.lastTrick && s.trick.length === 0) { g.showTrick = s.lastTrick; s.lastTrick = null; }
    if (s.phase === 'done' && !s.counted) {
      s.counted = true;
      s.result.delta.forEach((d, i) => { g.scores[i] += d; });
      onResult({ won: s.result.delta[0] === Math.min(...s.result.delta), delta: -s.result.delta[0] });
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (g.showTrick) { g.showTrick = null; bump(); return; }
      if (s.phase === 'play' && currentTurn(s) !== 0) {
        playCard(s, currentTurn(s), botPlay(s, currentTurn(s)));
        afterPlay(); bump();
      }
    }, g.showTrick ? 1100 : 400);
    return () => clearTimeout(t);
  });

  const myPass = s.phase === 'pass' && !s.passed[0];
  const myPlay = s.phase === 'play' && currentTurn(s) === 0 && !g.showTrick;
  const legal = myPlay ? legalMoves(s, 0) : null;
  const trick = g.showTrick || { cards: s.trick, seats: s.trickSeats, winner: null };
  const over = Math.max(...g.scores) >= 100;

  return html`<div class="table">
    <div class="opps">${[1, 2, 3].map(seat => html`<div class="opp ${s.phase === 'play' && currentTurn(s) === seat ? 'turn' : ''}">
      <span>${NAMES[seat]}</span><span class="score">${g.scores[seat]}</span>
    </div>`)}</div>

    <div class="felt">
      <p class="callinfo">Hand ${g.handNo + 1} · pass ${s.passDir} · hearts ${s.heartsBroken ? 'broken' : 'unbroken'} · lowest score wins, game ends over 100</p>
      <div class="trick">
        ${trick.cards.map((c, i) => html`<div class="played ${trick.winner === trick.seats[i] ? 'won' : ''}">
          <span class="who">${NAMES[trick.seats[i]]}</span><${Card} c=${c} toView=${toView} small />
        </div>`)}
      </div>
      ${g.showTrick && html`<p class="callinfo">${NAMES[g.showTrick.winner]} takes it${g.showTrick.cards.some(isPoint) ? ' — with points' : ''}</p>`}
    </div>

    ${s.phase === 'done' && html`<div class="verdict ${s.result.delta[0] === Math.min(...s.result.delta) ? 'good' : 'bad'}">
      <b>${s.result.shooter >= 0 ? `${NAMES[s.result.shooter]} shot the moon!` : `Hand over: ${s.result.delta.map((d, i) => `${NAMES[i]} +${d}`).join(' · ')}`}</b>
      <span class="call">Totals: ${g.scores.map((sc, i) => `${NAMES[i]} ${sc}`).join(' · ')}${over ? ` · GAME: ${NAMES[g.scores.indexOf(Math.min(...g.scores))]} wins` : ''}</span>
      <button class="big" onClick=${() => {
        if (over) { g.scores = [0, 0, 0, 0]; g.handNo = 0; } else g.handNo++;
        g.s = prep(newHand(g.handNo)); g.passSel = []; bump();
      }}>${over ? 'New game' : 'Next hand'}</button>
    </div>`}

    ${myPass && html`<div class="btnrow"><span class="scene">Pick three to pass ${s.passDir}.</span>
      ${g.passSel.length === 3 && html`<button class="big" onClick=${() => {
        submitPass(s, 0, g.passSel); startPlay(s); g.passSel = []; bump();
      }}>Pass them</button>`}
    </div>`}

    <div class="me ${myPlay || myPass ? 'turn' : ''}">
      <span>You</span><span class="score">${g.scores[0]}</span>
      <span class="score">trick ${Math.min(s.trickNo + 1, 13)}/13</span>
    </div>
    <${Hand} cards=${s.hands[0]} toView=${toView} legal=${legal} selected=${g.passSel}
      onPlay=${myPlay ? (c => { playCard(s, 0, c); afterPlay(); bump(); }) :
        myPass ? (c => { g.passSel = g.passSel.includes(c) ? g.passSel.filter(x => x !== c) : [...g.passSel, c].slice(-3); bump(); }) : null} />
  </div>`;
}

// ---- study -----------------------------------------------------------------
const STUDY = [
  {
    title: 'The game',
    body: [
      'Full 52-card deck, four players, no partners. Lowest score wins when someone crosses 100.',
      'Every heart taken costs 1 point. The queen of spades costs 13. There are 26 points in every hand, and you want none of them.',
      'The 2♣ holder leads it to start. No points may be played on the first trick.',
      'Hearts cannot be LED until a heart has been discarded on another suit ("breaking hearts").',
    ],
  },
  {
    title: 'Passing three',
    body: [
      'Pass rotates: left, right, across, then a hold hand with no pass.',
      'Ship the queen of spades unless you hold three or more low spades to guard her.',
      'Ace and king of spades are queen-bait: pass them unless you have spade length.',
      'NEVER pass low spades: they are your armor against the queen.',
      'Pass high hearts; keep low hearts as escape cards.',
      'Aim passes at creating a void so you can dump points early.',
    ],
  },
  {
    title: 'Play',
    body: [
      'Duck as high as you can: play the highest card that still loses the trick.',
      'Lead low spades relentlessly if you do not hold the queen: someone has to eat her.',
      'Keep track of who is void where: a void player turns your safe lead into 13 points.',
      'Take an early clean trick rather than holding only winners for the end: the last tricks are where the hearts land.',
    ],
  },
  {
    title: 'Shooting the moon',
    body: [
      'Take ALL 26 points and everyone else eats 26 instead.',
      'Shoot only with overwhelming high cards and a long strong suit, and preferably long hearts.',
      'The defense against a shooter: take one heart yourself. Cheap insurance, watch for the player winning every point trick.',
    ],
  },
];

export const game = {
  id: 'hearts', name: 'Hearts', glyph: '💔',
  tagline: 'Avoid the points, dodge the queen, or shoot the moon.',
  toView, study: STUDY, drills: [passDrill], Table,
  studyNote: 'Standard hearts: pass rotation, no points on trick one, moon adds 26 to the others.',
};
