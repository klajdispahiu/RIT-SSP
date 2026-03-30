let currentYear, currentMonth, allEvents = [];

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

async function init() {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  await loadEvents();
  renderCalendar();
  renderUpcoming();
}

async function loadEvents() {
  try {
    const res = await fetch('/api/calendar/', {
      headers: { 'X-CSRFToken': getCookie('csrftoken') }
    });
    const data = await res.json();
    allEvents = data.events || [];
  } catch (e) {
    allEvents = [];
  }
}

function renderCalendar() {
  document.getElementById('calTitle').textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  const container = document.getElementById('calDays');
  container.style.gridColumn = '1 / -1';
  container.style.display = 'contents';

  container.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell empty';
    container.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';

    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear() === currentYear &&
                    today.getMonth() === currentMonth &&
                    today.getDate() === d;

    const dayEvents = allEvents.filter(e => e.date === dateStr);
    const hasExam = dayEvents.some(e => e.event_type === 'exam');
    const hasAssignment = dayEvents.some(e => e.event_type === 'assignment');

    if (hasExam && hasAssignment) cell.classList.add('has-both');
    else if (hasExam) cell.classList.add('has-exam');
    else if (hasAssignment) cell.classList.add('has-assignment');

    if (isToday) cell.classList.add('today');

    const numEl = document.createElement('span');
    numEl.className = 'cal-day-num';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (dayEvents.length > 0) {
      const dotsEl = document.createElement('div');
      dotsEl.className = 'cal-dots';
      dayEvents.slice(0, 3).forEach(ev => {
        const dot = document.createElement('span');
        dot.className = `cal-dot ${ev.event_type}`;
        dotsEl.appendChild(dot);
      });
      cell.appendChild(dotsEl);
    }

    cell.addEventListener('click', () => {
      document.getElementById('eventDate').value = dateStr;
      if (dayEvents.length > 0) showDayPopup(dateStr, dayEvents);
    });

    container.appendChild(cell);
  }
}

function showDayPopup(dateStr, events) {
  const existing = document.getElementById('dayPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'dayPopup';
  popup.className = 'day-popup';

  const label = document.createElement('div');
  label.className = 'day-popup-title';
  label.textContent = formatDate(dateStr);
  popup.appendChild(label);

  events.forEach(ev => {
    const item = document.createElement('div');
    item.className = `day-popup-item ${ev.event_type}`;
    item.innerHTML = `
      <span class="popup-type-badge ${ev.event_type}">${ev.event_type}</span>
      <span class="popup-title">${ev.title}</span>
      ${ev.subject ? `<span class="popup-subject">${ev.subject}</span>` : ''}
      <button class="popup-delete" onclick="deleteEvent(${ev.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    popup.appendChild(item);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'day-popup-close';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => popup.remove();
  popup.appendChild(closeBtn);

  document.querySelector('.calendar-main').appendChild(popup);
}

function renderUpcoming() {
  const list = document.getElementById('upcomingList');
  const today = new Date().toISOString().split('T')[0];
  const upcoming = allEvents
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  if (upcoming.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:1rem 0"><p>No upcoming events.</p></div>';
    return;
  }

  list.innerHTML = upcoming.map(ev => `
    <div class="upcoming-item">
      <div class="upcoming-date-block ${ev.event_type}">
        <span class="upcoming-month">${MONTHS[parseInt(ev.date.split('-')[1]) - 1].slice(0,3)}</span>
        <span class="upcoming-day">${parseInt(ev.date.split('-')[2])}</span>
      </div>
      <div class="upcoming-info">
        <span class="upcoming-title">${ev.title}</span>
        ${ev.subject ? `<span class="upcoming-subject">${ev.subject}</span>` : ''}
        <span class="upcoming-type-tag ${ev.event_type}">${ev.event_type}</span>
      </div>
      <button class="doc-delete" onclick="deleteEvent(${ev.id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>`).join('');
}

async function addEvent() {
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const event_type = document.getElementById('eventType').value;
  const subject = document.getElementById('eventSubject').value;
  const statusEl = document.getElementById('eventStatus');

  if (!title) { showStatus(statusEl, 'Please enter a title.', 'error'); return; }
  if (!date) { showStatus(statusEl, 'Please select a date.', 'error'); return; }

  try {
    const res = await fetch('/api/calendar/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ title, date, event_type, subject }),
    });

    const data = await res.json();
    if (data.success) {
      allEvents.push(data.event);
      document.getElementById('eventTitle').value = '';
      document.getElementById('eventDate').value = '';
      showStatus(statusEl, 'Event added!', 'success');
      renderCalendar();
      renderUpcoming();
      setTimeout(() => statusEl.classList.add('hidden'), 2000);
    } else {
      showStatus(statusEl, data.error || 'Failed to add event.', 'error');
    }
  } catch (e) {
    showStatus(statusEl, 'Network error.', 'error');
  }
}

async function deleteEvent(id) {
  try {
    await fetch('/api/calendar/', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ id }),
    });
    allEvents = allEvents.filter(e => e.id !== id);
    const popup = document.getElementById('dayPopup');
    if (popup) popup.remove();
    renderCalendar();
    renderUpcoming();
  } catch (e) {
    alert('Failed to delete event.');
  }
}

document.getElementById('prevBtn').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

document.getElementById('nextBtn').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

function formatDate(str) {
  const [y, m, d] = str.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
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

init();