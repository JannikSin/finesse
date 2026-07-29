// Shared card widgets. Game modules map their card ids to a view via toView(c):
// { label, glyph, tone: 'black'|'red'|'green'|'gold', ring: boolean }.
import { html } from 'htm/preact';

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

export const Hand = ({ cards, toView, onPlay, legal, selected }) => html`<div class="hand">
  ${cards.map(c => html`<${Card} key=${c} c=${c} toView=${toView}
    onClick=${onPlay && (!legal || legal.includes(c)) ? () => onPlay(c) : null}
    dim=${legal && !legal.includes(c)} sel=${selected && selected.includes(c)} />`)}
</div>`;

export const SuitChip = su => html`<span class="chip suit-${su}">${GLYPH[su]} ${SUIT_NAME[su]}</span>`;
