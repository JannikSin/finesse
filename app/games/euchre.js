// Euchre trainer module: call drill (both rounds), lead drill, table vs bots, study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Card, Hand, SuitChip, GLYPH, rankLabel } from '../cards.js';
import {
  deal, newHand, callRound1, callRound2, discard, legalMoves, currentTurn,
  playCard, isTrump, teamOf, SUITS, sortHand,
} from './euchre.engine.js';
import {
  evalCall1, evalCall2, gradeLeads, discardChoice, botCall1, botCall2, botPlay,
} from './euchre.coach.js';

const viewFor = t => c => ({
  label: rankLabel(c[0]),
  glyph: GLYPH[c[1]],
  tone: c[1] === 'H' || c[1] === 'D' ? 'red' : 'black',
  ring: t ? isTrump(c, t) : false,
});

const SEATS = ['you', 'your left-hand opponent', 'your partner', 'your right-hand opponent'];
const seatWord = (seat, dealer) =>
  seat === dealer ? 'the dealer (you)' :
  dealer === (seat + 2) % 4 ? 'your partner' :
  dealer === (seat + 1) % 4 ? 'the opponent on your left' : 'the opponent on your right';

// ---- drills ----------------------------------------------------------------
const callDrill = {
  id: 'call', title: 'Order or Pass', hint: 'Round one and round two calling, with the next convention.', kind: 'choice',
  scene() {
    const d = deal();
    const dealer = Math.floor(Math.random() * 4);
    const round = Math.random() < 0.65 ? 1 : 2;
    const hand = round === 2 ? d.hands[0] : d.hands[0];
    const choices = round === 1
      ? [{ id: 'pass', label: 'Pass' }, { id: 'order', label: dealer === 0 ? 'Pick it up' : 'Order it up' }, { id: 'alone', label: 'Alone' }]
      : [
        ...(dealer === 0 ? [] : [{ id: 'pass', label: 'Pass' }]),
        ...SUITS.filter(su => su !== d.upcard[1]).map(su => ({ id: su, label: `Call ${GLYPH[su]}` })),
      ];
    return {
      hand, upcard: d.upcard, dealer, round, choices,
      prompt: round === 1
        ? html`The upcard is <b>${rankLabel(d.upcard[0])}${GLYPH[d.upcard[1]]}</b>. Dealer is <b>${seatWord(0, dealer)}</b>. Your call.`
        : html`The <b>${rankLabel(d.upcard[0])}${GLYPH[d.upcard[1]]}</b> was turned down. Dealer is <b>${seatWord(0, dealer)}</b>.${dealer === 0 ? ' Stuck: you must call.' : ''} Your call.`,
    };
  },
  grade(scene, answer) {
    const v = scene.round === 1
      ? evalCall1(scene.hand, 0, scene.dealer, scene.upcard)
      : evalCall2(scene.hand, 0, scene.dealer, scene.upcard);
    const right = v.accept.includes(answer);
    const label = a => a === 'pass' ? 'PASS' : a === 'order' ? 'ORDER' : a === 'alone' ? 'ALONE' : `CALL ${GLYPH[a]}`;
    return {
      right,
      title: right ? 'Correct.' : 'Not this time.',
      lead: `Book says: ${label(v.action)}.`,
      detail: v.reasons,
    };
  },
};

const TIER_WORDS = { best: 'The book lead.', good: 'A sound lead.', okay: 'Playable, not best.', bad: 'The book frowns.', terrible: 'Never this.' };

const leadDrill = {
  id: 'lead', title: 'Find the Lead', hint: 'Makers pull trump; defenders cash aces.', kind: 'card',
  scene() {
    const d = deal();
    const t = SUITS[Math.floor(Math.random() * 4)];
    const role = Math.random() < 0.5 ? 'maker' : 'defender';
    return {
      hand: sortHand(d.hands[0], t), trump: t, role, toView: viewFor(t),
      prompt: html`Trump is ${SuitChip(t)}. <b>${role === 'maker' ? 'Your side called it' : 'The other side called it'}</b>. You lead.`,
    };
  },
  grade(scene, card) {
    const { grades, bestTier } = gradeLeads(scene.hand, scene.role, scene.trump);
    const [tier, why] = grades[card];
    const best = scene.hand.filter(c => grades[c][0] === bestTier);
    return {
      right: tier === bestTier,
      title: TIER_WORDS[tier],
      lead: `${rankLabel(card[0])}${GLYPH[card[1]]}: ${why}`,
      detail: tier === bestTier ? [] : [`Best here: ${best.map(c => rankLabel(c[0]) + GLYPH[c[1]]).join(', ')} — ${grades[best[0]][1]}`],
    };
  },
};

// ---- table -----------------------------------------------------------------
const NAMES = ['You', 'Fly', 'Moss', 'Bella']; // Moss is your partner across

function Table({ onResult }) {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) ref.current = { s: newHand(3), scores: [0, 0], showTrick: null, note: '' };
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);
  const toView = viewFor(s.trump);

  function afterPlay() {
    if (s.lastTrick && s.trick.length === 0) {
      g.showTrick = s.lastTrick;
      s.lastTrick = null;
    }
    if (s.phase === 'done' && !s.counted) {
      s.counted = true;
      g.scores[0] += s.result.delta[0];
      g.scores[1] += s.result.delta[1];
      onResult({ won: s.result.delta[0] > 0, delta: s.result.delta[0] - s.result.delta[1] });
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (g.showTrick) { g.showTrick = null; bump(); return; }
      if (s.phase === 'call1' && s.turn !== 0) { callRound1(s, s.turn, botCall1(s, s.turn)); bump(); }
      else if (s.phase === 'call2' && s.turn !== 0) { callRound2(s, s.turn, botCall2(s, s.turn)); bump(); }
      else if (s.phase === 'discard' && s.dealer !== 0) { discard(s, discardChoice(s.hands[s.dealer], s.trump)); bump(); }
      else if (s.phase === 'play' && currentTurn(s) !== 0 && s.sitout !== currentTurn(s)) {
        playCard(s, currentTurn(s), botPlay(s, currentTurn(s))); afterPlay(); bump();
      } else if (s.phase === 'play' && s.sitout === 0) {
        playCard(s, currentTurn(s), botPlay(s, currentTurn(s))); afterPlay(); bump();
      }
    }, g.showTrick ? 1200 : 450);
    return () => clearTimeout(t);
  });

  const myCall1 = s.phase === 'call1' && s.turn === 0;
  const myCall2 = s.phase === 'call2' && s.turn === 0;
  const myDiscard = s.phase === 'discard' && s.dealer === 0;
  const myPlay = s.phase === 'play' && currentTurn(s) === 0 && s.sitout !== 0 && !g.showTrick;
  const legal = myPlay ? legalMoves(s, 0) : null;
  const trick = g.showTrick || { cards: s.trick, seats: s.trickSeats, winner: null };
  const makerBadge = seat => seat === s.maker ? html`<span class="badge">${s.alone ? 'alone' : 'maker'}</span>` : null;

  return html`<div class="table">
    <div class="opps">${[1, 2, 3].map(seat => html`<div class="opp ${s.phase === 'play' && currentTurn(s) === seat ? 'turn' : ''}">
      <span>${NAMES[seat]}${seat === 2 ? ' ★' : ''}</span>${makerBadge(seat)}${s.sitout === seat ? html`<span class="badge alt">sits</span>` : ''}
    </div>`)}</div>

    <div class="felt">
      <p class="callinfo">Us ${g.scores[0]} · Them ${g.scores[1]} · first to 10
        ${s.trump ? html` · trump ${SuitChip(s.trump)}` : ''}</p>
      ${(s.phase === 'call1' || s.phase === 'call2') && html`<p class="callinfo">
        ${s.phase === 'call1' ? 'Upcard' : 'Turned down'}: <${Card} c=${s.upcard} toView=${viewFor(s.phase === 'call1' ? s.upcard[1] : null)} small />
        · dealer ${NAMES[s.dealer]} · ${NAMES[s.turn]} deciding…</p>`}
      <div class="trick">
        ${trick.cards.map((c, i) => html`<div class="played ${trick.winner === trick.seats[i] ? 'won' : ''}">
          <span class="who">${NAMES[trick.seats[i]]}</span><${Card} c=${c} toView=${toView} small />
        </div>`)}
      </div>
      ${g.showTrick && html`<p class="callinfo">${NAMES[g.showTrick.winner]} takes it · tricks Us ${s.tricksWon[0]} Them ${s.tricksWon[1]}</p>`}
    </div>

    ${s.phase === 'done' && html`<div class="verdict ${s.result.delta[0] > 0 ? 'good' : 'bad'}">
      <b>${s.result.euchred ? `Euchred! Defenders +2` : s.result.march ? `March! Makers +${s.result.delta[s.result.makers]}` : `Makers take ${s.result.taken}, +1`}</b>
      <span class="call">Us ${g.scores[0]} · Them ${g.scores[1]}${Math.max(...g.scores) >= 10 ? (g.scores[0] >= 10 ? ' · GAME: you win!' : ' · GAME: they win.') : ''}</span>
      <button class="big" onClick=${() => {
        if (Math.max(...g.scores) >= 10) g.scores = [0, 0];
        g.s = newHand((s.dealer + 1) % 4); bump();
      }}>${Math.max(...g.scores) >= 10 ? 'New game' : 'Next hand'}</button>
    </div>`}

    ${myCall1 && html`<div class="btnrow">
      <button class="big alt" onClick=${() => { callRound1(s, 0, 'pass'); bump(); }}>Pass</button>
      <button class="big" onClick=${() => { callRound1(s, 0, 'order'); bump(); }}>${s.dealer === 0 ? 'Pick up' : 'Order up'}</button>
      <button class="hint" onClick=${() => { callRound1(s, 0, 'alone'); bump(); }}>Alone</button>
    </div>`}
    ${myCall2 && html`<div class="btnrow">
      ${s.dealer !== 0 ? html`<button class="big alt" onClick=${() => { callRound2(s, 0, 'pass'); bump(); }}>Pass</button>` : ''}
      ${SUITS.filter(su => su !== s.upcard[1]).map(su =>
        html`<button class="big" onClick=${() => { callRound2(s, 0, su); bump(); }}>${GLYPH[su]}</button>`)}
    </div>`}
    ${myDiscard && html`<p class="scene">You picked it up: tap a card to discard.</p>`}
    ${s.sitout === 0 && s.phase === 'play' && html`<p class="scene">${NAMES[s.maker]} is alone: you sit this one out.</p>`}

    <div class="me ${myPlay || myCall1 || myCall2 || myDiscard ? 'turn' : ''}">
      <span>You ${makerBadge(0) || ''} · Moss is your partner</span>
      <span class="score">trick ${Math.min(s.trickNo + 1, 5)}/5</span>
    </div>
    <${Hand} cards=${s.hands[0]} toView=${toView} legal=${legal}
      onPlay=${myPlay ? (c => { playCard(s, 0, c); afterPlay(); bump(); }) :
        myDiscard ? (c => { discard(s, c); bump(); }) : null} />
  </div>`;
}

// ---- study -----------------------------------------------------------------
// Sources: ohioeuchre.com, Joe Andrews (Complete Win at Euchre columns),
// euchre.cards, pagat.com, Euchre Universe card-odds simulation.
const STUDY = [
  {
    title: 'Level 1 · The deck and the bowers',
    body: [
      '24 cards: A K Q J 10 9 in each suit. Four players, two teams, partners across. Five tricks; your team needs three. Game to 10.',
      'The jack of trump is the RIGHT BOWER, highest card in play. The jack of the same color is the LEFT BOWER, second highest, and counts as trump, not its printed suit.',
      'Trump order: right, left, A, K, Q, 10, 9. Off suits: A K Q (J) 10 9.',
      'Makers take 3-4: 1 point. March (all five): 2. Alone march: 4. Makers under 3: EUCHRED, defenders score 2.',
    ],
  },
  {
    title: 'Level 1 · The two calling rounds',
    body: [
      'Round one: the upcard may be ordered up; THE DEALER takes it and buries a card. Ordering into the wrong dealer gifts a trump.',
      'Round two: the card turns down and its suit is dead; any other suit may be named. Stick the dealer: dealer must call on the final pass.',
      'Going alone: declare it and your partner sits out; the 4-point march is the biggest swing in the game.',
    ],
  },
  {
    title: 'Level 2 · Calling by seat',
    body: [
      'First seat orders with about 3 trump including a bower, or a bower + trump honor + two off aces. You are giving the DEALER a trump: be a full trick stronger.',
      'Second seat (dealer\'s partner) assists light: two trump plus an off ace helps your own side\'s dealer.',
      'Dealer picks up with 2 trump counting the upcard plus an ace, or any three trump.',
      'Round two, first seat: call NEXT (same color as the turndown) with as little as two trump and a bower. The dealer passed that color, so its bowers are likely live with you or partner.',
      'Reverse next (dealer\'s partner, round two): call the OPPOSITE color, minimum about K-9 suited with an off ace. A forum-grade tool, use sparingly.',
      'The card odds (simulation): right bower wins its trick 100%, left 76%, trump ace 53%, trump king 45%, off-suit ace about 50%, "next"-suit ace only 44%.',
    ],
  },
  {
    title: 'Level 2 · Leads and play',
    body: [
      'Makers lead trump, right bower first: pull two of theirs for one of yours. Defenders NEVER lead trump into the makers.',
      'Defenders lead off-suit aces and singletons; lead your LONG suit against a loner (best odds partner is void and can ruff).',
      'Second hand low, third hand high. Do not trump your partner\'s ace.',
      'Dealer\'s discard builds a void: read it, everyone else will.',
      'When to go alone: both bowers + trump ace or a side ace is near-automatic; one bower + trump ace + two side aces is favorable. Three sure tricks in your own hand is the test: a failed loner costs the same as a failed call.',
    ],
  },
  {
    title: 'Level 3 · Score-craft and inference',
    body: [
      'At 9-9 call only real hands: an opposing euchre ends the game.',
      'Down 6-8: hunt loners, a 4-pointer closes the gap. Up big: tighten.',
      'The donation ("Bridge" rule): at 9 against opponents on 6-7, order up even on trash. Eating a 2-point euchre beats handing them a 4-point loner.',
      'Pass-and-punish under stick-the-dealer: pass a mediocre round-one hand to force a weak dealer into a call your side can euchre.',
      'Card-reading: a round-two call after the dealer\'s team passed marks the dealer weak in the turned color. The maker burning the right bower on a middling lead marks them short in trump.',
      'A hand void in two suits is worth about a quarter-trick more than its cards: early ruffs are real value.',
      'Do not bushwhack: passing a strong round-one hand to trap usually just hands round two to someone else.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Overcalling weak hands: a euchre is a 2-point gift.',
      'Never going alone with Tier-1 hands: 4-point swings left on the table.',
      'Trumping partner\'s ace.',
      'Leading a bare ace against a loner instead of your long suit.',
      'Leading trump on defense.',
      'Bidding the same from every seat, and ignoring the score.',
    ],
  },
];

export const game = {
  id: 'euchre', name: 'Euchre', glyph: '🃏',
  tagline: 'Bowers, orders, and the next convention.',
  toView: viewFor(null), study: STUDY, drills: [callDrill, leadDrill], Table,
  studyNote: 'Standard American euchre with stick-the-dealer.',
};
