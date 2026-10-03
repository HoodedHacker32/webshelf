// Flip a coin. The result comes from crypto.getRandomValues, not Math.random.

import { h, reducedMotion } from '../dom.js';

export function match(query) {
  return /^(flip a coin|coin flip|flip coin|toss a coin|coin toss|heads or tails|heads or tails\?)$/i.test(query.trim()) ? {} : null;
}

const fair = () => crypto.getRandomValues(new Uint8Array(1))[0] < 128;

export function render() {
  const coin = h('div', { class: 'coin' },
    h('div', { class: 'coin-face coin-heads' }, h('span', null, 'H')),
    h('div', { class: 'coin-face coin-tails' }, h('span', null, 'T')));
  const result = h('p', { class: 'coin-result', role: 'status', 'aria-live': 'polite' });
  const again = h('button', { class: 'btn btn-outline btn-small', type: 'button' }, 'Flip again');
  let turns = 0;
  let busy = false;

  const flip = () => {
    if (busy) return;
    const heads = fair();
    const still = reducedMotion();
    turns += 4; // four half-turns per flip, then land on the result
    const angle = turns * 180 + (heads ? 0 : 180);
    result.textContent = still ? (heads ? 'Heads' : 'Tails') : 'Flipping…';
    busy = !still;
    coin.style.transform = `rotateX(${angle}deg)`;
    if (still) return;
    coin.classList.add('is-flipping');
    setTimeout(() => {
      coin.classList.remove('is-flipping');
      result.textContent = heads ? 'Heads' : 'Tails';
      busy = false;
    }, 1100);
  };
  again.addEventListener('click', flip);
  queueMicrotask(flip);

  return h('section', { class: 'answer answer-card coin-card', 'aria-label': 'Flip a coin' },
    h('h2', { class: 'answer-title answer-title-pad' }, 'Flip a coin'),
    h('div', { class: 'coin-stage' }, coin),
    h('div', { class: 'coin-foot' }, result, again));
}
