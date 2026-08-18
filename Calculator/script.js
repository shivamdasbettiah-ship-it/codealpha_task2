/* =========================================================
   Calc Pro — Calculator Logic
   Handles all arithmetic, keyboard support, and history
   ========================================================= */

'use strict';

// ─── State ───────────────────────────────────────────────────
const state = {
  currentValue:   '0',    // What's shown on the main display
  previousValue:  null,   // The stored operand
  operator:       null,   // The pending operator
  expression:     '',     // The full expression string shown above
  waitingForNext: false,  // Flag: next digit starts a fresh number
  hasDecimal:     false,  // Prevent multiple decimal points
  history:        [],     // Array of { expr, result }
  isError:        false,
};

// ─── DOM Refs ─────────────────────────────────────────────────
const displayMain       = document.getElementById('display-main');
const displayExpression = document.getElementById('display-expression');
const keyboardHint      = document.getElementById('keyboard-hint');
const historyPanel      = document.getElementById('history-panel');
const historyList       = document.getElementById('history-list');
const toggleHistoryBtn  = document.getElementById('toggle-history-btn');
const historyClearBtn   = document.getElementById('history-clear-btn');
const displayEl         = document.querySelector('.display');

// ─── Helpers ──────────────────────────────────────────────────
/**
 * Format a number for display — limits to reasonable length.
 * Falls back to exponential notation for very large numbers.
 */
function formatDisplay(value) {
  if (typeof value !== 'number') return value;
  if (!isFinite(value)) return 'Error';

  // If integer and short, show as-is
  if (Number.isInteger(value) && Math.abs(value) < 1e13) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // Floating point: limit to 10 significant digits
  const str = parseFloat(value.toPrecision(10)).toString();
  return str;
}

function updateDisplay() {
  const raw = state.currentValue;
  const num = parseFloat(raw);

  if (state.isError) {
    displayMain.textContent = 'Error';
    displayMain.classList.add('error');
  } else {
    displayMain.classList.remove('error');

    // Auto-shrink font if value is long
    const len = raw.replace(/[^0-9.\-]/g, '').length;
    if (len > 12) {
      displayMain.style.fontSize = '1.5rem';
    } else if (len > 9) {
      displayMain.style.fontSize = '2rem';
    } else {
      displayMain.style.fontSize = '';
    }

    displayMain.textContent = isNaN(num) ? raw : formatDisplay(num);
  }

  displayExpression.textContent = state.expression;
}

function popAnimation() {
  displayMain.classList.remove('pop');
  // Force reflow to restart animation
  void displayMain.offsetWidth;
  displayMain.classList.add('pop');
}

function shakeDisplay() {
  displayEl.classList.remove('shake');
  void displayEl.offsetWidth;
  displayEl.classList.add('shake');
  setTimeout(() => displayEl.classList.remove('shake'), 400);
}

// ─── Core Calculator Actions ───────────────────────────────────
function inputNumber(digit) {
  if (state.isError) clearAll();

  if (state.waitingForNext) {
    state.currentValue = digit;
    state.waitingForNext = false;
    state.hasDecimal = false;
  } else {
    if (state.currentValue === '0' && digit !== '.') {
      state.currentValue = digit;
    } else {
      if (state.currentValue.replace('-', '').replace('.', '').length >= 12) return; // max digits
      state.currentValue += digit;
    }
  }

  popAnimation();
  updateDisplay();
}

function inputDecimal() {
  if (state.isError) clearAll();

  if (state.waitingForNext) {
    state.currentValue = '0.';
    state.waitingForNext = false;
    state.hasDecimal = true;
    updateDisplay();
    return;
  }

  if (!state.hasDecimal) {
    state.currentValue += '.';
    state.hasDecimal = true;
    updateDisplay();
  }
}

function inputOperator(op) {
  if (state.isError) clearAll();

  const current = parseFloat(state.currentValue);

  // If there's a pending operation and user enters more, chain calculate
  if (state.previousValue !== null && !state.waitingForNext) {
    const result = calculate(state.previousValue, current, state.operator);
    if (result === null) { triggerError(); return; }
    state.currentValue = result.toString();
    state.previousValue = result;
    popAnimation();
  } else {
    state.previousValue = current;
  }

  state.operator      = op;
  state.waitingForNext = true;
  state.hasDecimal    = false;

  // Build expression label
  state.expression = `${formatDisplay(state.previousValue)} ${op}`;

  // Highlight active operator button
  document.querySelectorAll('.btn-operator').forEach(b => b.classList.remove('is-active'));
  const mapping = { '÷': 'btn-divide', '×': 'btn-multiply', '−': 'btn-subtract', '+': 'btn-add' };
  const btnId = mapping[op];
  if (btnId) document.getElementById(btnId)?.classList.add('is-active');

  updateDisplay();
}

function calculate(a, b, op) {
  let result;
  switch (op) {
    case '+': result = a + b; break;
    case '−': result = a - b; break;
    case '×': result = a * b; break;
    case '÷':
      if (b === 0) return null; // Division by zero
      result = a / b;
      break;
    default: return b;
  }
  // Guard against floating point artifacts beyond useful precision
  return parseFloat(result.toPrecision(12));
}

function inputEquals() {
  if (state.operator === null || state.previousValue === null) {
    popAnimation();
    return;
  }

  const current  = parseFloat(state.currentValue);
  const previous = state.previousValue;
  const op       = state.operator;

  const exprStr = `${formatDisplay(previous)} ${op} ${formatDisplay(current)} =`;
  const result  = calculate(previous, current, op);

  if (result === null) {
    // Division by zero
    state.expression = exprStr;
    triggerError('Div by 0');
    return;
  }

  // Save to history
  addHistory(exprStr, result);

  state.expression    = exprStr;
  state.currentValue  = result.toString();
  state.previousValue = null;
  state.operator      = null;
  state.waitingForNext = true;
  state.hasDecimal    = result.toString().includes('.');
  state.isError       = false;

  // Remove active operator highlight
  document.querySelectorAll('.btn-operator').forEach(b => b.classList.remove('is-active'));

  popAnimation();
  updateDisplay();
}

function clearAll() {
  state.currentValue   = '0';
  state.previousValue  = null;
  state.operator       = null;
  state.expression     = '';
  state.waitingForNext = false;
  state.hasDecimal     = false;
  state.isError        = false;
  document.querySelectorAll('.btn-operator').forEach(b => b.classList.remove('is-active'));
  updateDisplay();
}

function toggleSign() {
  if (state.isError) return;
  const num = parseFloat(state.currentValue);
  if (isNaN(num) || num === 0) return;
  state.currentValue = (-num).toString();
  state.hasDecimal = state.currentValue.includes('.');
  popAnimation();
  updateDisplay();
}

function inputPercent() {
  if (state.isError) return;
  const num = parseFloat(state.currentValue);
  if (isNaN(num)) return;
  const result = num / 100;
  state.currentValue = result.toString();
  state.hasDecimal = state.currentValue.includes('.');
  popAnimation();
  updateDisplay();
}

function triggerError(msg = 'Error') {
  state.isError = true;
  state.currentValue = msg;
  state.previousValue = null;
  state.operator = null;
  state.waitingForNext = true;
  shakeDisplay();
  updateDisplay();
}

// ─── History ──────────────────────────────────────────────────
function addHistory(expr, result) {
  const entry = { expr, result };
  state.history.unshift(entry);   // newest first
  if (state.history.length > 20) state.history.pop();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  if (state.history.length === 0) {
    historyList.innerHTML = '<li class="history-empty">No calculations yet</li>';
    return;
  }
  state.history.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `${item.expr} ${item.result}`);
    li.innerHTML = `
      <span class="history-expr">${item.expr}</span>
      <span class="history-result">${formatDisplay(item.result)}</span>
    `;
    // Click to recall result
    li.addEventListener('click', () => recallHistory(item.result));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') recallHistory(item.result);
    });
    historyList.appendChild(li);
  });
}

function recallHistory(result) {
  state.currentValue  = result.toString();
  state.previousValue = null;
  state.operator      = null;
  state.expression    = 'Recalled:';
  state.waitingForNext = false;
  state.hasDecimal    = state.currentValue.includes('.');
  state.isError       = false;
  popAnimation();
  updateDisplay();
}

function clearHistory() {
  state.history = [];
  renderHistory();
}

// ─── Button Event Delegation ───────────────────────────────────
document.getElementById('calculator').addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const action = btn.dataset.action;
  const value  = btn.dataset.value;

  switch (action) {
    case 'number':   inputNumber(value);   break;
    case 'decimal':  inputDecimal();       break;
    case 'operator': inputOperator(value); break;
    case 'equals':   inputEquals();        break;
    case 'clear':    clearAll();           break;
    case 'sign':     toggleSign();         break;
    case 'percent':  inputPercent();       break;
  }
});

// ─── Keyboard Support ─────────────────────────────────────────
const keyMap = {
  '0': () => inputNumber('0'),
  '1': () => inputNumber('1'),
  '2': () => inputNumber('2'),
  '3': () => inputNumber('3'),
  '4': () => inputNumber('4'),
  '5': () => inputNumber('5'),
  '6': () => inputNumber('6'),
  '7': () => inputNumber('7'),
  '8': () => inputNumber('8'),
  '9': () => inputNumber('9'),
  '.': () => inputDecimal(),
  ',': () => inputDecimal(),
  '+': () => inputOperator('+'),
  '-': () => inputOperator('−'),
  '*': () => inputOperator('×'),
  '/': () => inputOperator('÷'),
  'Enter':     () => inputEquals(),
  '=':         () => inputEquals(),
  'Backspace': () => handleBackspace(),
  'Escape':    () => clearAll(),
  'Delete':    () => clearAll(),
  '%':         () => inputPercent(),
};

function handleBackspace() {
  if (state.isError) { clearAll(); return; }
  if (state.waitingForNext) return;
  if (state.currentValue.length <= 1 || (state.currentValue.length === 2 && state.currentValue.startsWith('-'))) {
    state.currentValue = '0';
    state.hasDecimal = false;
  } else {
    const removed = state.currentValue.slice(-1);
    if (removed === '.') state.hasDecimal = false;
    state.currentValue = state.currentValue.slice(0, -1);
  }
  updateDisplay();
}

document.addEventListener('keydown', (e) => {
  // Ignore if user is typing in a form field
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  // Prevent "/" from opening browser quick-find
  if (e.key === '/') e.preventDefault();

  const handler = keyMap[e.key];
  if (handler) {
    handler();
    // Visually flash the corresponding button
    flashKeyboardButton(e.key);
    // Light up keyboard hint
    keyboardHint.classList.add('active');
    clearTimeout(keyboardHint._timeout);
    keyboardHint._timeout = setTimeout(() => keyboardHint.classList.remove('active'), 1200);
  }
});

function flashKeyboardButton(key) {
  // Map keyboard keys to button IDs
  const keyBtnMap = {
    '0': 'btn-0', '1': 'btn-1', '2': 'btn-2', '3': 'btn-3',
    '4': 'btn-4', '5': 'btn-5', '6': 'btn-6', '7': 'btn-7',
    '8': 'btn-8', '9': 'btn-9',
    '.': 'btn-decimal', ',': 'btn-decimal',
    '+': 'btn-add', '-': 'btn-subtract',
    '*': 'btn-multiply', '/': 'btn-divide',
    'Enter': 'btn-equals', '=': 'btn-equals',
    'Escape': 'btn-clear', 'Delete': 'btn-clear',
    '%': 'btn-percent',
  };
  const btnId = keyBtnMap[key];
  if (!btnId) return;
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.add('keyboard-flash');
  btn.style.transform = 'scale(0.91)';
  setTimeout(() => {
    btn.classList.remove('keyboard-flash');
    btn.style.transform = '';
  }, 140);
}

// ─── History Toggle ────────────────────────────────────────────
toggleHistoryBtn.addEventListener('click', () => {
  const isOpen = historyPanel.classList.toggle('open');
  toggleHistoryBtn.setAttribute('aria-expanded', isOpen);
  toggleHistoryBtn.style.color = isOpen ? 'rgba(255,255,255,0.7)' : '';
});

historyClearBtn.addEventListener('click', clearHistory);

// ─── Init ─────────────────────────────────────────────────────
updateDisplay();
renderHistory();

// Remove pop class after animation so it can retrigger
displayMain.addEventListener('animationend', () => {
  displayMain.classList.remove('pop');
});
