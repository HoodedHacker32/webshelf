// Scientific calculator with the classic 7-column keypad.
// Expressions are parsed by a small recursive-descent parser; nothing is eval'd.

import { h, svg } from '../dom.js';
import { icon } from '../icons.js';

/* Parser ------------------------------------------------------------- */

const FUNCS = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, ln: 1, log: 1, sqrt: 1, abs: 1, exp: 1,
};

function tokenize(src) {
  const s = src
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×|x(?=[\d(.])/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/sin⁻¹/g, 'asin').replace(/cos⁻¹/g, 'acos').replace(/tan⁻¹/g, 'atan')
    .replace(/\*\*/g, '^');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m;
    if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(rest))) {
      out.push({ t: 'num', v: parseFloat(m[0]) });
    } else if ((m = /^(asin|acos|atan|sin|cos|tan|ln|log|sqrt|abs|exp)/.exec(rest))) {
      out.push({ t: 'fn', v: m[0] });
    } else if ((m = /^(pi|ans|e)/.exec(rest))) {
      out.push({ t: 'const', v: m[0] });
    } else if ((m = /^[-+*/^()!%,]/.exec(rest))) {
      out.push({ t: 'op', v: m[0] });
    } else {
      throw new Error('Unexpected input');
    }
    i += m[0].length;
  }
  return out;
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) {
    if (n < 0) return NaN;
    return gamma(n + 1);
  }
  if (n > 170) return Infinity;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

// Lanczos approximation for non-integer factorials.
function gamma(z) {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}

export function evaluate(src, { deg = false, ans = 0 } = {}) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;
  const toRad = (x) => (deg ? (x * Math.PI) / 180 : x);
  const fromRad = (x) => (deg ? (x * 180) / Math.PI : x);

  const apply = (fn, x) => {
    switch (fn) {
      case 'sin': return Math.sin(toRad(x));
      case 'cos': return Math.cos(toRad(x));
      case 'tan': return Math.tan(toRad(x));
      case 'asin': return fromRad(Math.asin(x));
      case 'acos': return fromRad(Math.acos(x));
      case 'atan': return fromRad(Math.atan(x));
      case 'ln': return Math.log(x);
      case 'log': return Math.log10(x);
      case 'sqrt': return Math.sqrt(x);
      case 'abs': return Math.abs(x);
      case 'exp': return Math.exp(x);
      default: throw new Error('Unknown function');
    }
  };

  const startsOperand = (tok) => tok && (tok.t === 'num' || tok.t === 'const' || tok.t === 'fn' || (tok.t === 'op' && tok.v === '('));

  function expr() {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = next().v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  function term() {
    let v = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = next().v;
        const r = unary();
        v = op === '*' ? v * r : v / r;
      } else if (startsOperand(peek())) {
        v *= unary(); // implicit multiplication: 2pi, 3(4), 2sin(30)
      } else {
        return v;
      }
    }
  }

  function unary() {
    if (isOp('-')) { next(); return -unary(); }
    if (isOp('+')) { next(); return unary(); }
    return power();
  }

  function power() {
    const base = postfix();
    if (isOp('^')) {
      next();
      return base ** unary();
    }
    return base;
  }

  function postfix() {
    let v = primary();
    for (;;) {
      if (isOp('!')) { next(); v = factorial(v); }
      else if (isOp('%')) { next(); v /= 100; }
      else return v;
    }
  }

  function primary() {
    const tok = next();
    if (!tok) throw new Error('Incomplete');
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'const') return tok.v === 'pi' ? Math.PI : tok.v === 'e' ? Math.E : ans;
    if (tok.t === 'fn') {
      if (isOp('(')) {
        next();
        const v = expr();
        if (isOp(')')) next();
        return apply(tok.v, v);
      }
      return apply(tok.v, power());
    }
    if (tok.v === '(') {
      const v = expr();
      if (isOp(')')) next(); // tolerate a missing closing bracket, like the original
      return v;
    }
    throw new Error('Unexpected token');
  }

  const v = expr();
  if (pos < tokens.length) throw new Error('Trailing input');
  return v;
}

export function format(v) {
  if (Number.isNaN(v)) return 'Error';
  if (!Number.isFinite(v)) return v > 0 ? 'Infinity' : '-Infinity';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e12 || abs < 1e-7) {
    const [m, e] = v.toExponential(9).split('e');
    return `${parseFloat(m)}e${e.replace('+', '')}`;
  }
  return String(parseFloat(v.toPrecision(12)));
}

/* Matching ----------------------------------------------------------- */

export function match(query) {
  const q = query.trim().toLowerCase().replace(/^(what\s+is|what's|calculate|calc)\s+/, '').replace(/\s*=\s*$/, '');
  if (/^(calculator|calc|scientific calculator|online calculator)$/.test(query.trim().toLowerCase())) return { expr: '' };
  if (!/[\d)πe]/.test(q)) return null;
  if (!/[-+*/^!%×÷√]|\b(sin|cos|tan|ln|log|sqrt|abs|exp)\b|\d\s*x\s*\d/.test(q)) return null;
  if (/[a-df-wyz]/.test(q.replace(/\b(sin|cos|tan|asin|acos|atan|ln|log|sqrt|abs|exp|pi|ans)\b/g, ''))) return null;
  try {
    const v = evaluate(q);
    if (Number.isNaN(v)) return null;
    return { expr: q };
  } catch {
    return null;
  }
}

/* Card --------------------------------------------------------------- */

const OPS = new Set(['÷', '×', '−', '+', '=']);

const KEYS = [
  ['mode', 'fact', '(', ')', '%', 'clear'],
  ['inv', 'sin', 'ln', '7', '8', '9', '÷'],
  ['π', 'cos', 'log', '4', '5', '6', '×'],
  ['e', 'tan', '√', '1', '2', '3', '−'],
  ['Ans', 'EXP', 'pow', '0', '.', '=', '+'],
];

const LABELS = {
  fact: ['x!', 'x!'], sin: ['sin', 'sin⁻¹'], cos: ['cos', 'cos⁻¹'], tan: ['tan', 'tan⁻¹'],
  ln: ['ln', 'eˣ'], log: ['log', '10ˣ'], '√': ['√', 'x²'], pow: ['xʸ', 'ʸ√x'], Ans: ['Ans', 'Rnd'],
};

const NAMES = {
  '÷': 'divide', '×': 'multiply', '−': 'minus', '+': 'plus', '=': 'equals', '.': 'point', '%': 'percent',
  '(': 'left bracket', ')': 'right bracket', π: 'pi', e: 'e', '√': 'square root', EXP: 'times ten to the power',
};

export function render({ expr }) {
  let input = '';
  let lastExpr = '';
  let ans = 0;
  let deg = false;
  let inv = false;
  let justEvaluated = false;

  const prev = h('div', { class: 'calc-prev', 'aria-hidden': 'true' });
  const out = h('div', { class: 'calc-out num', role: 'status', 'aria-live': 'polite' }, '0');
  const histBtn = h('button', { class: 'icon-btn calc-history', type: 'button', 'aria-label': 'Show previous calculation', title: 'Previous calculation' }, svg(icon('history', 'icon-20')));
  const display = h('div', { class: 'calc-display' }, histBtn, h('div', { class: 'calc-readout' }, prev, out));

  const buttons = {};
  const keypad = h('div', { class: 'calc-keys' });

  const show = () => {
    out.textContent = input || '0';
    buttons.clear.textContent = justEvaluated || !input ? 'AC' : 'CE';
    buttons.clear.setAttribute('aria-label', justEvaluated || !input ? 'All clear' : 'Clear entry');
  };

  const run = () => {
    if (!input) return;
    let src = input.replace(/E/g, '*10^');
    const opens = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
    src += ')'.repeat(Math.max(0, opens));
    let result;
    try { result = evaluate(src, { deg, ans }); } catch { result = NaN; }
    lastExpr = input + ')'.repeat(Math.max(0, opens));
    prev.textContent = `${lastExpr} =`;
    const text = format(result);
    if (text !== 'Error') ans = result;
    input = text;
    justEvaluated = true;
    show();
  };

  const type = (text, { operator = false } = {}) => {
    if (justEvaluated) {
      if (input === 'Error') input = '';
      else if (operator) prev.textContent = `Ans = ${input}`;
      else { prev.textContent = `Ans = ${format(ans)}`; input = ''; }
    }
    justEvaluated = false;
    input += text;
    show();
  };

  const press = (key) => {
    const fn = (name) => type(`${name}(`);
    switch (key) {
      case 'clear':
        if (justEvaluated || !input) { input = ''; prev.textContent = ''; }
        else input = input.replace(/(asin|acos|atan|sin|cos|tan|ln|log|√)\($|.$/, '');
        justEvaluated = false;
        show();
        break;
      case '=': run(); break;
      case 'mode':
        deg = !deg;
        buttons.mode.querySelector('.calc-rad').classList.toggle('is-on', !deg);
        buttons.mode.querySelector('.calc-deg').classList.toggle('is-on', deg);
        buttons.mode.setAttribute('aria-label', deg ? 'Switch to radians' : 'Switch to degrees');
        break;
      case 'inv':
        inv = !inv;
        buttons.inv.classList.toggle('is-on', inv);
        buttons.inv.setAttribute('aria-pressed', String(inv));
        for (const [k, [a, b]] of Object.entries(LABELS)) buttons[k].textContent = inv ? b : a;
        break;
      case 'fact': type('!', { operator: true }); break;
      case 'sin': case 'cos': case 'tan': fn(inv ? `${key}⁻¹` : key); break;
      case 'ln': if (inv) type('e^', { operator: true }); else fn('ln'); break;
      case 'log': if (inv) type('10^', { operator: true }); else fn('log'); break;
      case '√': if (inv) type('^2', { operator: true }); else fn('√'); break;
      case 'pow': type(inv ? '^(1/' : '^', { operator: true }); break;
      case 'Ans': if (inv) type(format(Math.random())); else type('Ans'); break;
      case 'EXP': type('E', { operator: true }); break;
      case '÷': case '×': case '−': case '+': case '%':
        type(key, { operator: true });
        break;
      default: type(key);
    }
    if (inv && !['inv', 'mode'].includes(key)) press('inv');
  };

  for (const row of KEYS) {
    for (const key of row) {
      let el;
      if (key === 'mode') {
        el = h('button', { class: 'calc-key is-fn calc-mode', type: 'button', 'aria-label': 'Switch to degrees' },
          h('span', { class: 'calc-rad is-on' }, 'Rad'), h('span', { class: 'calc-sep', 'aria-hidden': 'true' }), h('span', { class: 'calc-deg' }, 'Deg'));
      } else {
        const digit = /^[\d.()]$/.test(key);
        const label = LABELS[key]?.[0] ?? (key === 'clear' ? 'AC' : key);
        el = h('button', {
          class: `calc-key${digit ? '' : OPS.has(key) ? ' is-op' : ' is-fn'}${key === '=' ? ' is-eq' : ''}`,
          type: 'button',
          'aria-label': NAMES[key],
        }, label);
        if (key === 'inv') el.setAttribute('aria-pressed', 'false');
      }
      if (key === 'clear') el.classList.add('calc-span-1');
      el.addEventListener('click', () => press(key));
      buttons[key] = el;
      keypad.append(el);
    }
  }

  histBtn.addEventListener('click', () => {
    if (!lastExpr) return;
    input = lastExpr;
    justEvaluated = false;
    prev.textContent = '';
    show();
  });

  const card = h('section', { class: 'answer calc', 'aria-label': 'Calculator', tabindex: '-1' }, display, keypad);

  // Typing while the calculator has focus works like its keys.
  card.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: 'clear', Escape: 'clear' };
    const k = map[e.key] ?? (/^[\d.+()%!^]$/.test(e.key) ? e.key : null);
    if (!k) return;
    e.preventDefault();
    if (e.key === 'Escape') { input = ''; justEvaluated = true; }
    if (k === '^') press('pow'); else if (k === '!') press('fact'); else press(k);
  });

  if (expr) {
    input = expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/(\d)\s*x\s*(\d)/gi, '$1×$2').replace(/\s+/g, '');
    run();
  } else {
    show();
  }
  return card;
}
