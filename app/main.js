// Sheepdog — sheepshead trainer. Shell + 4 screens: Pick, Lead, Table (bots), Study.
import { html, render } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  deal, newHand, pass, pick, buryAndCall, callableSuits, legalMoves, currentTurn,
  playCard, isTrump, points, handPoints, sortHand, effSuit, FAIL_SUITS,
} from './engine.js';
import { evalPick, suggestBury, gradeLeads, botPickDecision, botPlay } from './coach.js';
import { STUDY } from './study.js';

// ---- persistence -----------------------------------------------------------
const KEY = 'sheepdog.v1';
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.pick && s.lead && s.game) return s;
  } catch { /* fall through */ }
  return { pick: { right: 0, total: 0, streak: 0 }, lead: { right: 0, total: 0, streak: 0 }, game: { hands: 0, won: 0, score: 0 } };
}
let STATS = loadStats();
const saveStats = () => localStorage.setItem(KEY, JSON.stringify(STATS));

// ---- card widgets ----------------------------------------------------------
const GLYPH = { C: '♣', S: '♠', H: '♥', D: '♦' };
const SUIT_NAME = { C: 'clubs', S: 'spades', H: 'hearts', D: 'diamonds' };
const rankLabel = r => (r === 'T' ? '10' : r);

function Card({ c, onClick, dim, sel, small }) {
  const red = c[1] === 'H' || c[1] === 'D';
  return html`<button
    class="card ${red ? 'red' : ''} ${isTrump(c) ? 'trump' : ''} ${dim ? 'dim' : ''} ${sel ? 'sel' : ''} ${small ? 'small' : ''} ${onClick ? 'live' : ''}"
    onClick=${onClick} disabled=${!onClick}>
    <span class="rank">${rankLabel(c[0])}</span><span class="suit">${GLYPH[c[1]]}</span>
  </button>`;
}

const Hand = ({ cards, onPlay, legal, selected }) => html`<div class="hand">
  ${cards.map(c => html`<${Card} key=${c} c=${c}
    onClick=${onPlay && (!legal || legal.includes(c)) ? () => onPlay(c) : null}
    dim=${legal && !legal.includes(c)} sel=${selected && selected.includes(c)} />`)}
</div>`;

const SuitChip = su => html`<span class="chip suit-${su}">${GLYPH[su]} ${SUIT_NAME[su]}</span>`;

// ---- shell -----------------------------------------------------------------
const SCREENS = { pick: PickTrainer, lead: LeadTrainer, table: Table, study: Study };

function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || '');
  useEffect(() => {
    const f = () => setRoute(location.hash.slice(1) || '');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const Screen = SCREENS[route];
  return html`<div class="shell">
    <header>
      ${route ? html`<a class="back" href="#">←</a>` : html`<span class="paw">\u{1F415}</span>`}
      <h1>${route ? { pick: 'Pick or Pass', lead: 'Find the Lead', table: 'At the Table', study: 'Study' }[route] : 'Sheepdog'}</h1>
    </header>
    ${Screen ? html`<${Screen} />` : html`<${Home} />`}
  </div>`;
}

function Home() {
  const pct = s => (s.total ? Math.round((100 * s.right) / s.total) + '%' : '—');
  return html`<div class="home">
    <p class="tag">Learn sheepshead by making the decisions that matter.</p>
    <a class="tile" href="#pick"><b>Pick or Pass</b><span>Deal after deal: should you take the blind? ${pct(STATS.pick)} · ${STATS.pick.total} hands</span></a>
    <a class="tile" href="#lead"><b>Find the Lead</b><span>Given the call and your role, choose the opening lead. ${pct(STATS.lead)} · ${STATS.lead.total} hands</span></a>
    <a class="tile" href="#table"><b>At the Table</b><span>Play full 5-handed hands against four bots. ${STATS.game.hands} hands, ${STATS.game.won} won, score ${STATS.game.score > 0 ? '+' : ''}${STATS.game.score}</span></a>
    <a class="tile" href="#study"><b>Study</b><span>The rules, the trump order, and when to pick.</span></a>
  </div>`;
}

// ---- Pick or Pass ----------------------------------------------------------
const SEAT_WORDS = ['first to pick, leading the hand', 'second to pick', 'third to pick', 'fourth to pick', 'last to pick, on the end (dealer)'];

function freshPickDeal() {
  return { hand: deal().hands[0], seatPos: Math.floor(Math.random() * 5) };
}

function PickTrainer() {
  const [d, setD] = useState(freshPickDeal);
  const [answer, setAnswer] = useState(null);
  const ev = evalPick(d.hand, d.seatPos);
  const grade = choice => {
    const right = ev.verdict === 'either' || ev.verdict === choice;
    STATS.pick.total++; if (right) { STATS.pick.right++; STATS.pick.streak++; } else STATS.pick.streak = 0;
    saveStats();
    setAnswer({ choice, right });
  };
  return html`<div class="drill">
    <p class="scene">You are <b>${SEAT_WORDS[d.seatPos]}</b>.</p>
    <${Hand} cards=${d.hand} />
    ${!answer ? html`<div class="btnrow">
      <button class="big" onClick=${() => grade('pick')}>Pick</button>
      <button class="big alt" onClick=${() => grade('pass')}>Pass</button>
    </div>` : html`<div class="verdict ${answer.right ? 'good' : 'bad'}">
      <b>${answer.right ? (ev.verdict === 'either' ? 'Defensible.' : 'Correct.') : 'Not this time.'}</b>
      <span class="call">Book says: ${ev.verdict === 'either' ? 'either way' : ev.verdict.toUpperCase()}.</span>
      <ul>${ev.reasons.map(r => html`<li>${r}</li>`)}</ul>
      <button class="big" onClick=${() => { setD(freshPickDeal()); setAnswer(null); }}>Next deal</button>
    </div>`}
    <p class="stats">${STATS.pick.right}/${STATS.pick.total} · streak ${STATS.pick.streak}</p>
  </div>`;
}

// ---- Find the Lead ---------------------------------------------------------
function freshLeadDeal() {
  for (let tries = 0; tries < 200; tries++) {
    const d = deal();
    const role = ['picker', 'partner', 'defender'][Math.floor(Math.random() * 3)];
    let hand = d.hands[0], calledSuit = null;
    if (role === 'picker') {
      const h8 = sortHand([...d.hands[0], ...d.blind]);
      if (evalPick(d.hands[0], 0).verdict === 'pass') continue; // plausible picks only
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
    return { hand, role, calledSuit };
  }
  return { hand: deal().hands[0], role: 'defender', calledSuit: 'C' }; // never in practice
}

const TIER_WORDS = { best: 'The book lead.', good: 'A sound lead.', okay: 'Playable, not best.', bad: 'The book frowns.', terrible: 'Never this.' };

function LeadTrainer() {
  const [d, setD] = useState(freshLeadDeal);
  const [answer, setAnswer] = useState(null);
  const { grades, bestTier } = gradeLeads(d.hand, d.role, d.calledSuit);
  const choose = c => {
    const [tier, why] = grades[c];
    const right = tier === bestTier;
    STATS.lead.total++; if (right) { STATS.lead.right++; STATS.lead.streak++; } else STATS.lead.streak = 0;
    saveStats();
    setAnswer({ c, tier, why, right });
  };
  const best = d.hand.filter(c => grades[c][0] === bestTier);
  return html`<div class="drill">
    <p class="scene">You are the <b>${d.role}</b>. Called ace: ${SuitChip(d.calledSuit)}. You lead the first trick.</p>
    <${Hand} cards=${d.hand} onPlay=${answer ? null : choose} />
    ${answer && html`<div class="verdict ${answer.right ? 'good' : 'bad'}">
      <b>${TIER_WORDS[answer.tier]}</b>
      <span class="call">${rankLabel(answer.c[0])}${GLYPH[answer.c[1]]}: ${answer.why}</span>
      ${!answer.right && html`<span class="call">Best here: ${best.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(', ')} — ${grades[best[0]][1]}</span>`}
      <button class="big" onClick=${() => { setD(freshLeadDeal()); setAnswer(null); }}>Next deal</button>
    </div>`}
    <p class="stats">${STATS.lead.right}/${STATS.lead.total} · streak ${STATS.lead.streak}</p>
  </div>`;
}

// ---- At the Table ----------------------------------------------------------
const BOTS = ['Moss', 'Fly', 'Rex', 'Bella']; // seats 1..4; you are seat 0
const seatName = seat => (seat === 0 ? 'You' : BOTS[seat - 1]);

function Table() {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = { s: newHand(4), scores: [0, 0, 0, 0, 0], lastTrick: null, buriedSel: [], note: '' };
  }
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);

  // Bot driver: one bot action per timeout, so the table moves at a readable pace.
  useEffect(() => {
    const t = setTimeout(() => {
      if (g.lastTrick) { g.lastTrick = null; bump(); return; }
      if (s.phase === 'pick' && s.turn !== 0) {
        if (botPickDecision(s, s.turn)) pick(s, s.turn); else pass(s);
        bump();
      } else if (s.phase === 'alldown') {
        g.note = 'Everyone passed: re-deal.'; // ponytail: leaster mode, add when the table wants it
        g.s = newHand((s.dealer + 1) % 5); bump();
      } else if (s.phase === 'bury' && s.picker !== 0) {
        const sb = suggestBury(s.hands[s.picker]);
        buryAndCall(s, sb.bury, sb.calledSuit); bump();
      } else if (s.phase === 'play' && currentTurn(s) !== 0) {
        stepPlay(g, botPlay(s, currentTurn(s)), currentTurn(s)); bump();
      }
    }, g.lastTrick ? 1300 : s.phase === 'play' ? 500 : 350);
    return () => clearTimeout(t);
  });

  function stepPlay(g, card, seat) {
    const before = [...g.s.trick], seats = [...g.s.trickSeats];
    playCard(g.s, seat, card);
    if (g.s.trick.length === 0 && before.length === 4) {
      g.lastTrick = { cards: [...before, card], seats: [...seats, seat], winner: g.s.lastTrickWinner };
    }
    if (g.s.phase === 'done' && !g.s.counted) {
      g.s.counted = true;
      const r = g.s.result;
      r.delta.forEach((d, i) => { g.scores[i] += d; });
      STATS.game.hands++; STATS.game.score += r.delta[0];
      const mySide = (g.s.picker === 0 || g.s.partner === 0) ? r.win : !r.win;
      if (mySide) STATS.game.won++;
      saveStats();
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
          <span class="who">${seatName(trick.seats[i])}</span><${Card} c=${c} small />
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
      <button class="hint" onClick=${() => { g.note = 'Coach: ' + evalPick(human, (5 - (s.dealer + 1) % 5) % 5).verdict.toUpperCase(); bump(); }}>Coach?</button>
    </div>`}
    ${myTurnPick && g.note.startsWith('Coach') && html`<p class="callinfo">${g.note}</p>`}

    ${myBury && html`<p class="scene">Tap two cards to bury${g.buriedSel.length === 2 ? ', then call a suit' : ''}.
      ${callOpts.map(su => html`<button class="hint" onClick=${() => { buryAndCall(s, g.buriedSel, su); g.buriedSel = []; bump(); }}>Call ${GLYPH[su]}</button>`)}
      ${g.buriedSel.length === 2 && !callOpts.length && html`<button class="hint" onClick=${() => { buryAndCall(s, g.buriedSel, null); g.buriedSel = []; bump(); }}>Go alone</button>`}
    </p>`}

    <div class="me ${myPlay || myTurnPick || myBury ? 'turn' : ''}">
      <span>You ${roleBadge(0) || ''}</span><span class="score">${g.scores[0]}</span>
      <span class="score">trick ${Math.min(s.trickNo + 1, 6)}/6</span>
    </div>
    <${Hand} cards=${human} legal=${legal} selected=${g.buriedSel}
      onPlay=${myPlay ? (c => { stepPlay(g, c, 0); bump(); }) :
        myBury ? (c => { g.buriedSel = g.buriedSel.includes(c) ? g.buriedSel.filter(x => x !== c) : [...g.buriedSel, c].slice(-2); bump(); }) : null} />
  </div>`;
}

// ---- Study -----------------------------------------------------------------
function Study() {
  return html`<div class="study">
    ${STUDY.map(sec => html`<section><h2>${sec.title}</h2><ul>${sec.body.map(b => html`<li>${b}</li>`)}</ul></section>`)}
    <p class="stats">Distilled from pagat.com, sheepshead.org, playsheepshead.org, and the Wergin picking guidelines.</p>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
