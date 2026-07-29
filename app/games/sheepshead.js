// Sheepshead trainer module: pick drill, lead drill, table vs bots, study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  Card, Hand, SuitChip, GLYPH, rankLabel, frenchView,
  getLevelPref, setLevelPref, getCoachPref, setCoachPref, levelForSeat,
  TableControls, CoachNote,
} from '../cards.js';
import {
  deal, newHand, pass, pick, buryAndCall, callableSuits, legalMoves, currentTurn,
  playCard, isTrump, sortHand, FAIL_SUITS,
} from './sheepshead.engine.js';
import {
  evalPick, suggestBury, gradeLeads, botPickDecision, botPlay, botBuryChoice,
  adviseMove,
} from './sheepshead.coach.js';
import { STUDY } from './sheepshead.study.js';

const toView = c => frenchView(c, isTrump);

// ---- drills ----------------------------------------------------------------
const SEAT_WORDS = ['first to pick, leading the hand', 'second to pick', 'third to pick', 'fourth to pick', 'last to pick, on the end (dealer)'];
const TIER_WORDS = { best: 'The book lead.', good: 'A sound lead.', okay: 'Playable, not best.', bad: 'The book frowns.', terrible: 'Never this.' };

const pickDrill = {
  id: 'pick', title: 'Pick or Pass', hint: 'Should you take the blind?', kind: 'choice',
  scene() {
    const seatPos = Math.floor(Math.random() * 5);
    return {
      hand: deal().hands[0], seatPos,
      prompt: html`You are <b>${SEAT_WORDS[seatPos]}</b>.`,
      choices: [{ id: 'pick', label: 'Pick' }, { id: 'pass', label: 'Pass' }],
    };
  },
  grade(scene, answer) {
    const ev = evalPick(scene.hand, scene.seatPos);
    const right = ev.verdict === 'either' || ev.verdict === answer;
    return {
      right,
      title: right ? (ev.verdict === 'either' ? 'Defensible.' : 'Correct.') : 'Not this time.',
      lead: `Book says: ${ev.verdict === 'either' ? 'either way' : ev.verdict.toUpperCase()}.`,
      detail: ev.reasons,
    };
  },
};

function leadScene() {
  for (let tries = 0; tries < 200; tries++) {
    const d = deal();
    const role = ['picker', 'partner', 'defender'][Math.floor(Math.random() * 3)];
    let hand = d.hands[0], calledSuit = null;
    if (role === 'picker') {
      const h8 = sortHand([...d.hands[0], ...d.blind]);
      if (evalPick(d.hands[0], 0).verdict === 'pass') continue;
      const sb = suggestBury(h8);
      if (!sb.calledSuit) continue;
      calledSuit = sb.calledSuit;
      hand = sortHand(h8.filter(c => !sb.bury.includes(c)));
    } else if (role === 'partner') {
      const aces = FAIL_SUITS.filter(su => d.hands[0].includes('A' + su));
      if (!aces.length) continue;
      calledSuit = aces[Math.floor(Math.random() * aces.length)];
    } else {
      const opts = FAIL_SUITS.filter(su => !d.hands[0].includes('A' + su));
      if (!opts.length) continue;
      calledSuit = opts[Math.floor(Math.random() * opts.length)];
    }
    return {
      hand, role, calledSuit,
      prompt: html`You are the <b>${role}</b>. Called ace: ${SuitChip(calledSuit)}. You lead the first trick.`,
    };
  }
  return { hand: deal().hands[0], role: 'defender', calledSuit: 'C', prompt: 'You lead.' };
}

const leadDrill = {
  id: 'lead', title: 'Find the Lead', hint: 'Given the call and your role, what do you lead?', kind: 'card',
  scene: leadScene,
  grade(scene, card) {
    const { grades, bestTier } = gradeLeads(scene.hand, scene.role, scene.calledSuit);
    const [tier, why] = grades[card];
    const right = tier === bestTier;
    const best = scene.hand.filter(c => grades[c][0] === bestTier);
    return {
      right,
      title: TIER_WORDS[tier],
      lead: `${rankLabel(card[0])}${GLYPH[card[1]]}: ${why}`,
      detail: right ? [] : [`Best here: ${best.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(', ')} — ${grades[best[0]][1]}`],
    };
  },
};

// ---- table -----------------------------------------------------------------
const BOTS = ['Moss', 'Fly', 'Rex', 'Bella'];
const seatName = seat => (seat === 0 ? 'You' : BOTS[seat - 1]);

function Table({ onResult }) {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = {
      s: newHand(4), scores: [0, 0, 0, 0, 0], lastTrick: null, buriedSel: [], note: '',
      pref: getLevelPref(), coach: getCoachPref(), seed: 0,
    };
  }
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);
  const lvl = seat => levelForSeat(g.pref, seat, g.seed);

  useEffect(() => {
    const t = setTimeout(() => {
      if (g.lastTrick) { g.lastTrick = null; bump(); return; }
      if (s.phase === 'pick' && s.turn !== 0) {
        if (botPickDecision(s, s.turn, lvl(s.turn))) pick(s, s.turn); else pass(s);
        bump();
      } else if (s.phase === 'alldown') {
        g.note = 'Everyone passed: re-deal.'; // ponytail: leaster mode, add when the table wants it
        g.s = newHand((s.dealer + 1) % 5); bump();
      } else if (s.phase === 'bury' && s.picker !== 0) {
        const sb = botBuryChoice(s, lvl(s.picker));
        buryAndCall(s, sb.bury, sb.calledSuit); bump();
      } else if (s.phase === 'play' && currentTurn(s) !== 0) {
        stepPlay(botPlay(s, currentTurn(s), lvl(currentTurn(s))), currentTurn(s)); bump();
      }
    }, g.lastTrick ? 1300 : s.phase === 'play' ? 500 : 350);
    return () => clearTimeout(t);
  });

  function stepPlay(card, seat) {
    const before = [...s.trick], seats = [...s.trickSeats];
    playCard(s, seat, card);
    if (s.trick.length === 0 && before.length === 4) {
      g.lastTrick = { cards: [...before, card], seats: [...seats, seat], winner: s.lastTrickWinner };
    }
    if (s.phase === 'done' && !s.counted) {
      s.counted = true;
      const r = s.result;
      r.delta.forEach((d, i) => { g.scores[i] += d; });
      onResult({ won: (s.picker === 0 || s.partner === 0) ? r.win : !r.win, delta: r.delta[0] });
    }
  }

  const human = s.hands[0];
  const myTurnPick = s.phase === 'pick' && s.turn === 0;
  const myBury = s.phase === 'bury' && s.picker === 0;
  const myPlay = s.phase === 'play' && currentTurn(s) === 0 && !g.lastTrick;
  const legal = myPlay ? legalMoves(s, 0) : null;
  const callOpts = myBury && g.buriedSel.length === 2 ? callableSuits(s.hands[0], g.buriedSel) : [];
  const trick = g.lastTrick || { cards: s.trick, seats: s.trickSeats, winner: null };
  const roleBadge = seat =>
    seat === s.picker ? html`<span class="badge">picker</span>` :
    (s.aceFlipped && seat === s.partner) ? html`<span class="badge alt">partner</span>` : null;

  return html`<div class="table">
    <div class="opps">${[1, 2, 3, 4].map(seat => html`<div class="opp ${s.phase === 'play' && currentTurn(s) === seat ? 'turn' : ''}">
      <span>${seatName(seat)}</span>${roleBadge(seat)}<span class="score">${g.scores[seat]}</span>
    </div>`)}</div>

    <div class="felt">
      ${s.calledSuit && html`<p class="callinfo">${seatName(s.picker)} picked · called ${SuitChip(s.calledSuit)}</p>`}
      ${s.alone && html`<p class="callinfo">${seatName(s.picker)} is going alone</p>`}
      ${g.note && s.trickNo === 0 && !s.calledSuit && html`<p class="callinfo">${g.note}</p>`}
      <div class="trick">
        ${trick.cards.map((c, i) => html`<div class="played ${trick.winner === trick.seats[i] ? 'won' : ''}">
          <span class="who">${seatName(trick.seats[i])}</span><${Card} c=${c} toView=${toView} small />
        </div>`)}
      </div>
      ${g.lastTrick != null && html`<p class="callinfo">${seatName(g.lastTrick.winner)} takes the trick</p>`}
      ${s.phase === 'pick' && html`<p class="callinfo">${seatName(s.turn)} deciding…</p>`}
    </div>

    ${s.phase === 'done' && html`<div class="verdict ${s.result.win === (s.picker === 0 || s.partner === 0) ? 'good' : 'bad'}">
      <b>${s.result.win ? 'Picker side wins' : 'Defenders win'} ${s.result.pickerPts}–${s.result.defPts}${s.result.stake > 1 ? ' · ' + (s.result.stake === 2 ? 'schneider!' : 'no-tricker!') : ''}</b>
      <span class="call">${[0, 1, 2, 3, 4].map(i => `${seatName(i)} ${s.result.delta[i] > 0 ? '+' : ''}${s.result.delta[i]}`).join(' · ')}</span>
      <button class="big" onClick=${() => { g.s = newHand((s.dealer + 1) % 5); g.buriedSel = []; g.note = ''; bump(); }}>Next hand</button>
    </div>`}

    ${myTurnPick && html`<div class="btnrow">
      <button class="big" onClick=${() => { pick(s, 0); bump(); }}>Pick</button>
      <button class="big alt" onClick=${() => { pass(s); bump(); }}>Pass</button>
    </div>`}
    ${myTurnPick && g.coach && (() => {
      const ev = evalPick(human, (5 - (s.dealer + 1) % 5) % 5);
      return html`<${CoachNote} text=${`Book says ${ev.verdict === 'either' ? 'either way' : ev.verdict.toUpperCase()}: ${ev.reasons[ev.reasons.length - 1]}`} />`;
    })()}

    ${myBury && html`<p class="scene">Tap two cards to bury${g.buriedSel.length === 2 ? ', then call a suit' : ''}.
      ${callOpts.map(su => html`<button class="hint" onClick=${() => { buryAndCall(s, g.buriedSel, su); g.buriedSel = []; bump(); }}>Call ${GLYPH[su]}</button>`)}
      ${g.buriedSel.length === 2 && !callOpts.length && html`<button class="hint" onClick=${() => { buryAndCall(s, g.buriedSel, null); g.buriedSel = []; bump(); }}>Go alone</button>`}
    </p>`}
    ${myBury && g.coach && (() => {
      const sb = suggestBury(s.hands[0]);
      return html`<${CoachNote} text=${sb.reasons.join(' ')} />`;
    })()}
    ${myPlay && g.coach && (() => {
      const adv = adviseMove(s, 0, 'expert');
      return html`<${CoachNote} text=${`${rankLabel(adv.card[0])}${GLYPH[adv.card[1]]}: ${adv.why}`} />`;
    })()}

    <${TableControls} pref=${g.pref} coach=${g.coach}
      onLevel=${l => { g.pref = l; setLevelPref(l); g.seed = (g.seed + 1) % 3; bump(); }}
      onCoach=${on => { g.coach = on; setCoachPref(on); bump(); }} />
    <div class="me ${myPlay || myTurnPick || myBury ? 'turn' : ''}">
      <span>You ${roleBadge(0) || ''}</span><span class="score">${g.scores[0]}</span>
      <span class="score">trick ${Math.min(s.trickNo + 1, 6)}/6</span>
    </div>
    <${Hand} cards=${human} toView=${toView} legal=${legal} selected=${g.buriedSel}
      onPlay=${myPlay ? (c => { stepPlay(c, 0); bump(); }) :
        myBury ? (c => { g.buriedSel = g.buriedSel.includes(c) ? g.buriedSel.filter(x => x !== c) : [...g.buriedSel, c].slice(-2); bump(); }) : null} />
  </div>`;
}

export const game = {
  id: 'sheepshead', name: 'Sheepshead', glyph: '🐑',
  tagline: 'The Wisconsin classic: pick, bury, call an ace.',
  toView, study: STUDY, drills: [pickDrill, leadDrill], Table,
  studyNote: 'Distilled from pagat.com, sheepshead.org, playsheepshead.org, and the Wergin picking guidelines.',
};
