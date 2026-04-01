let currentCard = 0;
let flashcards = [];
let cardFlipped = false;

let quizQuestions = [];
let quizAnswers = {};
let quizSubmitted = false;

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
    if (data.success) renderExercises(data);
    else showOutputError(data.error);
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
    if (data.success) renderFlashcards(data);
    else showOutputError(data.error);
  } catch (e) {
    showOutputError('Network error. Make sure the server is running.');
  } finally {
    btn.textContent = 'Generate flashcards';
    btn.disabled = false;
  }
}

async function generateQuiz() {
  const docId = document.getElementById('genDoc').value;
  const topic = document.getElementById('quizTopic').value.trim();
  const count = document.getElementById('quizCount').value;

  if (!docId) { alert('Please select a document.'); return; }
  if (!topic) { alert('Please enter a topic.'); return; }

  const btn = document.getElementById('genQuizBtn');
  btn.textContent = 'Generating...';
  btn.disabled = true;
  showOutputLoading('Building your quiz from the textbook...');

  try {
    const res = await fetch('/api/generate-quiz/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ document_id: docId, topic, count }),
    });
    const data = await res.json();
    if (data.success) renderQuiz(data);
    else showOutputError(data.error);
  } catch (e) {
    showOutputError('Network error. Make sure the server is running.');
  } finally {
    btn.textContent = 'Start interactive quiz';
    btn.disabled = false;
  }
}

function renderQuiz(data) {
  quizQuestions = data.quiz;
  quizAnswers = {};
  quizSubmitted = false;
  const pages = data.source_pages?.join(', ') || '—';

  let html = `
    <div class="output-header">
      <div>
        <h2>Quiz — ${escapeHtml(data.topic)}</h2>
        <span class="source-pages">Based on pages: ${pages} &nbsp;·&nbsp; ${quizQuestions.length} questions</span>
      </div>
    </div>
    <div class="quiz-container" id="quizContainer">`;

  quizQuestions.forEach((q, i) => {
    html += `
      <div class="quiz-question-block" id="qblock-${i}">
        <div class="quiz-q-header">
          <span class="quiz-q-num">Q${i + 1}</span>
          <p class="quiz-q-text">${escapeHtml(q.question)}</p>
        </div>
        <div class="quiz-options">
          ${q.options.map((opt, j) => {
            const letter = ['A','B','C','D'][j];
            return `<div class="quiz-option" id="opt-${i}-${letter}" onclick="selectAnswer(${i}, '${letter}')">
              <span class="quiz-opt-letter">${letter}</span>
              <span class="quiz-opt-text">${escapeHtml(opt.replace(/^[A-D][.)]\s*/, ''))}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="quiz-explanation hidden" id="exp-${i}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${escapeHtml(q.explanation)}
        </div>
      </div>`;
  });

  html += `
    </div>
    <div class="quiz-footer">
      <button class="btn-primary" id="submitQuizBtn" onclick="submitQuiz()" style="min-width:160px">Submit quiz</button>
      <span class="quiz-progress" id="quizProgress">0 / ${quizQuestions.length} answered</span>
    </div>`;

  document.getElementById('generateOutput').innerHTML = html;
}

function selectAnswer(qIndex, letter) {
  if (quizSubmitted) return;

  quizAnswers[qIndex] = letter;

  ['A','B','C','D'].forEach(l => {
    const el = document.getElementById(`opt-${qIndex}-${l}`);
    if (el) {
      el.classList.remove('selected');
    }
  });

  const selected = document.getElementById(`opt-${qIndex}-${letter}`);
  if (selected) selected.classList.add('selected');

  const answered = Object.keys(quizAnswers).length;
  const progress = document.getElementById('quizProgress');
  if (progress) progress.textContent = `${answered} / ${quizQuestions.length} answered`;
}

function submitQuiz() {
  if (quizSubmitted) return;

  const answered = Object.keys(quizAnswers).length;
  if (answered < quizQuestions.length) {
    if (!confirm(`You've only answered ${answered} of ${quizQuestions.length} questions. Submit anyway?`)) return;
  }

  quizSubmitted = true;
  let correct = 0;

  quizQuestions.forEach((q, i) => {
    const userAnswer = quizAnswers[i];
    const correctAnswer = q.answer.trim().toUpperCase();
    const isCorrect = userAnswer === correctAnswer;
    if (isCorrect) correct++;

    ['A','B','C','D'].forEach(l => {
      const el = document.getElementById(`opt-${i}-${l}`);
      if (!el) return;
      el.classList.remove('selected');
      el.style.cursor = 'default';
      if (l === correctAnswer) {
        el.classList.add('correct');
      } else if (l === userAnswer && !isCorrect) {
        el.classList.add('incorrect');
      }
    });

    const expEl = document.getElementById(`exp-${i}`);
    if (expEl) expEl.classList.remove('hidden');
  });

  const pct = Math.round((correct / quizQuestions.length) * 100);
  let grade, gradeColor;
  if (pct >= 90) { grade = 'Excellent!'; gradeColor = '#166534'; }
  else if (pct >= 75) { grade = 'Good job!'; gradeColor = '#1d4ed8'; }
  else if (pct >= 60) { grade = 'Keep practicing'; gradeColor = '#b45309'; }
  else { grade = 'Needs more study'; gradeColor = '#c0392b'; }

  const footer = document.querySelector('.quiz-footer');
  if (footer) {
    footer.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-score" style="color:${gradeColor}">${correct} / ${quizQuestions.length}</div>
        <div class="quiz-grade" style="color:${gradeColor}">${grade}</div>
        <div class="quiz-pct">${pct}% correct</div>
      </div>
      <button class="btn-secondary" onclick="generateQuiz()">Retake quiz</button>`;
  }
}

function renderExercises(data) {
  const output = document.getElementById('generateOutput');
  const pages = data.source_pages?.join(', ') || '—';
  const exercises = data.exercises;
  const difficulty = document.getElementById('exDifficulty').value;

  const typeColors = {
    calculation: { bg: '#eff6ff', color: '#1d4ed8', label: 'Calculation' },
    conceptual:  { bg: '#faf5ff', color: '#7c3aed', label: 'Conceptual' },
    application: { bg: '#f0fdf4', color: '#16a34a', label: 'Application' },
  };

  const diffColors = {
    easy:   { bg: '#f0fdf4', color: '#16a34a' },
    medium: { bg: '#fff7ed', color: '#c2410c' },
    hard:   { bg: '#fff0f0', color: '#c0392b' },
  };

  const diff = diffColors[difficulty] || diffColors.medium;

  let html = `
    <div class="output-header">
      <div>
        <h2>Exercises — ${escapeHtml(data.topic)}</h2>
        <span class="source-pages">Generated from pages: ${pages} &nbsp;·&nbsp; ${exercises.length} exercises</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:0.72rem;font-weight:700;font-family:'Syne',sans-serif;padding:3px 10px;border-radius:4px;background:${diff.bg};color:${diff.color};letter-spacing:0.04em">${difficulty.toUpperCase()}</span>
        <button class="btn-secondary" onclick="toggleAllAnswers()">Show answers</button>
      </div>
    </div>
    <div class="ex-list" id="copyTarget">`;

  exercises.forEach((ex, i) => {
    const type = ex.type?.toLowerCase() || 'calculation';
    const tc = typeColors[type] || typeColors.calculation;
    html += `
      <div class="ex-card">
        <div class="ex-card-header">
          <div class="ex-card-left">
            <span class="ex-num-badge">Exercise ${ex.number || i + 1}</span>
            <span class="ex-type-badge" style="background:${tc.bg};color:${tc.color}">${tc.label}</span>
          </div>
          <button class="ex-answer-toggle" onclick="toggleAnswer(${i})" id="toggleBtn-${i}">
            Show answer
          </button>
        </div>
        <p class="ex-question">${escapeHtml(ex.question)}</p>
        <div class="ex-answer hidden" id="answer-${i}">
          <div class="ex-answer-inner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${escapeHtml(ex.answer)}</span>
          </div>
        </div>
      </div>`;
  });

  html += `</div>`;
  output.innerHTML = html;
}

let answersVisible = false;
function toggleAllAnswers() {
  answersVisible = !answersVisible;
  document.querySelectorAll('[id^="answer-"]').forEach(el => {
    el.classList.toggle('hidden', !answersVisible);
  });
  document.querySelectorAll('[id^="toggleBtn-"]').forEach(btn => {
    btn.textContent = answersVisible ? 'Hide answer' : 'Show answer';
  });
  document.querySelector('.btn-secondary[onclick="toggleAllAnswers()"]').textContent =
    answersVisible ? 'Hide all answers' : 'Show answers';
}

function toggleAnswer(i) {
  const el = document.getElementById(`answer-${i}`);
  const btn = document.getElementById(`toggleBtn-${i}`);
  el.classList.toggle('hidden');
  btn.textContent = el.classList.contains('hidden') ? 'Show answer' : 'Hide answer';
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
  document.getElementById('flashcardInner').classList.remove('flipped');
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
      <p style="color:var(--gray-500);font-size:0.875rem;margin-top:1rem">${msg}</p>
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
  navigator.clipboard.writeText(el.innerText).then(() => alert('Copied to clipboard!'));
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
  if (!flashcards.length || quizQuestions.length) return;
  if (e.key === 'ArrowRight') nextCard();
  if (e.key === 'ArrowLeft') prevCard();
  if (e.key === ' ') { e.preventDefault(); flipCard(); }
});