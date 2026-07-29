// Oh hell trainer module: bid drill (with the dealer hook), table vs bots, study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  Card, Hand, SuitChip, GLYPH, rankLabel, frenchView,
  getLevelPref, setLevelPref, getCoachPref, setCoachPref, levelForSeat,
  TableControls, CoachNote,
} from '../cards.js';
import {
  newRound, forbiddenBid, submitBid, legalMoves, currentTurn, playCard, SEQ,
} from './ohhell.engine.js';
import { estimateTricks, botBid, botPlay, adviseMove } from './ohhell.coach.js';

const viewFor = trump => c => frenchView(c, x => x[1] === trump);

// ---- drill -----------------------------------------------------------------
const bidDrill = {
  id: 'bid', title: 'The Bid', hint: 'Count your winners; respect the hook.', kind: 'choice',
  scene() {
    const dealer = Math.floor(Math.random() * 4);
    const s = newRound(Math.floor(Math.random() * 5), dealer); // 7..3 cards
    // bots before you bid
    while (s.turn !== 0) submitBid(s, s.turn, botBid(s, s.turn));
    const forbidden = forbiddenBid(s, 0);
    const bidsSoFar = s.bids.map((b, i) => (b === null ? null : `${['You', 'Fly', 'Moss', 'Bella'][i]} ${b}`)).filter(Boolean);
    return {
      hand: s.hands[0], trump: s.trump, trumpCard: s.trumpCard, n: s.n, forbidden,
      toView: viewFor(s.trump),
      choices: Array.from({ length: s.n + 1 }, (_, i) => ({ id: String(i), label: String(i), disabled: i === forbidden })),
      prompt: html`${s.n} cards, trump ${SuitChip(s.trump)} (turned ${rankLabel(s.trumpCard[0])}${GLYPH[s.trumpCard[1]]}).
        ${bidsSoFar.length ? html` Bids so far: ${bidsSoFar.join(', ')}.` : ' You bid first.'}
        ${forbidden !== null ? html` You are the dealer: the hook forbids ${forbidden}.` : ''} Your bid?`,
    };
  },
  grade(scene, answer) {
    const a = Number(answer);
    const { est, bid, reasons } = estimateTricks(scene.hand, scene.trump);
    let book = Math.min(bid, scene.n);
    if (book === scene.forbidden) book = book > 0 ? book - 1 : book + 1;
    const off = Math.abs(a - book);
    return {
      right: off === 0,
      title: off === 0 ? 'On the number.' : off === 1 ? 'Close: one off the count.' : 'The count says otherwise.',
      lead: `Book bid: ${book} (raw estimate ${est.toFixed(1)}${scene.forbidden !== null ? `, hook forbids ${scene.forbidden}` : ''}).`,
      detail: reasons.length ? reasons : ['No sure winners: this is a zero hand, and zeros score just fine.'],
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
      s: newRound(0, 3), roundNo: 0, dealer: 3, totals: [0, 0, 0, 0], showTrick: null,
      pref: getLevelPref(), coach: getCoachPref(), seed: 0,
    };
  }
  const g = ref.current;
  const s = g.s;
  const bump = () => redraw(n => n + 1);
  const toView = viewFor(s.trump);
  const lvl = seat => levelForSeat(g.pref, seat, g.seed);

  function afterPlay() {
    if (s.lastTrick && s.trick.length === 0) { g.showTrick = s.lastTrick; s.lastTrick = null; }
    if (s.phase === 'done' && !s.counted) {
      s.counted = true;
      s.result.pts.forEach((p, i) => { g.totals[i] += p; });
      if (g.roundNo === SEQ.length - 1) onResult({ won: g.totals[0] === Math.max(...g.totals), delta: g.totals[0] });
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (g.showTrick) { g.showTrick = null; bump(); return; }
      if (s.phase === 'bid' && s.turn !== 0) { submitBid(s, s.turn, botBid(s, s.turn, lvl(s.turn))); bump(); }
      else if (s.phase === 'play' && currentTurn(s) !== 0) {
        playCard(s, currentTurn(s), botPlay(s, currentTurn(s), lvl(currentTurn(s)))); afterPlay(); bump();
      }
    }, g.showTrick ? 1100 : 400);
    return () => clearTimeout(t);
  });

  const myBid = s.phase === 'bid' && s.turn === 0;
  const myPlay = s.phase === 'play' && currentTurn(s) === 0 && !g.showTrick;
  const legal = myPlay ? legalMoves(s, 0) : null;
  const forbidden = myBid ? forbiddenBid(s, 0) : null;
  const trick = g.showTrick || { cards: s.trick, seats: s.trickSeats, winner: null };
  const gameOver = s.phase === 'done' && g.roundNo === SEQ.length - 1;

  return html`<div class="table">
    <div class="opps">${[1, 2, 3].map(seat => html`<div class="opp ${s.phase === 'play' && currentTurn(s) === seat ? 'turn' : ''}">
      <span>${NAMES[seat]}</span>${s.bids[seat] !== null ? html`<span class="badge alt">${s.tricks[seat]}/${s.bids[seat]}</span>` : ''}<span class="score">${g.totals[seat]}</span>
    </div>`)}</div>

    <div class="felt">
      <p class="callinfo">Round ${g.roundNo + 1}/${SEQ.length}: ${s.n} card${s.n === 1 ? '' : 's'} · trump ${SuitChip(s.trump)}
        (turned <b>${rankLabel(s.trumpCard[0])}${GLYPH[s.trumpCard[1]]}</b>) · dealer ${NAMES[s.dealer]}</p>
      <div class="trick">
        ${trick.cards.map((c, i) => html`<div class="played ${trick.winner === trick.seats[i] ? 'won' : ''}">
          <span class="who">${NAMES[trick.seats[i]]}</span><${Card} c=${c} toView=${toView} small />
        </div>`)}
      </div>
      ${g.showTrick && html`<p class="callinfo">${NAMES[g.showTrick.winner]} takes it</p>`}
      ${s.phase === 'bid' && !myBid && html`<p class="callinfo">${NAMES[s.turn]} bidding…</p>`}
    </div>

    ${s.phase === 'done' && html`<div class="verdict ${s.result.pts[0] > 0 ? 'good' : 'bad'}">
      <b>${s.result.pts[0] > 0 ? `Made it: ${s.bids[0]} bid, +${s.result.pts[0]}.` : `Busted: bid ${s.bids[0]}, took ${s.tricks[0]}.`}</b>
      <span class="call">${NAMES.map((n2, i) => `${n2} ${s.bids[i]}/${s.tricks[i]}${s.result.pts[i] ? ` +${s.result.pts[i]}` : ''}`).join(' · ')}</span>
      <span class="call">Totals: ${NAMES.map((n2, i) => `${n2} ${g.totals[i]}`).join(' · ')}${gameOver ? ` · GAME: ${NAMES[g.totals.indexOf(Math.max(...g.totals))]} wins` : ''}</span>
      <button class="big" onClick=${() => {
        if (gameOver) { g.roundNo = 0; g.dealer = 3; g.totals = [0, 0, 0, 0]; }
        else { g.roundNo++; g.dealer = (g.dealer + 1) % 4; }
        g.s = newRound(g.roundNo, g.dealer); bump();
      }}>${gameOver ? 'New game' : 'Next round'}</button>
    </div>`}

    ${myBid && html`<div class="btnrow"><span class="scene">Your bid${forbidden !== null ? ` (hook forbids ${forbidden})` : ''}:</span>
      ${Array.from({ length: s.n + 1 }, (_, i) => html`<button class="hint" disabled=${i === forbidden}
        onClick=${() => { submitBid(s, 0, i); bump(); }}>${i}</button>`)}
    </div>`}

    ${myBid && g.coach && (() => {
      const est = estimateTricks(s.hands[0], s.trump);
      return html`<${CoachNote} text=${`Count says ${Math.min(est.bid, s.n)} (raw ${est.est.toFixed(1)}). ${est.reasons[0] || 'No sure winners: zero is a fine bid.'}`} />`;
    })()}
    ${myPlay && g.coach && (() => {
      const adv = adviseMove(s, 0, 'expert');
      return html`<${CoachNote} text=${`${rankLabel(adv.card[0])}${GLYPH[adv.card[1]]}: ${adv.why}`} />`;
    })()}
    <${TableControls} pref=${g.pref} coach=${g.coach}
      onLevel=${l => { g.pref = l; setLevelPref(l); g.seed = (g.seed + 1) % 3; bump(); }}
      onCoach=${on => { g.coach = on; setCoachPref(on); bump(); }} />
    <div class="me ${myPlay || myBid ? 'turn' : ''}">
      <span>You${s.bids[0] !== null ? ` · ${s.tricks[0]}/${s.bids[0]}` : ''}</span>
      <span class="score">${g.totals[0]}</span>
      <span class="score">trick ${Math.min(s.trickNo + 1, s.n)}/${s.n}</span>
    </div>
    <${Hand} cards=${s.hands[0]} toView=${toView} legal=${legal}
      onPlay=${myPlay ? (c => { playCard(s, 0, c); afterPlay(); bump(); }) : null} />
  </div>`;
}

// ---- study -----------------------------------------------------------------
// Sources: pagat.com, cardanoir.com strategy essay, Rare Pike guide, and the
// closed-form one-card probability analyses (Relevant Miscellany, Possibly Wrong).
const STUDY = [
  {
    title: 'Level 1 · The game',
    body: [
      'Rounds deal DOWN: 7 cards, then 6, 5, 4, 3, 2, 1. The next card is turned: its suit is trump.',
      'Everyone bids the exact number of tricks they will take, from the dealer\'s left.',
      'Score: exact bid pays 10 + the bid. Any miss, either direction: zero. Too MANY tricks busts you just as hard.',
      'Bid zero proudly: scattered low cards in several suits are a natural zero, and 10 points is 10 points.',
      'The whole game is one skill: bid what your hand CANNOT AVOID taking, not what it might luckily take.',
    ],
  },
  {
    title: 'Level 2 · Counting the bid',
    body: [
      'Trump ace and king: near-certain tricks. Guarded off-suit kings about half. Queens little. Unguarded kings get eaten.',
      'Small trump in a hand with trump length: about half a trick each, more in short rounds.',
      'In small early hands, do not trust off-suit aces: they get trumped constantly. Do not dismiss low cards either.',
      'Bid-order is information: the dealer sees every bid before choosing. Before the dealer, you are guessing what is behind you.',
      'The total-bid gap is public: bids over tricks means someone MUST bust, tighten up. Bids well under means surplus tricks will land on somebody, maybe you.',
    ],
  },
  {
    title: 'Level 2 · The hook and playing to N',
    body: [
      'The dealer may not make bids sum to the tricks available. When the hook eats your honest number: round DOWN weak (ducking beats winning), UP strong.',
      'A hooked dealer\'s bid is forced, not informative. Discount it when reading the table.',
      'Under your bid: win cheaply with your smallest sufficient card. At your bid: duck everything, play just under the current winner.',
      'Shed forced winners EARLY: a high card in a suit others are void in only gets more unavoidable each trick.',
      'Trump is a dial: lead it when you need wins, bury it when you are done.',
    ],
  },
  {
    title: 'Level 3 · Sharp play and short rounds',
    body: [
      'One-card rounds have exact math: bid 1 with nearly any trump (not the very lowest), never with an off-suit card. Leading beats following with the same card.',
      'Made your bid already? An extra trick is worth nothing, so sharp cards have exactly one use: forcing an opponent who still needs a trick to overtake early and burn their winner.',
      'Protecting your own number always outranks sabotage. Attack only when your bid cannot be hurt.',
      'Track over/under patterns per player across rounds: chronically greedy bidders are more exploitable than any single hand.',
      'The last trick is where bids die: know what is still out before it arrives.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Counting off-suit aces as sure tricks in short hands.',
      'Winning a trick out of habit after the bid is already made: the classic bust.',
      'Sitting on a forced winner until the endgame makes it unavoidable.',
      '"Any trump = bid 1" at every hand size: the lowest trump loses more than it wins.',
      'Ignoring the total-bid gap, free information printed on the table.',
      'Reading the dealer\'s hooked bid as a real opinion.',
    ],
  },
];

export const game = {
  id: 'ohhell', name: 'Oh Hell', glyph: '🎯',
  tagline: 'Bid exact or bust, down to one card.',
  toView: viewFor(null), study: STUDY, drills: [bidDrill], Table,
  studyNote: 'Matches Tally\'s default rules: down-sequence, dealer hook on, exact-or-bust 10 + bid.',
};
