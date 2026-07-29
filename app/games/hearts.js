// Hearts trainer module: pass-three drill, table vs bots, study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  Card, Hand, GLYPH, rankLabel, frenchView,
  getLevelPref, setLevelPref, getCoachPref, setCoachPref, levelForSeat,
  TableControls, CoachNote,
} from '../cards.js';
import {
  deal, newHand, submitPass, startPlay, legalMoves, currentTurn, playCard,
  PASS_CYCLE, isPoint,
} from './hearts.engine.js';
import { passValue, bestPass, botPass, botPlay, adviseMove } from './hearts.coach.js';

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
  if (!ref.current) {
    ref.current = {
      handNo: 0, scores: [0, 0, 0, 0], passSel: [], showTrick: null,
      pref: getLevelPref(), coach: getCoachPref(), seed: 0,
    };
    ref.current.s = prep(newHand(0), ref.current);
  }
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);
  const lvl = seat => levelForSeat(g.pref, seat, g.seed);

  function prep(hand, gg) {
    // Bots pass immediately; hold hands go straight to play.
    if (hand.phase === 'pass') for (const seat of [1, 2, 3]) submitPass(hand, seat, botPass(hand.hands[seat], levelForSeat(gg.pref, seat, gg.seed)));
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
        playCard(s, currentTurn(s), botPlay(s, currentTurn(s), lvl(currentTurn(s))));
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
      ${g.showTrick && html`<p class="callinfo">${NAMES[g.showTrick.winner]} takes it${g.showTrick.cards.some(isPoint) ? ', with points' : ''}</p>`}
    </div>

    ${s.phase === 'done' && html`<div class="verdict ${s.result.delta[0] === Math.min(...s.result.delta) ? 'good' : 'bad'}">
      <b>${s.result.shooter >= 0 ? `${NAMES[s.result.shooter]} shot the moon!` : `Hand over: ${s.result.delta.map((d, i) => `${NAMES[i]} +${d}`).join(' · ')}`}</b>
      <span class="call">Totals: ${g.scores.map((sc, i) => `${NAMES[i]} ${sc}`).join(' · ')}${over ? ` · GAME: ${NAMES[g.scores.indexOf(Math.min(...g.scores))]} wins` : ''}</span>
      <button class="big" onClick=${() => {
        if (over) { g.scores = [0, 0, 0, 0]; g.handNo = 0; } else g.handNo++;
        g.s = prep(newHand(g.handNo), g); g.passSel = []; bump();
      }}>${over ? 'New game' : 'Next hand'}</button>
    </div>`}

    ${myPass && html`<div class="btnrow"><span class="scene">Pick three to pass ${s.passDir}.</span>
      ${g.passSel.length === 3 && html`<button class="big" onClick=${() => {
        submitPass(s, 0, g.passSel); startPlay(s); g.passSel = []; bump();
      }}>Pass them</button>`}
    </div>`}

    ${myPass && g.coach && (() => {
      const best = bestPass(s.hands[0]);
      return html`<${CoachNote} text=${`Book pass: ${best.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(', ')}. ${passValue(s.hands[0], best[0])[1]}`} />`;
    })()}
    ${myPlay && g.coach && (() => {
      const adv = adviseMove(s, 0, 'expert');
      return html`<${CoachNote} text=${`${rankLabel(adv.card[0])}${GLYPH[adv.card[1]]}: ${adv.why}`} />`;
    })()}
    <${TableControls} pref=${g.pref} coach=${g.coach}
      onLevel=${l => { g.pref = l; setLevelPref(l); g.seed = (g.seed + 1) % 3; bump(); }}
      onCoach=${on => { g.coach = on; setCoachPref(on); bump(); }} />
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
// Sources: pagat.com, Mark's Hearts Tips (advanced), Joe Andrews hearts
// columns, Wikibooks hearts strategy, Solitaired/RarePike guides.
const STUDY = [
  {
    title: 'Level 1 · The game',
    body: [
      'Full 52-card deck, four players, no partners. Lowest score wins when someone crosses 100.',
      'Every heart costs 1 point; the queen of spades costs 13. 26 points per hand, and you want none.',
      'The 2♣ opens. No points on the first trick. Hearts cannot be LED until broken.',
      'Default play: the highest card that still LOSES the trick. Duck high.',
      'Keep a low club so the opening trick cannot force you onto lead with winners.',
    ],
  },
  {
    title: 'Level 2 · Passing doctrine',
    body: [
      'The direction changes the pass. LEFT: your victim plays right after you; ship the lone dangerous card (the queen, a bare high spade) because it gets used against the table immediately.',
      'RIGHT: they act BEFORE you, so you see their card first; pass conservatively and keep flexible holdings.',
      'ACROSS: least information; pass neutral and never arm a strong player with moon material.',
      'Spade guards: below 3 low spades, pass the queen. 3 is a bare guard, 5+ is comfortable. Keep her with guards and choose your victim.',
      'A♠/K♠ with short spades are queen-bait: ship them. NEVER pass low spades.',
      'Pass in pairs that compound: a low club with a high spade, or two high cards of one suit to strip it.',
      'Pass high hearts, keep low hearts as escapes; build a club or diamond void, never a heart void you cannot use.',
    ],
  },
  {
    title: 'Level 2 · Play',
    body: [
      'Lead low spades relentlessly when you do not hold the queen: someone has to eat her.',
      'Count in fours: tricks times four cards tells you what is gone; watch who showed void where.',
      'A void opponent turns your safe lead into 13 points: route leads around known voids.',
      'Read the pass you received: a queen plus spades, or three high hearts, is someone recruiting you into their plan.',
    ],
  },
  {
    title: 'Level 3 · The moon and the endgame',
    body: [
      'Shoot with 8+ hearts including the ace, or 4-or-fewer hearts backed by a 6+ card suit headed A-K. Anything less is a donation.',
      'Moon tells: early tricks won with high cards, hearts untouched, an oddly low pass into your hand.',
      'Moon defense: hold one stopper heart (the ace is best) and spend a point to save 26. Taking one heart off a shooter is the cheapest insurance in cards.',
      'By the last 3-4 tricks, map the exact remaining hearts and the queen: advanced play is scripted, not reactive.',
      'Exit cards are tempo: keep a losing card to hand the lead away, or the endgame forces you to lead into the pain.',
      'Play the score, not just the hand: the table routes the queen toward the leader, and dumps her on the LAST-place player when protecting the race. Expect it when you lead.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Hoarding A♠/K♠ with two spades under them.',
      'Passing without a plan: random high cards instead of compounding pairs.',
      'Treating all three pass directions the same.',
      'Flying blind into the last four tricks.',
      'Missing the moon tells until trick nine.',
      'Minimizing your own points while the game leader coasts to the win.',
    ],
  },
];

export const game = {
  id: 'hearts', name: 'Hearts', glyph: '💔',
  tagline: 'Avoid the points, dodge the queen, or shoot the moon.',
  toView, study: STUDY, drills: [passDrill], Table,
  studyNote: 'Standard hearts: pass rotation, no points on trick one, moon adds 26 to the others.',
};
