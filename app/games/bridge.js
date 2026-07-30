// Bridge trainer module: opening-bid, response, convention, and lead drills,
// full-auction table vs bots with dummy play, leveled study.
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  Card, Hand, GLYPH, rankLabel, frenchView,
  getLevelPref, setLevelPref, getCoachPref, setCoachPref, levelForSeat,
  TableControls, CoachNote, TableRing,
} from '../cards.js';
import {
  deal, hcp, newAuction, legalCalls, makeCall, currentTurn,
  legalMoves, playCard, isBid, bidRank, vulForBoard,
} from './bridge.engine.js';
import {
  openingBid, responseTo, staymanReply, transferReply, blackwoodReply,
  botCall, botPlay, gradeLeads, callLabel, aces as countAces,
  adviseCall, adviseMove, setOpenMin, getOpenMin,
} from './bridge.bid.js';
import { STUDY } from './bridge.study.js';
import { CONVENTIONS, QUIZ, SPINE } from './bridge.conventions.js';
import { practiceScene, PRACTICE_IDS } from './bridge.learn.js';

// Opening threshold pref: 13 = book SAYC, 12 = David's home game.
const OPEN_KEY = 'finesse.bridge.openmin';
setOpenMin(localStorage.getItem(OPEN_KEY) === '12' ? 12 : 13);
const saveOpenMin = n => { setOpenMin(n); localStorage.setItem(OPEN_KEY, String(getOpenMin())); };

const toView = c => frenchView(c, () => false);
const cardLabel = c => `${rankLabel(c[0])}${GLYPH[c[1]]}`;
const contractStr = c => `${callLabel(c.bid)}${c.dbl === 2 ? ' ××' : c.dbl === 1 ? ' ×' : ''}`;
const vulStr = v => (v === 'none' ? 'nobody vul' : v === 'both' ? 'both vul' : v === 'ns' ? 'we are vul' : 'they are vul');
// Pass/Double/Redouble first, then every legal bid: the full bidding box.
const CallButtons = ({ a, onCall }) => {
  const lc = legalCalls(a);
  return html`<div class="btnrow wrap">
    ${[...lc.filter(c => !isBid(c)), ...lc.filter(isBid)].map(b =>
      html`<button class="hint ${!isBid(b) ? 'callword' : ''}" onClick=${() => onCall(b)}>${b === 'X' ? 'Dbl' : b === 'XX' ? 'Rdbl' : callLabel(b)}</button>`)}
  </div>`;
};

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
  id: 'convention', title: 'Convention Check', hint: 'Stayman, transfers, Blackwood, and the whole gadget book.', kind: 'choice',
  scene() {
    // Half the reps come from the written quiz bank (all 11 conventions),
    // half are dealt hands for the three conventions the bots play out.
    if (Math.random() < 0.5) {
      const q = QUIZ[Math.floor(Math.random() * QUIZ.length)];
      return {
        hand: [], kind: 'quiz', q,
        prompt: html`<b>${q.conv}.</b> ${q.q}`,
        choices: q.choices.map((c, i) => ({ id: String(i), label: c })),
      };
    }
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
    if (scene.kind === 'quiz') {
      const right = Number(answer) === scene.q.a;
      const conv = CONVENTIONS.find(c => c.name === scene.q.conv);
      return {
        right,
        title: right ? 'Correct.' : 'Convention missed.',
        lead: `The answer: ${scene.q.choices[scene.q.a]}.`,
        detail: [scene.q.why, conv && `Hook: ${conv.hook}`].filter(Boolean),
      };
    }
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
      detail: tier === bestTier ? [] : [`Best here: ${best.slice(0, 3).map(cardLabel).join(', ')}. ${grades[best[0]][1]}`],
    };
  },
};

// ---- table -----------------------------------------------------------------
const NAMES = ['You', 'Fly', 'Moss', 'Bella']; // Moss is your partner (North)

function Table({ onResult }) {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = {
      a: newAuction(0, deal(), vulForBoard(0)), dealer: 0, board: 0, scores: [0, 0], showTrick: null,
      pref: getLevelPref(), coach: getCoachPref(), seed: 0,
    };
  }
  const g = ref.current;
  const a = g.a;
  const bump = () => redraw(n => n + 1);
  const lvl = seat => levelForSeat(g.pref, seat, g.seed);

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
      if (a.phase === 'auction' && a.turn !== 0) { makeCall(a, a.turn, botCall(a, a.turn, lvl(a.turn))); bump(); }
      else if (a.phase === 'passout') {
        g.dealer = (g.dealer + 1) % 4; g.board++;
        g.a = newAuction(g.dealer, deal(), vulForBoard(g.board)); bump();
      }
      else if (a.phase === 'play') {
        const seat = currentTurn(a);
        const humanTurn = seat === 0 ? !humanIsDummy : (seat === 2 && a.contract.declarer === 0);
        if (!humanTurn) { playCard(a, seat, botPlay(a, seat, lvl(seat))); afterPlay(); bump(); }
      }
    }, g.showTrick ? 5000 : 420);
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
    <${TableRing} onFeltTap=${g.showTrick ? () => { g.showTrick = null; bump(); } : null}
      opps=${[1, 2, 3].map(seat => ({
        name: NAMES[seat] + (seat === 2 ? ' ★' : ''),
        badges: html`${a.contract && a.contract.declarer === seat ? html`<span class="badge">declarer</span>` : ''}${a.contract && dummySeat === seat ? html`<span class="badge alt">dummy</span>` : ''}`,
        cards: showDummy && dummySeat === seat ? 0 : a.hands[seat].length,
        turn: (seatToPlay === seat && !g.showTrick) || (a.phase === 'auction' && a.turn === seat),
      }))}>
      <p class="callinfo">We ${g.scores[0]} · They ${g.scores[1]} · ${vulStr(a.vul)}
        ${a.contract ? html` · contract <b>${contractStr(a.contract)}</b> by ${NAMES[a.contract.declarer]} · tricks ${a.tricksDecl}/${6 + a.contract.level}` : ''}</p>
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
      ${g.showTrick && html`<p class="callinfo">${NAMES[g.showTrick.winner]} takes it · tap here to continue</p>`}
    <//>

    ${a.phase === 'done' && html`<div class="verdict ${(a.result.score > 0) === (declSide === 0) ? 'good' : 'bad'}">
      <b>${contractStr(a.contract)} by ${NAMES[a.contract.declarer]}: ${a.result.made ? `made ${a.result.tricksTaken - 6 - a.contract.level > 0 ? '+' + (a.result.tricksTaken - 6 - a.contract.level) : 'exactly'}` : `down ${6 + a.contract.level - a.result.tricksTaken}`} · ${a.result.score > 0 ? '+' : ''}${a.result.score}${a.result.game ? ' · GAME bonus' : ''}${a.contract.vul ? ' · vul' : ''}</b>
      <span class="call">We ${g.scores[0]} · They ${g.scores[1]}</span>
      <button class="big" onClick=${() => {
        g.dealer = (g.dealer + 1) % 4; g.board++;
        g.a = newAuction(g.dealer, deal(), vulForBoard(g.board)); bump();
      }}>Next deal</button>
    </div>`}

    ${myCall && html`<${CallButtons} a=${a} onCall=${b => { makeCall(a, 0, b); bump(); }} />`}
    ${humanIsDummy && a.phase === 'play' && html`<p class="scene">You are dummy: ${NAMES[a.contract.declarer]} plays both hands. Watch and learn.</p>`}

    ${myCall && g.coach && (() => {
      const adv = adviseCall(a, 0);
      return html`<${CoachNote} text=${`SAYC: ${callLabel(adv.call)}. ${adv.why}`} />`;
    })()}
    ${myPlaySeat !== null && g.coach && (() => {
      const adv = adviseMove(a, myPlaySeat, 'expert');
      return html`<${CoachNote} text=${`${myPlaySeat === 2 ? 'Dummy: ' : ''}${rankLabel(adv.card[0])}${GLYPH[adv.card[1]]}: ${adv.why}`} />`;
    })()}
    <${TableControls} pref=${g.pref} coach=${g.coach}
      onLevel=${l => { g.pref = l; setLevelPref(l); g.seed = (g.seed + 1) % 3; bump(); }}
      onCoach=${on => { g.coach = on; setCoachPref(on); bump(); }} />
    <div class="me ${myPlaySeat === 0 || myCall ? 'turn' : ''}">
      <span>You${a.contract && a.contract.declarer === 0 ? ' · declarer' : ''}${dummySeat === 0 ? ' · dummy' : ''} · Moss is your partner</span>
      <span class="score">${a.phase === 'play' || a.phase === 'done' ? `trick ${Math.min(a.trickNo + 1, 13)}/13` : `${hcp(a.hands[0])} HCP`}</span>
    </div>
    <${Hand} cards=${a.hands[0]} toView=${toView} legal=${myPlaySeat === 0 ? legal : null}
      onPlay=${myPlaySeat === 0 ? (c => { playCard(a, 0, c); afterPlay(); bump(); }) : null} />
  </div>`;
}

// ---- bid the hand: full auctions, no play ----------------------------------
// You bid South against three book bots, whole auction, every deal. At the end
// all four hands flip up and a shadow auction (solid bots in your seat too)
// shows where the system would have landed the same cards.
function systemAuction(dealer, hands, vul) {
  const s = newAuction(dealer, hands, vul);
  let guard = 0;
  while (s.phase === 'auction' && guard++ < 80) makeCall(s, s.turn, botCall(s, s.turn, 'solid'));
  return s;
}
const auctionLineOf = a => a.calls.map((c, i) => `${NAMES[(a.dealer + i) % 4]} ${callLabel(c)}`).join(' · ');
const contractLabel = a => (a.phase === 'passout' || !a.contract ? 'Passed out' : `${contractStr(a.contract)} by ${NAMES[a.contract.declarer]}`);
const sameLanding = (a, s) => {
  if ((a.phase === 'passout') && (s.phase === 'passout')) return true;
  if (!a.contract || !s.contract) return false;
  return a.contract.bid === s.contract.bid
    && a.contract.declarer % 2 === s.contract.declarer % 2
    && a.contract.dbl === s.contract.dbl;
};

function Auction({ onResult }) {
  const [, redraw] = useState(0);
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = { a: newAuction(0, deal(), vulForBoard(0)), dealer: 0, board: 0, coach: getCoachPref(), matched: 0, hands: 0 };
  }
  const g = ref.current;
  const a = g.a;
  const bump = () => redraw(n => n + 1);
  const over = a.phase !== 'auction';

  if (over && !a.judged) {
    a.judged = true;
    a.sys = systemAuction(a.dealer, a.hands, a.vul);
    a.match = sameLanding(a, a.sys);
    g.hands++; if (a.match) g.matched++;
    onResult({ right: a.match });
  }

  useEffect(() => {
    if (a.phase !== 'auction' || a.turn === 0) return;
    const t = setTimeout(() => { makeCall(a, a.turn, botCall(a, a.turn, 'solid')); bump(); }, 420);
    return () => clearTimeout(t);
  });

  const myCall = a.phase === 'auction' && a.turn === 0;
  const next = () => {
    g.dealer = (g.dealer + 1) % 4; g.board++;
    g.a = newAuction(g.dealer, deal(), vulForBoard(g.board));
    bump();
  };

  return html`<div class="table">
    <${TableRing} opps=${[1, 2, 3].map(seat => ({
      name: NAMES[seat] + (seat === 2 ? ' ★' : ''),
      cards: over ? 0 : 13,
      turn: a.phase === 'auction' && a.turn === seat,
    }))}>
      <p class="callinfo">Bidding only: the play is imagined, the contract is graded. Bots bid the book. · ${vulStr(a.vul)}</p>
      <p class="callinfo">${auctionLineOf(a) || (a.dealer === 0 ? 'You deal.' : `${NAMES[a.dealer]} deals.`)}${!over && a.turn !== 0 ? ` · ${NAMES[a.turn]} thinking…` : ''}</p>
      ${over && html`<p class="callinfo"><b>${contractLabel(a)}</b></p>`}
    <//>

    ${over && html`<div class="verdict ${a.match ? 'good' : 'bad'}">
      <b>${a.match ? 'You landed the system contract.' : 'The book went elsewhere.'}</b>
      <span class="call">Your auction: ${auctionLineOf(a)} → ${contractLabel(a)}</span>
      ${!a.match && html`<span class="call">Book auction: ${auctionLineOf(a.sys)} → ${contractLabel(a.sys)}</span>`}
      <span class="call">Matched ${g.matched}/${g.hands} this session</span>
      <button class="big" onClick=${next}>Next deal</button>
    </div>`}
    ${over && [2, 1, 3].map(seat => html`<div class="reveal">
      <p class="callinfo">${NAMES[seat]}${seat === 2 ? ' (partner)' : ''} · ${hcp(a.hands[seat])} HCP</p>
      <${Hand} cards=${a.hands[seat]} toView=${toView} />
    </div>`)}

    ${myCall && html`<${CallButtons} a=${a} onCall=${b => { makeCall(a, 0, b); bump(); }} />`}
    ${myCall && g.coach && (() => {
      const adv = adviseCall(a, 0);
      return html`<${CoachNote} text=${`System: ${callLabel(adv.call)}. ${adv.why}`} />`;
    })()}

    <div class="btnrow wrap controls-row">
      <span class="scene">Openings:</span>
      ${[13, 12].map(n => html`<button class="hint ${getOpenMin() === n ? 'on' : ''}"
        onClick=${() => { saveOpenMin(n); bump(); }}>${n}+ ${n === 13 ? '(book)' : '(home game)'}</button>`)}
      <button class="hint ${g.coach ? 'on' : ''}" onClick=${() => { g.coach = !g.coach; setCoachPref(g.coach); bump(); }}>coach ${g.coach ? 'on' : 'off'}</button>
    </div>
    <div class="me ${myCall ? 'turn' : ''}">
      <span>You · Moss is your partner</span>
      <span class="score">${hcp(a.hands[0])} HCP</span>
    </div>
    <${Hand} cards=${a.hands[0]} toView=${toView} />
  </div>`;
}

// ---- conventions study: hooks, bidding-box tiles, constructed-hand practice --
// Memory model borrowed from the bonmot decks: every fact carries a HOOK, and
// the hook is repeated on every graded answer so recall binds to it.
const LEARN_KEY = 'finesse.bridge.learn';
const loadLearn = () => { try { return JSON.parse(localStorage.getItem(LEARN_KEY)) || {}; } catch { return {}; } };
const saveLearn = m => localStorage.setItem(LEARN_KEY, JSON.stringify(m));

const NumRow = ({ tiles }) => html`<div class="numrow">
  ${tiles.map(t => html`<div class="numtile"><b>${t.big}</b><span>${t.small}</span>${t.hook && html`<i>${t.hook}</i>`}</div>`)}
</div>`;

const Strip = ({ calls }) => html`<div class="strip">
  ${calls.map(s => html`<span class="stripchip ${s.call === null ? 'ask' : ''} ${s.who === 'You' ? 'you' : ''} ${s.call === 'P' ? 'quiet' : ''}">
    <i>${s.who}</i>${s.call === null ? '?' : s.call === 'X' ? 'Dbl' : callLabel(s.call)}
  </span>`)}
</div>`;

function ConvCard({ cv, st, record }) {
  const [scene, setScene] = useState(null);
  const [picked, setPicked] = useState(null);
  const streak = st ? Math.min(st.streak, 5) : 0;
  const canPractice = PRACTICE_IDS.includes(cv.id);
  const deal = () => { setScene(practiceScene(cv.id)); setPicked(null); };
  const right = scene && picked !== null && picked === scene.answer;

  return html`<details class="conv" key=${cv.id} ...${scene ? { open: true } : {}}>
    <summary><b>${cv.name}</b> · ${cv.bid}
      <span class="dots ${streak >= 5 ? 'full' : ''}" title="practice streak">${'●'.repeat(streak)}${'○'.repeat(5 - streak)}</span>
    </summary>
    <p class="hook">${cv.hook}</p>
    <${NumRow} tiles=${cv.numbers} />
    ${!scene && html`<div>
      <p class="scene">${cv.when}</p>
      <ul>${cv.schedule.map(s => html`<li>${s}</li>`)}</ul>
      <p class="coachnote">⚠ ${cv.trap}</p>
      ${canPractice && html`<div class="btnrow">
        <button class="big" onClick=${deal}>Practice this</button>
        ${st && st.total > 0 && html`<span class="stats">${st.right}/${st.total} hands</span>`}
      </div>`}
    </div>`}
    ${scene && html`<div>
      <${Strip} calls=${scene.strip} />
      <p class="scene">${scene.prompt}</p>
      <${Hand} cards=${scene.hand} toView=${toView} />
      <p class="stats">${hcp(scene.hand)} HCP</p>
      ${picked === null && html`<div class="btnrow wrap">
        ${scene.choices.map(ch => html`<button class="big" onClick=${() => { setPicked(ch.id); record(cv.id, ch.id === scene.answer); }}>${ch.label}</button>`)}
      </div>`}
      ${picked !== null && html`<div class="verdict ${right ? 'good' : 'bad'}">
        <b>${right ? 'Locked in.' : 'Not yet.'}</b>
        <span class="call">${(scene.choices.find(c => c.id === scene.answer) || {}).label}: ${scene.why}</span>
        <span class="call hookline">${cv.hook}</span>
        <div class="btnrow">
          <button class="big" onClick=${deal}>Next hand</button>
          <button class="hint" onClick=${() => { setScene(null); setPicked(null); }}>Back to the card</button>
        </div>
      </div>`}
    </div>`}
  </details>`;
}

function Conventions() {
  const [, redraw] = useState(0);
  const bump = () => redraw(n => n + 1);
  const mastery = loadLearn();
  const record = (id, ok) => {
    const m = loadLearn();
    const s = m[id] || { right: 0, total: 0, streak: 0 };
    s.total++; if (ok) { s.right++; s.streak++; } else s.streak = 0;
    m[id] = s; saveLearn(m); bump();
  };
  return html`<div class="study convhub">
    <p class="tag">Every convention is a few numbers, a reply ladder, and a hook to hang them on. Read the hook, practice the constructed hands until the streak dots fill, then take it to Bid the Hand.</p>
    <p class="spinehead">The spine · the six numbers the whole system hangs on</p>
    <${NumRow} tiles=${SPINE} />
    ${CONVENTIONS.map(cv => html`<${ConvCard} key=${cv.id} cv=${cv} st=${mastery[cv.id]} record=${record} />`)}
    <a class="tile" href="#bridge/convention"><b>Convention Check</b><span>The mixed drill: quiz questions across all 11 plus dealt hands. Different muscle, same numbers.</span></a>
    <a class="tile" href="#bridge/auction"><b>Bid the Hand</b><span>Whole auctions where the conventions show up uninvited. The final exam.</span></a>
    <div class="btnrow wrap controls-row">
      <span class="scene">Openings:</span>
      ${[13, 12].map(n => html`<button class="hint ${getOpenMin() === n ? 'on' : ''}"
        onClick=${() => { saveOpenMin(n); bump(); }}>${n}+ ${n === 13 ? '(book SAYC)' : '(home game)'}</button>`)}
    </div>
    <p class="stats">Book SAYC opens on 13+ total points (Rule of 20 for shapely 11s). The 12+ setting is Standard American played light, modern 2/1 style: drills, bots and coach all follow it. The same numbers ride the Bridge deck in Bonmot for daily recall.</p>
  </div>`;
}

export const game = {
  id: 'bridge', name: 'Bridge', glyph: '♠',
  tagline: 'SAYC bidding, conventions, leads, and full deals.',
  toView, study: STUDY, drills: [openDrill, respondDrill, conventionDrill, leadDrill], Table,
  screens: {
    auction: { title: 'Bid the Hand', hint: 'Full auctions, no play: land the system contract.', C: Auction },
    conventions: { title: 'Conventions', hint: 'Study the gadgets: schedules, traps, and the drill.', C: Conventions },
  },
  studyNote: 'Standard American Yellow Card. Full duplicate scoring: doubles, redoubles, and rotating vulnerability.',
};
