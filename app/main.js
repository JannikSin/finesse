// Sheepdog — card game trainer. Shell: home grid → per-game menu → drill / table / study.
import { html, render } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Hand } from './cards.js';
import { game as sheepshead } from './games/sheepshead.js';
import { game as euchre } from './games/euchre.js';
import { game as hearts } from './games/hearts.js';
import { game as ohhell } from './games/ohhell.js';
import { game as rook } from './games/rook.js';
import { game as bridge } from './games/bridge.js';

const GAMES = [sheepshead, euchre, hearts, ohhell, rook, bridge];
// null-prototype maps: a crafted hash like #constructor must not hit Object.prototype
const byId = Object.assign(Object.create(null), Object.fromEntries(GAMES.map(g => [g.id, g])));

// ---- persistence -----------------------------------------------------------
const KEY = 'finesse.v1';
function loadStats() {
  try {
    const cur = JSON.parse(localStorage.getItem(KEY));
    // shape-check: corrupt/hostile storage must not white-screen the app
    if (cur && typeof cur.games === 'object' && cur.games !== null) {
      return { games: cur.games, table: (typeof cur.table === 'object' && cur.table) || {} };
    }
  } catch { /* fall through */ }
  const fresh = { games: {}, table: {} };
  try {
    // migrate the sheepdog-era stores
    const v2 = JSON.parse(localStorage.getItem('sheepdog.v2'));
    if (v2 && v2.games) { localStorage.removeItem('sheepdog.v2'); return v2; }
    const v1 = JSON.parse(localStorage.getItem('sheepdog.v1'));
    if (v1 && v1.pick) {
      fresh.games.sheepshead = { pick: v1.pick, lead: v1.lead };
      fresh.table.sheepshead = v1.game;
      localStorage.removeItem('sheepdog.v1');
    }
  } catch { /* corrupt legacy: boot clean */ }
  return fresh;
}
let STATS = loadStats();
const saveStats = () => localStorage.setItem(KEY, JSON.stringify(STATS));
const drillStats = (gid, did) => {
  STATS.games[gid] = STATS.games[gid] || {};
  STATS.games[gid][did] = STATS.games[gid][did] || { right: 0, total: 0, streak: 0 };
  return STATS.games[gid][did];
};
const tableStats = gid => {
  STATS.table[gid] = STATS.table[gid] || { hands: 0, won: 0, score: 0 };
  return STATS.table[gid];
};

// ---- tour ------------------------------------------------------------------
// Lesson learned on Mise: a tour must NEVER trap anyone. Skip is always
// visible, tapping outside closes it, any dismissal marks it done, and
// ?notour=1 is the escape hatch.
const TOUR = [
  {
    title: 'Welcome to Finesse',
    body: 'This app teaches card games by letting you make the real decisions and telling you why the book agrees or disagrees. Pick a game from the home screen to start. Nothing here needs an account or the internet.',
  },
  {
    title: 'Drills',
    body: 'Each game has short drills: you get a hand, you make one decision (pick or pass, what to bid, what to lead), and the coach grades it with the reasoning spelled out. A few minutes of drills a day is the whole idea.',
  },
  {
    title: 'At the Table',
    body: 'Play full hands against computer players. Choose how strong they are with the buttons above your cards: novice, solid, expert, or a mixed table. When it is your turn, your row lights up gold and says "your turn". Just tap a bright card.',
  },
  {
    title: 'The coach',
    body: 'Leave "coach on" and every time it is your move, a gold note shows the card the book would play and the reason. Turn it off any time for an honest test of what stuck.',
  },
  {
    title: 'Study',
    body: 'Each game has a Study page: Level 1 is the rules, Level 3 is real strategy. Read one level, drill it, then come back for the next. That is the whole tour. Good luck at the table!',
  },
];

function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const step = TOUR[i];
  return html`<div class="tour-backdrop" onClick=${e => { if (e.target === e.currentTarget) onDone(); }}>
    <div class="tour-card">
      <h2>${step.title}</h2>
      <p>${step.body}</p>
      <span class="tour-dots">${TOUR.map((_, d) => (d === i ? '●' : '○')).join(' ')}</span>
      <div class="tour-row">
        <button class="skip" onClick=${onDone}>Skip the tour</button>
        ${i > 0 && html`<button class="hint" onClick=${() => setI(i - 1)}>Back</button>`}
        <button class="big" onClick=${() => (i + 1 < TOUR.length ? setI(i + 1) : onDone())}>
          ${i + 1 < TOUR.length ? 'Next' : 'Done'}
        </button>
      </div>
    </div>
  </div>`;
}

// ---- shell -----------------------------------------------------------------
const LEGACY = Object.assign(Object.create(null), { pick: 'sheepshead/pick', lead: 'sheepshead/lead', table: 'sheepshead/table', study: 'sheepshead/study' });

function route() {
  let h = location.hash.slice(1);
  if (LEGACY[h]) { location.hash = LEGACY[h]; h = LEGACY[h]; }
  const [gid, mode] = h.split('/');
  return { g: byId[gid] || null, mode: mode || null, home: !gid };
}

if (new URLSearchParams(location.search).has('notour')) localStorage.setItem('finesse.tour', 'done');

function App() {
  const [, redraw] = useState(0);
  const [tour, setTour] = useState(() => !localStorage.getItem('finesse.tour'));
  useEffect(() => {
    const f = () => redraw(n => n + 1);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const { g, mode, home } = route();
  const back = home ? null : g && mode ? '#' + g.id : '#';
  const title = home || !g ? 'Finesse'
    : !mode ? g.name
    : mode === 'table' ? `${g.name} · At the Table`
    : mode === 'study' ? `${g.name} · Study`
    : g.screens && Object.hasOwn(g.screens, mode) ? `${g.name} · ${g.screens[mode].title}`
    : `${g.name} · ${(g.drills.find(d => d.id === mode) || {}).title || g.name}`;
  const endTour = () => { localStorage.setItem('finesse.tour', 'done'); setTour(false); };
  return html`<div class="shell">
    ${tour && html`<${Tour} onDone=${endTour} />`}
    <header>
      ${back ? html`<a class="back" href=${back}>←</a>` : html`<span class="paw">🃏</span>`}
      <h1>${title}</h1>
      <button class="helpbtn" title="Show the tour" onClick=${() => setTour(true)}>?</button>
    </header>
    ${home || !g ? html`<${Home} />`
      : !mode ? html`<${GameMenu} g=${g} />`
      : mode === 'study' ? html`<${Study} g=${g} />`
      : mode === 'table' && g.Table ? html`<${g.Table} onResult=${r => {
          const t = tableStats(g.id);
          t.hands++; if (r.won) t.won++; t.score += r.delta || 0;
          saveStats();
        }} key=${g.id} />`
      : g.screens && Object.hasOwn(g.screens, mode) ? html`<${g.screens[mode].C} onResult=${r => {
          const st = drillStats(g.id, mode);
          st.total++; if (r.right) { st.right++; st.streak++; } else st.streak = 0;
          saveStats();
        }} key=${g.id + mode} />`
      : html`<${Drill} g=${g} drill=${g.drills.find(d => d.id === mode) || g.drills[0]} key=${g.id + mode} />`}
  </div>`;
}

function Home() {
  return html`<div class="home">
    <p class="tag">Learn card games by making the decisions that matter. Tap a game to start, or tap ? for a tour.</p>
    ${GAMES.map(g => {
      const gs = STATS.games[g.id] || {};
      const tot = Object.values(gs).reduce((n, d) => n + d.total, 0);
      const right = Object.values(gs).reduce((n, d) => n + d.right, 0);
      return html`<a class="tile" href=${'#' + g.id}>
        <b>${g.glyph} ${g.name}</b>
        <span>${g.tagline}${tot ? ` · drills ${right}/${tot}` : ''}</span>
      </a>`;
    })}
  </div>`;
}

function GameMenu({ g }) {
  const pct = s => (s && s.total ? `${Math.round((100 * s.right) / s.total)}% · ${s.total} hands` : 'not yet drilled');
  const t = STATS.table[g.id];
  return html`<div class="home">
    <p class="tag">${g.tagline}</p>
    ${g.drills.map(d => html`<a class="tile" href=${'#' + g.id + '/' + d.id}>
      <b>${d.title}</b><span>${d.hint} · ${pct((STATS.games[g.id] || {})[d.id])}</span>
    </a>`)}
    ${Object.entries(g.screens || {}).map(([id, s]) => {
      const st = (STATS.games[g.id] || {})[id];
      return html`<a class="tile" href=${'#' + g.id + '/' + id}>
        <b>${s.title}</b><span>${s.hint}${st && st.total ? ` · ${pct(st)}` : ''}</span>
      </a>`;
    })}
    ${g.Table ? html`<a class="tile" href=${'#' + g.id + '/table'}>
      <b>At the Table</b><span>Play full hands against the bots.${t ? ` ${t.hands} hands, ${t.won} won.` : ''}</span>
    </a>` : html`<div class="tile dim"><b>At the Table</b><span>Bots for ${g.name} are on the bench: drills and study first.</span></div>`}
    <a class="tile" href=${'#' + g.id + '/study'}><b>Study</b><span>The rules and the numbers behind the drills.</span></a>
  </div>`;
}

function Drill({ g, drill }) {
  const [scene, setScene] = useState(() => drill.scene());
  const [answer, setAnswer] = useState(null);
  const [sel, setSel] = useState([]);
  const st = drillStats(g.id, drill.id);
  const toView = scene.toView || g.toView;

  const finish = res => {
    st.total++; if (res.right) { st.right++; st.streak++; } else st.streak = 0;
    saveStats();
    setAnswer(res);
  };
  const choose = id => finish(drill.grade(scene, id));
  const next = () => { setScene(drill.scene()); setAnswer(null); setSel([]); };
  const count = drill.count || 1;

  return html`<div class="drill">
    <p class="scene">${scene.prompt}</p>
    <${Hand} cards=${scene.hand} toView=${toView} selected=${sel}
      onPlay=${answer ? null : drill.kind === 'card' ? choose
        : drill.kind === 'cards' ? (c => setSel(s => s.includes(c) ? s.filter(x => x !== c) : [...s, c].slice(-count)))
        : null} />
    ${!answer && drill.kind === 'choice' && html`<div class="btnrow wrap">
      ${scene.choices.map(ch => html`<button class="big ${ch.id === 'pass' ? 'alt' : ''}" disabled=${ch.disabled}
        onClick=${() => choose(ch.id)}>${ch.label}</button>`)}
    </div>`}
    ${!answer && drill.kind === 'cards' && sel.length === count && html`<div class="btnrow">
      <button class="big" onClick=${() => choose(sel)}>Confirm</button>
    </div>`}
    ${answer && html`<div class="verdict ${answer.right ? 'good' : 'bad'}">
      <b>${answer.title}</b>
      ${answer.lead && html`<span class="call">${answer.lead}</span>`}
      ${answer.detail && answer.detail.length ? html`<ul>${answer.detail.map(r => html`<li>${r}</li>`)}</ul>` : ''}
      <button class="big" onClick=${next}>Next deal</button>
    </div>`}
    <p class="stats">${st.right}/${st.total} · streak ${st.streak}</p>
  </div>`;
}

function Study({ g }) {
  return html`<div class="study">
    ${g.study.map(sec => html`<section><h2>${sec.title}</h2><ul>${sec.body.map(b => html`<li>${b}</li>`)}</ul></section>`)}
    ${g.studyNote && html`<p class="stats">${g.studyNote}</p>`}
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
