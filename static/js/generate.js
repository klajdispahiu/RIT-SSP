let currentCard = 0;
let flashcards = [];
let cardFlipped = false;

document.getElementById('genDoc').addEventListener('change', function() {
  const row = document.getElementById('processRow');
  row.style.display = this.value ? 'flex' : 'none';
  document.getElementById('processStatus').classList.add('hidden');
});

async function processDocument() {
  const docId = document.getElementById('genDoc').value;
  if (!docId) return;

  const btn = document.getElementById('processBtn');
  const status = document.getElementById('processStatus');
  btn.textContent = 'Processing...';
  btn.disabled = true;
  showStatus(status, 'Analyzing textbook — this may take a few minutes for large books...', 'loading');

  try {
    const res = await fetch('/api/embed/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ document_id: docId }),
    });
    const data = await res.json();
    if (data.success) {
      showStatus(status, `Ready! ${data.chunks} text chunks indexed.`, 'success');
      btn.textContent = 'Processed';
      btn.style.background = '#166534';
    } else {
      showStatus(status, data.error || 'Processing failed.', 'error');
      btn.textContent = 'Process';
      btn.disabled = false;
    }
  } catch (e) {
    showStatus(status, 'Network error.', 'error');
    btn.textContent = 'Process';
    btn.disabled = false;
  }
}

async function generateExercises() {
  const docId = document.getElementById('genDoc').value;
  const topic = document.getElementById('exTopic').value.trim();
  const difficulty = document.getElementById('exDifficulty').value;
  const count = document.getElementById('exCount').value;

  if (!docId) { alert('Please select a document.'); return; }
  if (!topic) { alert('Please enter a topic.'); return; }

  const btn = document.getElementById('genExBtn');
  btn.textContent = 'Generating...';
  btn.disabled = true;

  showOutputLoading('Generating exercises from your textbook...');

  try {
    const res = await fetch('/api/generate-exercises/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ document_id: docId, topic, difficulty, count }),
    });
    const data = await res.json();

    if (data.success) {
      renderExercises(data);
    } else {
      showOutputError(data.error);
    }
  } catch (e) {
    showOutputError('Network error. Make sure the server is running.');
  } finally {
    btn.textContent = 'Generate exercises';
    btn.disabled = false;
  }
}

async function generateFlashcards() {
  const docId = document.getElementById('genDoc').value;
  const topic = document.getElementById('fcTopic').value.trim();
  const count = document.getElementById('fcCount').value;

  if (!docId) { alert('Please select a document.'); return; }
  if (!topic) { alert('Please enter a topic.'); return; }

  const btn = document.getElementById('genFcBtn');
  btn.textContent = 'Generating...';
  btn.disabled = true;

  showOutputLoading('Generating flashcards from your textbook...');

  try {
    const res = await fetch('/api/generate-flashcards/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ document_id: docId, topic, count }),
    });
    const data = await res.json();

    if (data.success) {
      renderFlashcards(data);
    } else {
      showOutputError(data.error);
    }
  } catch (e) {
    showOutputError('Network error. Make sure the server is running.');
  } finally {
    btn.textContent = 'Generate flashcards';
    btn.disabled = false;
  }
}

function renderExercises(data) {
  const output = document.getElementById('generateOutput');
  const pages = data.source_pages?.join(', ') || '—';

  const lines = data.exercises.split('\n');
  let html = `
    <div class="output-header">
      <div>
        <h2>Exercises — ${escapeHtml(data.topic)}</h2>
        <span class="source-pages">Generated from pages: ${pages}</span>
      </div>
      <button class="btn-secondary" onclick="copyText()">Copy all</button>
    </div>
    <div class="exercises-output" id="copyTarget">`;

  let inAnswers = false;
  lines.forEach(line => {
    if (!line.trim()) { html += '<br>'; return; }
    if (line.trim().toUpperCase().startsWith('ANSWER')) {
      inAnswers = true;
      html += `<div class="answers-divider">Answers</div>`;
      return;
    }
    if (line.match(/^Exercise\s+\d+/i)) {
      html += `<div class="ex-item"><span class="ex-label">${escapeHtml(line.split(':')[0])}</span><span>${escapeHtml(line.split(':').slice(1).join(':'))}</span></div>`;
    } else if (inAnswers && line.match(/^\d+\./)) {
      html += `<div class="answer-item">${escapeHtml(line)}</div>`;
    } else {
      html += `<p class="ex-text">${escapeHtml(line)}</p>`;
    }
  });

  html += '</div>';
  output.innerHTML = html;
}

function renderFlashcards(data) {
  flashcards = data.flashcards;
  currentCard = 0;
  cardFlipped = false;
  const pages = data.source_pages?.join(', ') || '—';

  const output = document.getElementById('generateOutput');
  output.innerHTML = `
    <div class="output-header">
      <div>
        <h2>Flashcards — ${escapeHtml(data.topic)}</h2>
        <span class="source-pages">Generated from pages: ${pages} &nbsp;·&nbsp; ${flashcards.length} cards</span>
      </div>
    </div>

    <div class="flashcard-viewer">
      <div class="flashcard" id="flashcard" onclick="flipCard()">
        <div class="flashcard-inner" id="flashcardInner">
          <div class="flashcard-front">
            <span class="card-label">Question</span>
            <p id="cardFront"></p>
          </div>
          <div class="flashcard-back">
            <span class="card-label">Answer</span>
            <p id="cardBack"></p>
          </div>
        </div>
      </div>
      <p class="flip-hint">Click card to flip</p>

      <div class="card-controls">
        <button class="btn-secondary" onclick="prevCard()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Prev
        </button>
        <span class="card-counter" id="cardCounter"></span>
        <button class="btn-secondary" onclick="nextCard()">
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="card-grid-toggle">
        <button class="btn-secondary" onclick="toggleGrid()" id="gridToggleBtn">Show all cards</button>
      </div>

      <div class="card-grid hidden" id="cardGrid"></div>
    </div>`;

  updateCard();
}

function updateCard() {
  const card = flashcards[currentCard];
  document.getElementById('cardFront').textContent = card.front;
  document.getElementById('cardBack').textContent = card.back;
  document.getElementById('cardCounter').textContent = `${currentCard + 1} / ${flashcards.length}`;
  cardFlipped = false;
  const inner = document.getElementById('flashcardInner');
  inner.classList.remove('flipped');
}

function flipCard() {
  cardFlipped = !cardFlipped;
  document.getElementById('flashcardInner').classList.toggle('flipped', cardFlipped);
}

function nextCard() {
  if (currentCard < flashcards.length - 1) { currentCard++; updateCard(); }
}

function prevCard() {
  if (currentCard > 0) { currentCard--; updateCard(); }
}

function toggleGrid() {
  const grid = document.getElementById('cardGrid');
  const btn = document.getElementById('gridToggleBtn');
  if (grid.classList.contains('hidden')) {
    grid.classList.remove('hidden');
    btn.textContent = 'Hide all cards';
    grid.innerHTML = flashcards.map((fc, i) => `
      <div class="mini-card" onclick="jumpToCard(${i})">
        <span class="mini-card-num">${i + 1}</span>
        <p class="mini-card-front">${escapeHtml(fc.front)}</p>
        <p class="mini-card-back">${escapeHtml(fc.back)}</p>
      </div>`).join('');
  } else {
    grid.classList.add('hidden');
    btn.textContent = 'Show all cards';
  }
}

function jumpToCard(i) {
  currentCard = i;
  updateCard();
  document.getElementById('flashcard').scrollIntoView({ behavior: 'smooth' });
}

function showOutputLoading(msg) {
  document.getElementById('generateOutput').innerHTML = `
    <div class="results-placeholder" style="height:300px">
      <div class="loading-spinner"></div>
      <p style="color:var(--gray-500);font-size:0.875rem">${msg}</p>
    </div>`;
}

function showOutputError(msg) {
  document.getElementById('generateOutput').innerHTML = `
    <div class="results-placeholder" style="height:300px">
      <p style="color:#c0392b">${escapeHtml(msg)}</p>
    </div>`;
}

function copyText() {
  const el = document.getElementById('copyTarget');
  navigator.clipboard.writeText(el.innerText).then(() => {
    alert('Copied to clipboard!');
  });
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `subject-status ${type}`;
  el.classList.remove('hidden');
}

function getCookie(name) {
  const val = `; ${document.cookie}`;
  const parts = val.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('keydown', e => {
  if (!flashcards.length) return;
  if (e.key === 'ArrowRight') nextCard();
  if (e.key === 'ArrowLeft') prevCard();
  if (e.key === ' ') { e.preventDefault(); flipCard(); }
});