// ── Upload ───────────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
const pdfInput = document.getElementById('pdfInput');
const uploadStatus = document.getElementById('uploadStatus');

uploadZone.addEventListener('click', () => pdfInput.click());

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

pdfInput.addEventListener('change', () => {
  if (pdfInput.files[0]) uploadFile(pdfInput.files[0]);
});

function showStatus(message, type) {
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status ${type}`;
  uploadStatus.classList.remove('hidden');
}

async function uploadFile(file) {
  if (!file.name.endsWith('.pdf')) {
    showStatus('Only PDF files are supported.', 'error');
    return;
  }

  showStatus('Uploading and processing PDF...', 'loading');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload/', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') },
    });

    const data = await res.json();

    if (data.success) {
      showStatus(`Uploaded "${data.document_name}" — ${data.exercise_count} exercises found.`, 'success');
      addDocumentToSelect(data.document_id, data.document_name);
    } else {
      showStatus(data.error || 'Upload failed.', 'error');
    }
  } catch (err) {
    showStatus('Network error. Make sure the server is running.', 'error');
  }
}

function addDocumentToSelect(id, name) {
  const select = document.getElementById('docSelect');
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = name;
  opt.selected = true;
  select.appendChild(opt);
}

// ── Fetch exercises ──────────────────────────────────────────────
async function fetchExercises() {
  const docId = document.getElementById('docSelect').value;
  const exerciseRaw = document.getElementById('exerciseInput').value.trim();
  const page = document.getElementById('pageInput').value.trim();

  if (!docId) { alert('Please select a document first.'); return; }
  if (!exerciseRaw) { alert('Please enter exercise numbers.'); return; }
  if (!page) { alert('Please enter a page number.'); return; }

  const exerciseNumbers = exerciseRaw.split(',').map(s => s.trim()).filter(Boolean);

  const btn = document.getElementById('findBtn');
  btn.textContent = 'Searching...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/exercises/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ document_id: docId, page, exercise_numbers: exerciseNumbers }),
    });

    const data = await res.json();
    renderResults(data);
  } catch (err) {
    renderError('Network error. Make sure the server is running.');
  } finally {
    btn.textContent = 'Find exercises';
    btn.disabled = false;
  }
}

function renderResults(data) {
  const panel = document.getElementById('resultsPanel');

  if (data.error) { renderError(data.error); return; }

  let html = '<div class="results-content">';

  if (data.message) {
    html += `<div class="results-note">${data.message}</div>`;
  }

  if (data.exercises && data.exercises.length > 0) {
    data.exercises.forEach(ex => {
      html += `
        <div class="exercise-card">
          <div class="exercise-card-header">
            <span class="exercise-tag">Exercise ${ex.exercise_number} — Page ${ex.page_number}</span>
            <button class="btn-primary" style="padding:0.4rem 0.9rem;font-size:0.8rem" onclick='solveExercise(${JSON.stringify(ex.content)})'>
              Get AI solution
            </button>
          </div>
          <div class="exercise-card-body">${escapeHtml(ex.content)}</div>
        </div>`;
    });
  }

  if (data.page_content) {
    html += `<div class="results-note">Showing raw page content — no exercise patterns matched.</div>`;
    html += `<div class="page-raw">${escapeHtml(data.page_content)}</div>`;
  }

  if (!data.exercises?.length && !data.page_content) {
    html += `<div class="results-placeholder" style="height:300px"><p>No exercises found for those parameters.</p></div>`;
  }

  html += '</div>';
  panel.innerHTML = html;
}

function renderError(msg) {
  document.getElementById('resultsPanel').innerHTML = `
    <div class="results-placeholder" style="height:300px">
      <p style="color:#c0392b">${msg}</p>
    </div>`;
}

// ── Solve ────────────────────────────────────────────────────────
async function solveExercise(content) {
  const modal = document.getElementById('solveModal');
  const body = document.getElementById('modalBody');
  modal.classList.remove('hidden');
  body.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const res = await fetch('/api/solve/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ content }),
    });

    const data = await res.json();

    let html = `<div class="solution-text">${escapeHtml(data.solution)}</div>`;

    if (data.similar_exercises?.length) {
      html += `<div class="similar-title">Similar exercises to practice</div>`;
      data.similar_exercises.forEach(ex => {
        html += `<div class="similar-item">${escapeHtml(ex)}</div>`;
      });
    }

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = '<p style="color:#c0392b">Failed to get solution. Check your API key.</p>';
  }
}

function closeModal() {
  document.getElementById('solveModal').classList.add('hidden');
}

document.getElementById('solveModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── Helpers ──────────────────────────────────────────────────────
function getCookie(name) {
  const val = `; ${document.cookie}`;
  const parts = val.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}