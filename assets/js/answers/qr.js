// QR code maker: "qr code", "qr code for https://example.com", "make a qr code
// for hello". Made entirely in the browser (qrcode-generator, MIT, vendored in
// assets/vendor), downloadable as PNG or SVG. Nothing is sent anywhere.

import { h } from '../dom.js';

// The library (57 KB) loads only when a QR code is asked for.
let qrcode = null;

export function match(query) {
  const m = /^(?:make (?:a |me a )?|create (?:a )?|generate (?:a )?)?qr(?: ?code)?(?: generator| maker)?(?:\s+(?:for|of|to|with)?\s*(.+))?$/i.exec(query.trim());
  return m ? { text: (m[1] ?? '').trim() } : null;
}

// The code as SVG: one rect per dark module, a four-module quiet zone.
function svgFor(text) {
  const q = qrcode(0, 'M');
  q.addData(text || ' ', 'Byte');
  q.make();
  const n = q.getModuleCount();
  const size = n + 8;
  let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) rects += `<rect x="${x + 4}" y="${y + 4}" width="1" height="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

function download(name, blob) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function render({ text }) {
  qrcode ??= (await import('../../vendor/qrcode.js')).default;
  const input = h('input', { class: 'field qr-input', type: 'text', value: text, 'aria-label': 'Text or link for the QR code', placeholder: 'Type a link or any text', maxlength: '1200' });
  const picture = h('div', { class: 'qr-picture', role: 'img' });
  const note = h('p', { class: 'answer-note qr-note' });
  let svg = '';
  const draw = () => {
    try {
      svg = svgFor(input.value);
      picture.innerHTML = svg; // generated here from numbers only, never from page text
      picture.setAttribute('aria-label', input.value ? `QR code for ${input.value}` : 'Empty QR code');
      note.textContent = 'Made on your device; nothing is sent anywhere.';
    } catch {
      note.textContent = 'That’s too long for one QR code. Try a shorter link or text.';
    }
  };
  input.addEventListener('input', draw);
  draw();

  const svgButton = h('button', { class: 'btn btn-small', type: 'button' }, 'Download SVG');
  svgButton.addEventListener('click', () => download('qr-code.svg', new Blob([svg], { type: 'image/svg+xml' })));
  const pngButton = h('button', { class: 'btn btn-small', type: 'button' }, 'Download PNG');
  pngButton.addEventListener('click', () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 1024;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, 1024, 1024);
      canvas.toBlob((blob) => blob && download('qr-code.png', blob), 'image/png');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  return h('section', { class: 'answer qr raised', 'aria-label': 'QR code maker' },
    h('p', { class: 'factbox-path' }, 'QR code'),
    h('div', { class: 'qr-body' },
      picture,
      h('div', { class: 'qr-side' }, input, note, h('div', { class: 'qr-actions' }, pngButton, svgButton))));
}
