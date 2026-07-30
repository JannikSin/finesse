// Shared card widgets. Game modules map their card ids to a view via toView(c):
// { label, glyph, tone: 'black'|'red'|'green'|'gold', ring: boolean }.
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

export const GLYPH = { C: '♣', S: '♠', H: '♥', D: '♦' };
export const SUIT_NAME = { C: 'clubs', S: 'spades', H: 'hearts', D: 'diamonds' };
export const rankLabel = r => (r === 'T' ? '10' : r);

// Default view for French-suited 2-char ids ('QS', 'TH', '9D'...).
export const frenchView = (c, ringFn) => ({
  label: rankLabel(c[0]),
  glyph: GLYPH[c[1]],
  tone: c[1] === 'H' || c[1] === 'D' ? 'red' : 'black',
  ring: ringFn ? ringFn(c) : false,
});

export function Card({ c, toView, onClick, dim, sel, small }) {
  const v = toView(c);
  return html`<button
    class="card tone-${v.tone} ${v.ring ? 'trump' : ''} ${dim ? 'dim' : ''} ${sel ? 'sel' : ''} ${small ? 'small' : ''} ${onClick ? 'live' : ''}"
    onClick=${onClick} disabled=${!onClick}>
    <span class="rank">${v.label}</span><span class="suit">${v.glyph}</span>
  </button>`;
}

// No visual tell on which cards are legal: every card looks the same, but a
// tap on an illegal card silently does nothing (David's rule).
export const Hand = ({ cards, toView, onPlay, legal, selected }) => html`<div class="hand">
  ${cards.map(c => html`<${Card} key=${c} c=${c} toView=${toView}
    onClick=${onPlay ? () => { if (!legal || legal.includes(c)) onPlay(c); } : null}
    sel=${selected && selected.includes(c)} />`)}
</div>`;

export const SuitChip = su => html`<span class="chip suit-${su}">${GLYPH[su]} ${SUIT_NAME[su]}</span>`;

// ---- table preferences: bot difficulty + coach mode ------------------------
export const BOT_LEVELS = ['novice', 'solid', 'expert', 'mixed'];
export const getLevelPref = () => {
  const l = localStorage.getItem('finesse.level');
  return BOT_LEVELS.includes(l) ? l : 'solid';
};
export const setLevelPref = l => localStorage.setItem('finesse.level', l);
export const getCoachPref = () => localStorage.getItem('finesse.coach') !== 'off';
export const setCoachPref = on => localStorage.setItem('finesse.coach', on ? 'on' : 'off');

// 'mixed' seats a table of different players; assignment fixed per session seed.
export const levelForSeat = (pref, seat, seed = 0) =>
  pref === 'mixed' ? ['novice', 'solid', 'expert'][(seat * 7 + seed) % 3] : pref;

// Collapsed to a single gear by default so nothing sits over the table
// (David's rule). Settings persist, so most sessions never open it.
export function TableControls({ pref, coach, onLevel, onCoach }) {
  const [open, setOpen] = useState(false);
  return html`<div class="controls">
    ${open && html`<div class="btnrow wrap controls-row">
      <span class="scene">Bots:</span>
      ${BOT_LEVELS.map(l => html`<button class="hint ${pref === l ? 'on' : ''}" onClick=${() => onLevel(l)}>${l}</button>`)}
      <button class="hint ${coach ? 'on' : ''}" onClick=${() => onCoach(!coach)}>coach ${coach ? 'on' : 'off'}</button>
    </div>`}
    <button class="hint gear" title="Table settings: bot strength and coach"
      onClick=${() => setOpen(!open)}>${open ? '✕ close settings' : '⚙'}</button>
  </div>`;
}

export const CoachNote = ({ text }) => (text ? html`<p class="coachnote">💡 ${text}</p>` : '');
