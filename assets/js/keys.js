// Keyboard shortcuts on results pages, as listed in Settings:
//   /        jump to the search box (and select what's in it)
//   j or ↓   next result      k or ↑   previous result
//   Enter    open the result that has focus (the browser's own behaviour)
//   Esc      leave the search box
// Arrow keys only move between results once a result has focus, so they
// still scroll the page normally. Nothing fires while typing in a field.

const TARGETS = '.result-title a, .image-tile-open, .result-questions summary';

const typing = (el) => el instanceof HTMLElement
  && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function targets() {
  return [...document.querySelectorAll(TARGETS)].filter((el) => el.offsetParent !== null && !el.closest('[hidden]'));
}

function move(step) {
  const list = targets();
  if (!list.length) return;
  const at = list.indexOf(document.activeElement);
  const next = list[at < 0 ? (step > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, at + step))];
  next.focus();
  next.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  const active = document.activeElement;
  if (e.key === 'Escape' && active?.classList.contains('searchbox-input') && !document.querySelector('.suggest:not([hidden])')) {
    active.blur();
    return;
  }
  if (typing(active)) return;
  if (e.key === '/') {
    const box = document.querySelector('.searchbox-input');
    if (!box) return;
    e.preventDefault();
    box.focus();
    box.select();
  } else if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    move(e.key === 'j' ? 1 : -1);
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && active?.matches?.(TARGETS)) {
    e.preventDefault();
    move(e.key === 'ArrowDown' ? 1 : -1);
  }
});
