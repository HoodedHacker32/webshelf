// Preview helper: inline the owner's logo SVGs so CSS can recolour their black parts.
for (const el of document.querySelectorAll('[data-logo]')) {
  fetch(`/logos/${el.dataset.logo}.svg`).then((r) => r.text()).then((t) => {
    el.innerHTML = t.slice(t.indexOf('<svg'));
    const svg = el.querySelector('svg');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    document.body.dataset.ready = String(Number(document.body.dataset.ready || 0) + 1);
  });
}
