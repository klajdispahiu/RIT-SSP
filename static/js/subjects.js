document.querySelectorAll('.subject-upload').forEach((zone, idx) => {
  const num = idx + 1;
  const input = document.getElementById(`input-${num}`);
  const status = document.getElementById(`status-${num}`);
  const subject = zone.dataset.subject;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadSubjectFile(file, subject, status, zone);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) uploadSubjectFile(input.files[0], subject, status, zone);
  });
});

async function uploadSubjectFile(file, subject, statusEl, zone) {
  if (!file.name.endsWith('.pdf')) {
    showSubjectStatus(statusEl, 'Only PDF files are supported.', 'error');
    return;
  }

  showSubjectStatus(statusEl, 'Uploading and processing...', 'loading');
  zone.style.pointerEvents = 'none';
  zone.style.opacity = '0.6';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('subject', subject);

  try {
    const res = await fetch('/api/upload/', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRFToken': getCookie('csrftoken') },
    });

    const data = await res.json();

    if (data.success) {
      showSubjectStatus(statusEl, `"${data.document_name}" uploaded — ${data.exercise_count} exercises found.`, 'success');
      setTimeout(() => location.reload(), 1500);
    } else {
      showSubjectStatus(statusEl, data.error || 'Upload failed.', 'error');
    }
  } catch (err) {
    showSubjectStatus(statusEl, 'Network error. Make sure the server is running.', 'error');
  } finally {
    zone.style.pointerEvents = '';
    zone.style.opacity = '';
  }
}

function showSubjectStatus(el, message, type) {
  el.textContent = message;
  el.className = `subject-status ${type}`;
  el.classList.remove('hidden');
}

function getCookie(name) {
  const val = `; ${document.cookie}`;
  const parts = val.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}