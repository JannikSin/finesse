// Sheepdog — card game trainer. Shell: home grid → per-game menu → drill / table / study.
import { html, render } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Hand } from './cards.js';
import { game as sheepshead } from './games/sheepshead.js';
import { game as euchre } from './games/euchre.js';
import { game as hearts } from './games/hearts.js';
import { game as ohhell } from './games/ohhell.js';
import { game as rook } from './games/rook.js';

const GAMES = [sheepshead, euchre, hearts, ohhell, rook];
const byId = Object.fromEntries(GAMES.map(g => [g.id, g]));

// ---- persistence -----------------------------------------------------------
const KEY = 'sheepdog.v2';
function loadStats() {
  try {
    const v2 = JSON.parse(localStorage.getItem(KEY));
    if (v2 && v2.games) return v2;
  } catch { /* fall through */ }
  const fresh = { games: {}, table: {} };
  try {
    // migrate v1 (sheepshead-only shape)
    const v1 = JSON.parse(localStorage.getItem('sheepdog.v1'));
    if (v1 && v1.pick) {
      fresh.games.sheepshead = { pick: v1.pick, lead: v1.lead };
      fresh.table.sheepshead = v1.game;
      localStorage.removeItem('sheepdog.v1');
    }
  } catch { /* corrupt v1: boot clean */ }
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

// ---- shell -----------------------------------------------------------------
const LEGACY = { pick: 'sheepshead/pick', lead: 'sheepshead/lead', table: 'sheepshead/table', study: 'sheepshead/study' };

function route() {
  let h = location.hash.slice(1);
  if (LEGACY[h]) { location.hash = LEGACY[h]; h = LEGACY[h]; }
  const [gid, mode] = h.split('/');
  return { g: byId[gid] || null, mode: mode || null, home: !gid };
}

function App() {
  const [, redraw] = useState(0);
  useEffect(() => {
    const f = () => redraw(n => n + 1);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const { g, mode, home } = route();
  const back = home ? null : g && mode ? '#' + g.id : '#';
  const title = home || !g ? 'Sheepdog'
    : !mode ? g.name
    : mode === 'table' ? `${g.name} · At the Table`
    : mode === 'study' ? `${g.name} · Study`
    : `${g.name} · ${(g.drills.find(d => d.id === mode) || {}).title || g.name}`;
  return html`<div class="shell">
    <header>
      ${back ? html`<a class="back" href=${back}>←</a>` : html`<span class="paw">\u{1F415}</span>`}
      <h1>${title}</h1>
    </header>
    ${home || !g ? html`<${Home} />`
      : !mode ? html`<${GameMenu} g=${g} />`
      : mode === 'study' ? html`<${Study} g=${g} />`
      : mode === 'table' && g.Table ? html`<${g.Table} onResult=${r => {
          const t = tableStats(g.id);
          t.hands++; if (r.won) t.won++; t.score += r.delta || 0;
          saveStats();
        }} key=${g.id} />`
      : html`<${Drill} g=${g} drill=${g.drills.find(d => d.id === mode) || g.drills[0]} key=${g.id + mode} />`}
  </div>`;
}

function Home() {
  return html`<div class="home">
    <p class="tag">Learn card games by making the decisions that matter.</p>
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
