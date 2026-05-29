/**
 * UPTN LOTTO - Main JavaScript Controller
 * Core logic for lotto generation, localStorage daily limits (5 per day),
 * Web Audio-based premium SFX synthesizer, and visual drawing orchestrations.
 */

// Local Storage Keys
const LIMIT_STORAGE_KEY = 'uptn_lotto_limit_state';
const HISTORY_STORAGE_KEY = 'uptn_lotto_history_items';
const MAX_DAILY_LIMIT = 5;

// DOM Elements
const remainingCountEl = document.getElementById('remaining-count');
const remainingProgressEl = document.getElementById('remaining-progress');
const ballsDisplayEl = document.getElementById('balls-display');
const generateBtn = document.getElementById('generate-btn');
const resetLimitBtn = document.getElementById('reset-limit-btn');
const historyItemsEl = document.getElementById('history-items');
const historyEmptyEl = document.getElementById('history-empty');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const toastContainer = document.getElementById('toast-container');

// Sound Effects Synthesizer using Web Audio API
class AudioSynth {
  static getContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    return AudioContextClass ? new AudioContextClass() : null;
  }

  static playTick() {
    const ctx = this.getContext();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  static playPop(ballIndex) {
    const ctx = this.getContext();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Dynamic pitch based on the ball drawing order (creates a rising tone scale)
    const baseFreq = 260 + ballIndex * 60; 
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, ctx.currentTime + 0.18);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  static playSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.15); // C5
    playTone(659.25, now + 0.1, 0.15); // E5
    playTone(783.99, now + 0.2, 0.25); // G5
  }
}

// Helper: Get local Date string (YYYY-MM-DD)
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Toast System
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.innerHTML = type === 'success' ? '✓' : '⚠';
  
  const text = document.createElement('span');
  text.innerText = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  toastContainer.appendChild(toast);
  
  // Remove toast after 3s
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2700);
}

// LocalStorage: Limit State Management
function getLimitState() {
  const today = getTodayString();
  const raw = localStorage.getItem(LIMIT_STORAGE_KEY);
  if (!raw) {
    return { date: today, count: 0 };
  }
  
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) {
      // Date changed, reset limit state
      return { date: today, count: 0 };
    }
    return parsed;
  } catch (e) {
    return { date: today, count: 0 };
  }
}

// LocalStorage: Save Limit State
function saveLimitState(state) {
  localStorage.setItem(LIMIT_STORAGE_KEY, JSON.stringify(state));
}

// LocalStorage: History Management
function getHistory() {
  const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// LocalStorage: Save History
function saveHistory(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

// UI State Synchronization
function updateLimitUI() {
  const state = getLimitState();
  const remaining = Math.max(0, MAX_DAILY_LIMIT - state.count);
  
  remainingCountEl.innerText = remaining;
  
  // Update progress bar
  const percent = (remaining / MAX_DAILY_LIMIT) * 100;
  remainingProgressEl.style.width = `${percent}%`;
  
  // Disable button if limit exceeded
  if (remaining <= 0) {
    generateBtn.disabled = true;
    const btnText = generateBtn.querySelector('.btn-text');
    if (btnText) btnText.innerText = '오늘의 생성 한도 초과';
  } else {
    generateBtn.disabled = false;
    const btnText = generateBtn.querySelector('.btn-text');
    if (btnText) btnText.innerText = '로또번호 생성';
  }
}

// Determine lotto ball color group based on Korean standard lotto guidelines
function getBallClass(number) {
  if (number >= 1 && number <= 10) return 'ball-yellow';
  if (number >= 11 && number <= 20) return 'ball-blue';
  if (number >= 21 && number <= 30) return 'ball-red';
  if (number >= 31 && number <= 40) return 'ball-grey';
  return 'ball-green'; // 41 ~ 45
}

// Generate 6 unique sorted lotto numbers
function generateLottoNumbers() {
  const numbers = new Set();
  while (numbers.size < 6) {
    const r = Math.floor(Math.random() * 45) + 1;
    numbers.add(r);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// Create history element
function createHistoryItemElement(item) {
  const itemEl = document.createElement('div');
  itemEl.className = 'history-item';
  
  const metaEl = document.createElement('div');
  metaEl.className = 'history-meta';
  
  const roundEl = document.createElement('span');
  roundEl.className = 'history-round';
  roundEl.innerText = `#${item.id} 회차`;
  
  const dateEl = document.createElement('span');
  dateEl.className = 'history-date';
  
  // Format date
  const date = new Date(item.timestamp);
  dateEl.innerText = `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  
  metaEl.appendChild(roundEl);
  metaEl.appendChild(dateEl);
  itemEl.appendChild(metaEl);
  
  const ballsEl = document.createElement('div');
  ballsEl.className = 'history-balls';
  
  item.numbers.forEach(num => {
    const b = document.createElement('div');
    b.className = `mini-ball ${getBallClass(num)}`;
    b.innerText = num;
    ballsEl.appendChild(b);
  });
  
  itemEl.appendChild(ballsEl);
  return itemEl;
}

// Render history
function renderHistory() {
  const history = getHistory();
  historyItemsEl.innerHTML = '';
  
  if (history.length === 0) {
    historyEmptyEl.classList.remove('hidden');
    clearHistoryBtn.classList.add('hidden');
  } else {
    historyEmptyEl.classList.add('hidden');
    clearHistoryBtn.classList.remove('hidden');
    
    // Reverse array to display latest at top
    history.slice().reverse().forEach(item => {
      const el = createHistoryItemElement(item);
      historyItemsEl.appendChild(el);
    });
  }
}

// Display loading placeholders
function renderPlaceholders() {
  ballsDisplayEl.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const placeholder = document.createElement('div');
    placeholder.className = 'ball-placeholder animate-pulse';
    placeholder.innerText = '?';
    ballsDisplayEl.appendChild(placeholder);
  }
}

// Draw routine
function startDrawingSequence() {
  const state = getLimitState();
  if (state.count >= MAX_DAILY_LIMIT) {
    showToast('하루에 5번까지만 생성할 수 있습니다.', 'error');
    return;
  }

  // Disable draw button
  generateBtn.disabled = true;
  
  // Set placeholders to shuffling animation state
  const placeholders = Array.from(ballsDisplayEl.querySelectorAll('.ball-placeholder'));
  placeholders.forEach(el => {
    el.classList.remove('animate-pulse');
    el.classList.add('shuffling');
  });

  // Sound ticking during shuffle
  let tickCount = 0;
  const tickInterval = setInterval(() => {
    AudioSynth.playTick();
    placeholders.forEach(el => {
      el.innerText = Math.floor(Math.random() * 45) + 1;
    });
    tickCount++;
    if (tickCount >= 10) {
      clearInterval(tickInterval);
      revealActualNumbers();
    }
  }, 100);

  function revealActualNumbers() {
    const luckyNumbers = generateLottoNumbers();
    ballsDisplayEl.innerHTML = ''; // Clear display

    // Increment count & save limit status right away
    state.count += 1;
    saveLimitState(state);
    updateLimitUI();

    // Create hidden balls as placeholders
    luckyNumbers.forEach(() => {
      const space = document.createElement('div');
      space.className = 'ball-placeholder';
      space.style.visibility = 'hidden';
      ballsDisplayEl.appendChild(space);
    });

    const spaceHolders = Array.from(ballsDisplayEl.children);

    // Render numbers sequentially
    luckyNumbers.forEach((num, index) => {
      setTimeout(() => {
        const ball = document.createElement('div');
        ball.className = `lotto-ball ${getBallClass(num)}`;
        ball.innerText = num;
        
        spaceHolders[index].replaceWith(ball);
        AudioSynth.playPop(index);
        
        if (index === 5) {
          setTimeout(() => {
            AudioSynth.playSuccess();
            
            // Add items to history
            const history = getHistory();
            const nextId = history.length > 0 ? history[history.length - 1].id + 1 : 1;
            const newHistoryItem = {
              id: nextId,
              numbers: luckyNumbers,
              timestamp: new Date().toISOString()
            };
            history.push(newHistoryItem);
            saveHistory(history);
            
            renderHistory();
            showToast('행운의 로또 번호가 추출되었습니다!', 'success');
            
            // Restore generate button
            updateLimitUI();
          }, 300);
        }
      }, index * 400); // 400ms delay per ball
    });
  }
}

// Setup Event Listeners
generateBtn.addEventListener('click', startDrawingSequence);

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('모든 생성 히스토리를 정말로 삭제하시겠습니까?')) {
    saveHistory([]);
    renderHistory();
    showToast('히스토리가 초기화되었습니다.', 'success');
  }
});

// DEV Tools: Clear limit button
resetLimitBtn.addEventListener('click', () => {
  const today = getTodayString();
  saveLimitState({ date: today, count: 0 });
  updateLimitUI();
  renderPlaceholders();
  showToast('일일 한도가 초기화되었습니다. (개발자 모드)', 'success');
});

// Initial Page Load Orchestration
document.addEventListener('DOMContentLoaded', () => {
  updateLimitUI();
  renderHistory();
  renderPlaceholders();
});
