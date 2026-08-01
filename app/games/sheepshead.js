// Sheepshead trainer module: pick drill, lead drill, table vs bots, study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  Card, Hand, SuitChip, GLYPH, rankLabel, frenchView,
  getLevelPref, setLevelPref, getCoachPref, setCoachPref, getSpeedPref, levelForSeat,
  TableControls, CoachNote, TableRing,
} from '../cards.js';
import {
  deal, newHand, pass, pick, buryAndCall, callableSuits, legalMoves, currentTurn,
  playCard, isTrump, sortHand, handPoints, FAIL_SUITS,
} from './sheepshead.engine.js';
import {
  evalPick, suggestBury, gradeLeads, botPickDecision, botBuryChoice,
  adviseMove, TALK,
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

const SUIT_WORD = { C: 'clubs', S: 'spades', H: 'hearts' };

const buryDrill = {
  id: 'bury', title: 'The Bury', hint: 'You picked up the blind. Two down, one suit to call.', kind: 'cards',
  count: 2,
  scene() {
    for (let tries = 0; tries < 300; tries++) {
      const d = deal();
      if (evalPick(d.hands[0], 2).verdict === 'pass') continue;
      const h8 = sortHand([...d.hands[0], ...d.blind]);
      const sb = suggestBury(h8);
      if (!sb.calledSuit) continue;
      return {
        hand: h8, book: sb,
        prompt: html`You picked, and the blind is in your hand (8 cards). Tap <b>two</b> cards to bury. Buried points count toward your 61.`,
      };
    }
    const d = deal();
    const h8 = sortHand([...d.hands[0], ...d.blind]);
    return { hand: h8, book: suggestBury(h8), prompt: 'You picked. Tap two cards to bury.' };
  },
  grade(scene, picks) {
    const sb = scene.book;
    const overlap = picks.filter(c => sb.bury.includes(c)).length;
    const violations = [];
    const failCount = scene.hand.filter(c => !isTrump(c)).length;
    const pickedTrump = picks.filter(isTrump);
    if (pickedTrump.length && failCount >= 3) {
      violations.push(`Burying trump (${pickedTrump.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(', ')}) shortens the one suit that wins tricks. Bury fail.`);
    }
    if (sb.calledSuit && !callableSuits(scene.hand, picks).length) {
      violations.push('That bury leaves you nothing to call: you would be forced to play alone.');
    }
    const pts = handPoints(picks), bookPts = handPoints(sb.bury);
    if (!violations.length && pts < bookPts - 6) {
      violations.push(`Only ${pts} points down when ${bookPts} were available. The bury is free money toward the 61.`);
    }
    const right = violations.length === 0 && (overlap === 2 || pts >= bookPts - 4);
    return {
      right,
      title: right ? (overlap === 2 ? 'Textbook.' : 'A sound bury.') : 'The book buries differently.',
      lead: `Book: bury ${sb.bury.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(' + ')}${sb.calledSuit ? `, call ${SUIT_WORD[sb.calledSuit]}` : ', go alone'}.`,
      detail: [...violations, ...sb.reasons],
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
      detail: right ? [] : [`Best here: ${best.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(', ')}. ${grades[best[0]][1]}`],
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
      rows: [], sheetOpen: false, // one row per scored hand, tally-style sheet
      talk: null, // {seat, text, until}: one speech bubble at a time, bots only
    };
  }
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);
  const lvl = seat => levelForSeat(g.pref, seat, g.seed);
  const say = (seat, ev, chance = 1) => {
    if (seat !== 0 && Math.random() < chance) {
      const bank = TALK[ev];
      // time-based lifetime: readable at any bot speed
      g.talk = { seat, text: bank[Math.floor(Math.random() * bank.length)], until: Date.now() + 2600 };
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      // expire the bubble with a re-render so it cannot outlive its window
      if (g.talk && Date.now() > g.talk.until) { g.talk = null; bump(); }
      if (g.lastTrick) { g.lastTrick = null; bump(); return; }
      if (s.phase === 'pick' && s.turn !== 0) {
        const seat = s.turn;
        if (botPickDecision(s, seat, lvl(seat))) { pick(s, seat); say(seat, 'pick'); }
        else { pass(s); say(seat, 'pass', 0.25); }
        bump();
      } else if (s.phase === 'alldown') {
        g.note = 'Everyone passed: re-deal.'; // ponytail: leaster mode, add when the table wants it
        say(1 + Math.floor(Math.random() * 4), 'redeal');
        g.s = newHand((s.dealer + 1) % 5); bump();
      } else if (s.phase === 'bury' && s.picker !== 0) {
        const sb = botBuryChoice(s);
        buryAndCall(s, sb.bury, sb.calledSuit);
        if (!sb.calledSuit) say(s.picker, 'alone');
        bump();
      } else if (s.phase === 'play' && currentTurn(s) !== 0) {
        const seat = currentTurn(s);
        const adv = adviseMove(s, seat, lvl(seat));
        // Talk only once team membership is PUBLIC (ace flipped or alone):
        // the advice strings encode role knowledge, and a pre-flip "schmear"
        // line would identify the hidden partner with certainty.
        if (s.aceFlipped || s.alone) {
          if (adv.why.includes('schmear')) say(seat, 'schmear', 0.4);
          else if (adv.why.includes('Rule 26')) say(seat, 'trumphigh', 0.6);
        }
        stepPlay(adv.card, seat); bump();
      }
    }, g.lastTrick ? 5000 : s.phase === 'play' ? getSpeedPref() : 350);
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
      g.rows.push({
        totals: [...g.scores], picker: s.picker,
        partner: s.partner == null ? s.picker : s.partner,
        dealer: s.dealer, stake: r.stake, bump: r.bump, win: r.win,
      });
      // one closing line: the picker crows or grumbles; if the picker is
      // human, a bot defender gets the last word instead
      const pool = [1, 2, 3, 4].filter(i => i !== s.partner);
      const spokes = s.picker !== 0 ? s.picker : pool[Math.floor(Math.random() * pool.length)];
      const onPickerSide = spokes === s.picker || spokes === s.partner;
      say(spokes, onPickerSide === r.win ? 'win' : 'loss');
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
  const fmt = t => (t > 0 ? '+' + t : String(t));
  const POS = ['me', 'l', 'tl', 'tr', 'r']; // seat index -> spot on the felt

  return html`<div class="table">
    <button class="scorestrip" title="Tap for the full score sheet"
      onClick=${() => { g.sheetOpen = true; bump(); }}>
      ${[0, 1, 2, 3, 4].map(i => html`<span class="ss ${g.scores[i] > 0 ? 'pos' : g.scores[i] < 0 ? 'neg' : ''}">${seatName(i)} ${fmt(g.scores[i])}</span>`)}
    </button>
    <${TableRing} onFeltTap=${g.lastTrick ? () => { g.lastTrick = null; bump(); } : null}
      opps=${[1, 2, 3, 4].map(seat => ({
        name: seatName(seat), badges: roleBadge(seat),
        cards: s.hands[seat].length,
        say: g.talk && g.talk.seat === seat ? g.talk.text : null,
        turn: (s.phase === 'play' && currentTurn(s) === seat && !g.lastTrick) || (s.phase === 'pick' && s.turn === seat),
      }))}>
      ${(s.calledSuit || s.alone) && html`<div class="callcorner">
        ${s.calledSuit
          ? html`<span class="callsuit suit-${s.calledSuit}">A${GLYPH[s.calledSuit]}</span><span class="calltext">${seatName(s.picker)} called</span>`
          : html`<span class="calltext">${seatName(s.picker)} alone</span>`}
      </div>`}
      ${g.note && s.phase === 'pick' && html`<p class="callinfo">${g.note}</p>`}
      <div class="trick ring5">
        ${trick.cards.map((c, i) => html`<div class="played pos-${POS[trick.seats[i]]} ${trick.winner === trick.seats[i] ? 'won' : ''}">
          <span class="who">${seatName(trick.seats[i])}</span><${Card} c=${c} toView=${toView} small />
        </div>`)}
      </div>
      ${g.lastTrick != null && html`<p class="callinfo">${seatName(g.lastTrick.winner)} takes the trick · tap here to continue</p>`}
      ${s.phase === 'pick' && html`<p class="callinfo">${seatName(s.turn)} deciding…</p>`}
    <//>

    ${s.phase === 'done' && html`<div class="verdict ${s.result.win === (s.picker === 0 || s.partner === 0) ? 'good' : 'bad'}">
      <b>${s.result.win ? 'Picker side wins' : 'Defenders win'} ${s.result.pickerPts}–${s.result.defPts}${s.result.stake > 1 ? ' · ' + (s.result.stake === 2 ? 'no schneider! ×2' : 'no trick! ×3') : ''}${!s.result.win ? ' · bump ×2' : ''}</b>
      <span class="call">${[0, 1, 2, 3, 4].map(i => `${seatName(i)} ${fmt(s.result.delta[i])}`).join(' · ')}</span>
      <button class="big" onClick=${() => { g.s = newHand((s.dealer + 1) % 5); g.buriedSel = []; g.note = ''; g.lastTrick = null; g.talk = null; bump(); }}>Next hand</button>
    </div>`}

    ${g.sheetOpen && html`<div class="tour-backdrop" onClick=${() => { g.sheetOpen = false; bump(); }}>
      <div class="tour-card sheetcard" onClick=${e => e.stopPropagation()}>
        <h2>Score sheet</h2>
        ${g.rows.length === 0 ? html`<p class="callinfo">No hands scored yet.</p>` : html`<div class="shsheet">
          ${[0, 1, 2, 3, 4].map(i => html`<div class="shhead"><span class="nm">${seatName(i)}</span><span class="tot ${g.scores[i] > 0 ? 'pos' : g.scores[i] < 0 ? 'neg' : ''}">${fmt(g.scores[i])}</span></div>`)}
          ${g.rows.map(r => [0, 1, 2, 3, 4].map(i => html`<div class="shcell">
            ${r.dealer === i ? html`<span class="corner tr">D</span>` : null}
            ${r.picker === i && r.stake * r.bump > 1 ? html`<span class="corner tl">×${r.stake * r.bump}</span>` : null}
            ${fmt(r.totals[i])}
            ${r.picker === i ? html`<span class="mark picker">${r.picker === r.partner ? 'P·A' : 'P'}</span>`
              : r.partner === i ? html`<span class="mark partner">Pa</span>` : null}
          </div>`))}
        </div>`}
        <button class="big" onClick=${() => { g.sheetOpen = false; bump(); }}>Close</button>
      </div>
    </div>`}

    ${myTurnPick && html`<div class="btnrow">
      <button class="big" onClick=${() => { pick(s, 0); bump(); }}>Pick</button>
      <button class="big alt" onClick=${() => { pass(s); bump(); }}>Pass</button>
    </div>`}
    ${myTurnPick && g.coach && (() => {
      const ev = evalPick(human, (5 - (s.dealer + 1) % 5) % 5);
      return html`<${CoachNote} text=${`Book says ${ev.verdict === 'either' ? 'either way' : ev.verdict.toUpperCase()}. ${ev.reasons[0]} ${ev.reasons[1] || ''}`} />`;
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
      <span>You ${roleBadge(0) || ''}</span>
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
  toView, study: STUDY, drills: [pickDrill, buryDrill, leadDrill], Table,
  studyNote: 'Plays by Strupp\'s "How to Play Winning 5 Handed Sheepshead" (the Milwaukee book); supplemented by pagat.com, sheepshead.org, and playsheepshead.org.',
};
