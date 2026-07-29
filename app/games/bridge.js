// Bridge trainer module: opening-bid, response, convention, and lead drills,
// full-auction table vs bots with dummy play, leveled study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Card, Hand, GLYPH, rankLabel, frenchView } from '../cards.js';
import {
  deal, hcp, newAuction, legalCalls, makeCall, currentTurn,
  legalMoves, playCard, isBid, bidRank,
} from './bridge.engine.js';
import {
  openingBid, responseTo, staymanReply, transferReply, blackwoodReply,
  botCall, botPlay, gradeLeads, callLabel, aces as countAces,
} from './bridge.bid.js';
import { STUDY } from './bridge.study.js';

const toView = c => frenchView(c, () => false);
const cardLabel = c => `${rankLabel(c[0])}${GLYPH[c[1]]}`;

const BID_CHOICES = ['P', '1C', '1D', '1H', '1S', '1N', '2C', '2D', '2H', '2S', '2N', '3C', '3D', '3H', '3S', '3N', '4H', '4S'];
const choicesFrom = (over) => BID_CHOICES
  .filter(b => b === 'P' || !over || bidRank(b) > bidRank(over))
  .map(b => ({ id: b, label: callLabel(b) }));

// ---- drills ----------------------------------------------------------------
const openDrill = {
  id: 'open', title: 'The Opening Bid', hint: '13 cards, first seat: what is your call?', kind: 'choice',
  scene() {
    const hand = deal()[0];
    return {
      hand,
      prompt: html`First seat, nobody has bid. ${hcp(hand)} HCP is your secret. Your call?`,
      choices: choicesFrom(null),
    };
  },
  grade(scene, answer) {
    const v = openingBid(scene.hand);
    return {
      right: answer === v.call,
      title: answer === v.call ? 'Correct.' : 'Not the system call.',
      lead: `SAYC says: ${callLabel(v.call)}.`,
      detail: [v.why],
    };
  },
};

const respondDrill = {
  id: 'respond', title: 'The Response', hint: 'Partner opened. Find the system answer.', kind: 'choice',
  scene() {
    for (let tries = 0; tries < 400; tries++) {
      const hands = deal();
      const open = openingBid(hands[2]).call;
      if (!['1C', '1D', '1H', '1S', '1N'].includes(open)) continue;
      return {
        hand: hands[0], open,
        prompt: html`Partner opens <b>${callLabel(open)}</b>, next hand passes. You hold ${hcp(hands[0])} HCP. Your call?`,
        choices: choicesFrom(open),
      };
    }
    const hand = deal()[0];
    return { hand, open: '1N', prompt: 'Partner opens 1NT. Your call?', choices: choicesFrom('1N') };
  },
  grade(scene, answer) {
    const v = responseTo(scene.open, scene.hand);
    return {
      right: answer === v.call,
      title: answer === v.call ? 'Correct.' : 'The system disagrees.',
      lead: `SAYC says: ${callLabel(v.call)}.`,
      detail: [v.why],
    };
  },
};

const conventionDrill = {
  id: 'convention', title: 'Convention Check', hint: 'Stayman, transfers, Blackwood: answer correctly.', kind: 'choice',
  scene() {
    const kind = ['stayman', 'transfer', 'blackwood'][Math.floor(Math.random() * 3)];
    if (kind === 'blackwood') {
      const hand = deal()[0];
      return {
        hand, kind,
        prompt: html`You opened, partner drove to <b>4NT: Blackwood</b>, asking aces. You hold ${countAces(hand)}. Your call?`,
        choices: ['5C', '5D', '5H', '5S'].map(b => ({ id: b, label: callLabel(b) })),
      };
    }
    for (let tries = 0; tries < 400; tries++) {
      const hand = deal()[0];
      if (openingBid(hand).call !== '1N') continue;
      if (kind === 'stayman') {
        return {
          hand, kind,
          prompt: html`You opened <b>1NT</b>. Partner bids <b>2♣, Stayman</b>, asking for a 4-card major. Your call?`,
          choices: ['2D', '2H', '2S'].map(b => ({ id: b, label: callLabel(b) })),
        };
      }
      const t = Math.random() < 0.5 ? '2D' : '2H';
      return {
        hand, kind, t,
        prompt: html`You opened <b>1NT</b>. Partner bids <b>${callLabel(t)}, a Jacoby transfer</b>. Your call?`,
        choices: ['2H', '2S', '2N', 'P'].map(b => ({ id: b, label: callLabel(b) })),
      };
    }
    return this.scene();
  },
  grade(scene, answer) {
    const v = scene.kind === 'blackwood' ? blackwoodReply(scene.hand)
      : scene.kind === 'stayman' ? staymanReply(scene.hand)
      : transferReply(scene.t);
    return {
      right: answer === v.call,
      title: answer === v.call ? 'Correct.' : 'Convention missed.',
      lead: `The answer: ${callLabel(v.call)}.`,
      detail: [v.why],
    };
  },
};

const TIER_WORDS = { best: 'The book lead.', good: 'A sound lead.', okay: 'Playable, not best.', bad: 'The book frowns.', terrible: 'Never this.' };

const leadDrill = {
  id: 'lead', title: 'The Opening Lead', hint: 'Against notrump and suit contracts.', kind: 'card',
  scene() {
    const hand = deal()[0];
    const bid = ['3N', '4S', '4H', '2S', '3N'][Math.floor(Math.random() * 5)];
    const contract = { bid, level: Number(bid[0]), strain: bid[1] };
    return {
      hand, contract,
      prompt: html`The opponents bid to <b>${callLabel(bid)}</b>, declarer on your right. Your lead?`,
    };
  },
  grade(scene, card) {
    const { grades, bestTier } = gradeLeads(scene.hand, scene.contract);
    const [tier, why] = grades[card];
    const best = scene.hand.filter(c => grades[c][0] === bestTier);
    return {
      right: tier === bestTier,
      title: TIER_WORDS[tier],
      lead: `${cardLabel(card)}: ${why}`,
      detail: tier === bestTier ? [] : [`Best here: ${best.slice(0, 3).map(cardLabel).join(', ')} — ${grades[best[0]][1]}`],
    };
  },
};

// ---- table -----------------------------------------------------------------
const NAMES = ['You', 'Fly', 'Moss', 'Bella']; // Moss is your partner (North)

function Table({ onResult }) {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) ref.current = { a: newAuction(0, deal()), dealer: 0, scores: [0, 0], showTrick: null };
  const g = ref.current;
  const a = g.a;
  const bump = () => redraw(n => n + 1);

  const declSide = a.contract ? a.contract.declarer % 2 : null;
  const iControl = seat => seat === 0 || (a.contract && a.contract.declarer === 0 && seat === 2);
  const botControls = seat => !iControl(seat) || (a.contract && a.contract.declarer === 2 && seat === 0 ? false : false);
  const humanIsDummy = a.contract && a.dummy === 0 && a.contract.declarer !== 0;

  function afterPlay() {
    if (a.lastTrick && a.trick.length === 0) { g.showTrick = a.lastTrick; a.lastTrick = null; }
    if (a.phase === 'done' && !a.counted) {
      a.counted = true;
      const our = a.contract.declarer % 2 === 0 ? a.result.score : -a.result.score;
      g.scores[0] += Math.max(our, 0) || 0;
      g.scores[1] += Math.max(-our, 0) || 0;
      onResult({ won: our > 0, delta: our });
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (g.showTrick) { g.showTrick = null; bump(); return; }
      if (a.phase === 'auction' && a.turn !== 0) { makeCall(a, a.turn, botCall(a, a.turn)); bump(); }
      else if (a.phase === 'passout') { g.a = newAuction((g.dealer + 1) % 4, deal()); g.dealer = (g.dealer + 1) % 4; bump(); }
      else if (a.phase === 'play') {
        const seat = currentTurn(a);
        const humanTurn = seat === 0 ? !humanIsDummy : (seat === 2 && a.contract.declarer === 0);
        if (!humanTurn) { playCard(a, seat, botPlay(a, seat)); afterPlay(); bump(); }
      }
    }, g.showTrick ? 1100 : 420);
    return () => clearTimeout(t);
  });

  const myCall = a.phase === 'auction' && a.turn === 0;
  const seatToPlay = a.phase === 'play' ? currentTurn(a) : null;
  const myPlaySeat = a.phase === 'play' && !g.showTrick &&
    ((seatToPlay === 0 && !humanIsDummy) || (seatToPlay === 2 && a.contract.declarer === 0)) ? seatToPlay : null;
  const legal = myPlaySeat !== null ? legalMoves(a, myPlaySeat) : null;
  const trick = g.showTrick || { cards: a.trick || [], seats: a.trickSeats || [], winner: null };
  const auctionLine = a.calls.map((c, i) => `${NAMES[(a.dealer + i) % 4]} ${callLabel(c)}`).join(' · ');
  const showDummy = a.phase !== 'auction' && a.contract && (a.trickNo > 0 || a.trick.length > 0 || a.phase === 'done');
  const dummySeat = a.contract ? a.dummy : null;

  return html`<div class="table">
    <div class="opps">${[1, 2, 3].map(seat => html`<div class="opp ${seatToPlay === seat ? 'turn' : ''}">
      <span>${NAMES[seat]}${seat === 2 ? ' ★' : ''}</span>
      ${a.contract && a.contract.declarer === seat ? html`<span class="badge">declarer</span>` : ''}
      ${a.contract && dummySeat === seat ? html`<span class="badge alt">dummy</span>` : ''}
    </div>`)}</div>

    <div class="felt">
      <p class="callinfo">We ${g.scores[0]} · They ${g.scores[1]}
        ${a.contract ? html` · contract <b>${callLabel(a.contract.bid)}</b> by ${NAMES[a.contract.declarer]} · tricks ${a.tricksDecl}/${6 + a.contract.level}` : ''}</p>
      ${a.phase === 'auction' && html`<p class="callinfo">${auctionLine || (a.dealer === 0 ? 'You deal.' : `${NAMES[a.dealer]} deals.`)}${a.turn !== 0 ? ` · ${NAMES[a.turn]} thinking…` : ''}</p>`}
      ${showDummy && dummySeat !== 0 && html`<div>
        <p class="callinfo">${NAMES[dummySeat]}'s dummy${a.contract.declarer === 0 ? ' (you play these too)' : ''}</p>
        <${Hand} cards=${a.hands[dummySeat]} toView=${toView}
          legal=${myPlaySeat === 2 ? legal : null}
          onPlay=${myPlaySeat === 2 ? (c => { playCard(a, 2, c); afterPlay(); bump(); }) : null} />
      </div>`}
      <div class="trick">
        ${trick.cards.map((c, i) => html`<div class="played ${trick.winner === trick.seats[i] ? 'won' : ''}">
          <span class="who">${NAMES[trick.seats[i]]}</span><${Card} c=${c} toView=${toView} small />
        </div>`)}
      </div>
      ${g.showTrick && html`<p class="callinfo">${NAMES[g.showTrick.winner]} takes it</p>`}
    </div>

    ${a.phase === 'done' && html`<div class="verdict ${(a.result.score > 0) === (declSide === 0) ? 'good' : 'bad'}">
      <b>${callLabel(a.contract.bid)} by ${NAMES[a.contract.declarer]}: ${a.result.made ? `made ${a.result.tricksTaken - 6 - a.contract.level > 0 ? '+' + (a.result.tricksTaken - 6 - a.contract.level) : 'exactly'}` : `down ${6 + a.contract.level - a.result.tricksTaken}`} · ${a.result.score > 0 ? '+' : ''}${a.result.score}${a.result.game ? ' · GAME bonus' : ''}</b>
      <span class="call">We ${g.scores[0]} · They ${g.scores[1]}</span>
      <button class="big" onClick=${() => {
        g.dealer = (g.dealer + 1) % 4;
        g.a = newAuction(g.dealer, deal()); bump();
      }}>Next deal</button>
    </div>`}

    ${myCall && html`<div class="btnrow wrap">
      ${['P', ...legalCalls(a).filter(isBid).slice(0, 14)].map(b =>
        html`<button class="hint" onClick=${() => { makeCall(a, 0, b); bump(); }}>${callLabel(b)}</button>`)}
    </div>`}
    ${humanIsDummy && a.phase === 'play' && html`<p class="scene">You are dummy: ${NAMES[a.contract.declarer]} plays both hands. Watch and learn.</p>`}

    <div class="me ${myPlaySeat === 0 || myCall ? 'turn' : ''}">
      <span>You${a.contract && a.contract.declarer === 0 ? ' · declarer' : ''}${dummySeat === 0 ? ' · dummy' : ''} · Moss is your partner</span>
      <span class="score">${a.phase === 'play' || a.phase === 'done' ? `trick ${Math.min(a.trickNo + 1, 13)}/13` : `${hcp(a.hands[0])} HCP`}</span>
    </div>
    <${Hand} cards=${a.hands[0]} toView=${toView} legal=${myPlaySeat === 0 ? legal : null}
      onPlay=${myPlaySeat === 0 ? (c => { playCard(a, 0, c); afterPlay(); bump(); }) : null} />
  </div>`;
}

export const game = {
  id: 'bridge', name: 'Bridge', glyph: '♠',
  tagline: 'SAYC bidding, conventions, leads, and full deals.',
  toView, study: STUDY, drills: [openDrill, respondDrill, conventionDrill, leadDrill], Table,
  studyNote: 'Standard American Yellow Card. Table plays undoubled, non-vulnerable duplicate scoring.',
};
