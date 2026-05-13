/* ============================================================
   ChronoSync — app.js
   Collaborative Calendar · Time Management System
   ============================================================ */

'use strict';

/* ── CONSTANTS ─────────────────────────────────────────────── */

const COLORS = [
  '#4f9cf9','#a78bfa','#34d399','#fb923c',
  '#f87171','#fbbf24','#e879f9','#2dd4bf',
  '#f472b6','#a3e635'
];

const URGENCY = [
  { key: 'critical', label: 'Critical', color: '#f87171' },
  { key: 'high',     label: 'High',     color: '#fb923c' },
  { key: 'medium',   label: 'Medium',   color: '#fbbf24' },
  { key: 'low',      label: 'Low',      color: '#34d399' }
];

const CATEGORIES = [
  { key: 'work',     label: 'Work',     color: '#4f9cf9' },
  { key: 'personal', label: 'Personal', color: '#a78bfa' },
  { key: 'health',   label: 'Health',   color: '#34d399' },
  { key: 'social',   label: 'Social',   color: '#fb923c' },
  { key: 'urgent',   label: 'Urgent',   color: '#f87171' },
  { key: 'focus',    label: 'Focus',    color: '#fbbf24' }
];

const USERS = [
  { name: 'Alex Kim',    initials: 'AK', color: '#4f9cf9', status: 'online' },
  { name: 'Priya Shah',  initials: 'PS', color: '#a78bfa', status: 'online' },
  { name: 'Jordan Lee',  initials: 'JL', color: '#34d399', status: 'away'   },
  { name: 'Marcus T.',   initials: 'MT', color: '#fb923c', status: 'online' },
  { name: 'Yuki O.',     initials: 'YO', color: '#fbbf24', status: 'busy'   }
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STORAGE_KEY = 'chronosync_events';

/* ── STATE ──────────────────────────────────────────────────── */

let events        = [];
let selectedColor = COLORS[0];
let selectedUrgency = 'medium';
let currentLabels = [];
let view          = 'month';
let navDate       = new Date();
let miniNavDate   = new Date();
let selectedDay   = null;
let editingId     = null;

// The currently logged-in user (index into USERS array).
// In a real app this would come from an auth system.
let currentUserIndex = 0;

/* ── DATE HELPERS ───────────────────────────────────────────── */

function pad(n) { return String(n).padStart(2, '0'); }

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addHour(t) {
  const [h, m] = t.split(':');
  return `${pad((+h + 1) % 24)}:${m}`;
}

/* ── STORAGE ────────────────────────────────────────────────── */

function loadEvents() {
  try {
    events = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    events = [];
  }
  if (!events.length) seedDemoEvents();
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/* ── SEED DATA ──────────────────────────────────────────────── */

function seedDemoEvents() {
  const t    = new Date();
  const y    = t.getFullYear();
  const mon  = pad(t.getMonth() + 1);
  const d    = pad(t.getDate());

  const tom  = new Date(t); tom.setDate(tom.getDate() + 1);
  const ty   = tom.getFullYear(), tm = pad(tom.getMonth() + 1), td = pad(tom.getDate());

  const nxt  = new Date(t); nxt.setDate(nxt.getDate() + 3);
  const ny   = nxt.getFullYear(), nm = pad(nxt.getMonth() + 1), nd = pad(nxt.getDate());

  const prev = new Date(t); prev.setDate(prev.getDate() - 1);
  const pdat = toDateStr(prev);

  events = [
    {
      id: 1, title: 'Team Stand-up',
      date: `${y}-${mon}-${d}`, start: '09:00', end: '09:30',
      category: 'work', color: '#4f9cf9', urgency: 'high',
      labels: ['daily', 'remote'],
      desc: 'Morning sync with the full team.',
      createdBy: 'Alex Kim', createdByInitials: 'AK', createdByColor: '#4f9cf9'
    },
  ];
  saveEvents();
}

/* ── CURRENT USER ───────────────────────────────────────────── */

function getCurrentUser() {
  return USERS[currentUserIndex];
}

function switchCurrentUser(idx) {
  currentUserIndex = idx;
  renderUserSwitcher();
  renderUserPills();
  showToast(`Switched to ${USERS[idx].name}`, USERS[idx].color);
}

/** Renders the active-user dropdown in the header */
function renderUserSwitcher() {
  const el = document.getElementById('currentUserBtn');
  if (!el) return;
  const u = getCurrentUser();
  el.innerHTML = `
    <div class="avatar" style="background:${u.color}">${u.initials}</div>
    <span style="font-size:12px;font-weight:500">${u.name.split(' ')[0]}</span>
    <div class="online-dot"></div>
    <span style="font-size:10px;color:var(--muted);margin-left:2px">▾</span>
  `;
}

/** Renders the user switcher dropdown list */
function renderUserDropdown() {
  const el = document.getElementById('userDropdown');
  if (!el) return;
  el.innerHTML = USERS.map((u, i) => `
    <div class="user-dropdown-item ${i === currentUserIndex ? 'active' : ''}"
         onclick="switchCurrentUser(${i});toggleUserDropdown(false)">
      <div class="avatar" style="background:${u.color};width:22px;height:22px;font-size:10px">${u.initials}</div>
      <span>${u.name}</span>
      ${i === currentUserIndex ? '<span style="margin-left:auto;color:var(--accent);font-size:11px">✓</span>' : ''}
    </div>
  `).join('');
}

let dropdownOpen = false;
function toggleUserDropdown(force) {
  dropdownOpen = force !== undefined ? force : !dropdownOpen;
  const dd = document.getElementById('userDropdown');
  if (dd) {
    dd.style.display = dropdownOpen ? 'flex' : 'none';
    if (dropdownOpen) renderUserDropdown();
  }
}

/* ── SIDEBAR: USER PILLS ────────────────────────────────────── */

function renderUserPills() {
  const el = document.getElementById('userPills');
  if (!el) return;
  el.innerHTML = USERS.slice(0, 4).map(u => `
    <div class="user-pill" title="${u.name} · ${u.status}">
      <div class="avatar" style="background:${u.color}">${u.initials}</div>
      <span style="font-size:12px">${u.name.split(' ')[0]}</span>
      <div class="online-dot"
           style="background:${u.status === 'online' ? '#34d399' : u.status === 'away' ? '#fbbf24' : '#f87171'}">
      </div>
    </div>
  `).join('');
}

/* ── SIDEBAR: ONLINE LIST ───────────────────────────────────── */

function renderOnlineList() {
  const el = document.getElementById('onlineList');
  if (!el) return;
  el.innerHTML = USERS.map(u => `
    <div class="online-item">
      <div class="avatar" style="background:${u.color};width:24px;height:24px;font-size:10px">
        ${u.initials}
      </div>
      <span class="online-name">${u.name}</span>
      <div class="status-dot ${u.status}" style="margin-left:auto" title="${u.status}"></div>
    </div>
  `).join('');

  const counter = document.getElementById('onlineText');
  if (counter) {
    counter.textContent = USERS.filter(u => u.status === 'online').length + ' online';
  }
}

/* ── SIDEBAR: CATEGORY LIST ─────────────────────────────────── */

function renderCatList() {
  const el = document.getElementById('catList');
  if (!el) return;
  el.innerHTML = CATEGORIES.map(c => {
    const cnt = events.filter(e => e.category === c.key).length;
    return `
      <div class="cat-item">
        <div class="cat-dot" style="background:${c.color}"></div>
        <span class="cat-name">${c.label}</span>
        <span class="cat-count">${cnt}</span>
      </div>
    `;
  }).join('');
}

/* ── MINI CALENDAR ──────────────────────────────────────────── */

function renderMiniCal() {
  const el = document.getElementById('miniMonthLabel');
  if (!el) return;

  const d = new Date(miniNavDate.getFullYear(), miniNavDate.getMonth(), 1);
  el.textContent = MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();

  const dayNames = DAYS_SHORT.map(dn => `<div class="day-name">${dn[0]}</div>`).join('');
  const startDay = d.getDay();
  const totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
  const todayStr = todayDate();

  let html = dayNames;

  // Trailing days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    html += `<div class="mini-day other-month">${prevMonthDays - i}</div>`;
  }

  // Days of current month
  for (let i = 1; i <= totalDays; i++) {
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i)}`;
    const hasEv   = events.some(e => e.date === dateStr);
    const isToday = dateStr === todayStr;
    const isSel   = dateStr === selectedDay;
    html += `
      <div class="mini-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${hasEv ? 'has-event' : ''}"
           onclick="selectDay('${dateStr}')">${i}</div>
    `;
  }

  // Leading days of next month
  const remaining = 42 - startDay - totalDays;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="mini-day other-month">${i}</div>`;
  }

  document.getElementById('miniCal').innerHTML = html;
}

function miniNavMonth(dir) {
  miniNavDate.setMonth(miniNavDate.getMonth() + dir);
  renderMiniCal();
}

function selectDay(dateStr) {
  selectedDay = dateStr;
  navDate = new Date(dateStr + 'T12:00:00');
  renderView();
  renderMiniCal();
  showDayPanel(dateStr);
}

/* ── AUTHOR HELPER ──────────────────────────────────────────── */

/**
 * Returns a small author avatar + name chip HTML string.
 * Used in event cards across all views.
 */
function authorChip(ev, size = 'sm') {
  const name    = ev.createdBy       || 'Unknown';
  const initials = ev.createdByInitials || name.slice(0, 2).toUpperCase();
  const color   = ev.createdByColor  || '#7a7d8c';
  const fontSize = size === 'sm' ? '9px' : '11px';
  const avSize  = size === 'sm' ? '14px' : '20px';
  const avFont  = size === 'sm' ? '7px'  : '9px';
  return `
    <span class="author-chip" title="Created by ${name}">
      <span class="author-av" style="
        width:${avSize};height:${avSize};font-size:${avFont};background:${color}
      ">${initials}</span>
      <span style="font-size:${fontSize};color:rgba(255,255,255,0.65)">${name}</span>
    </span>
  `;
}

/* ── COUNTDOWN & PROGRESS ───────────────────────────────────── */

function getCountdown(ev) {
  const now   = new Date();
  const start = new Date(ev.date + 'T' + ev.start + ':00');
  const end   = new Date(ev.date + 'T' + ev.end   + ':00');

  if (now >= start && now <= end) return 'In progress';

  if (now < start) {
    const diff = start - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 48) { const days = Math.floor(h / 24); return `Starts in ${days}d`; }
    if (h > 0)  return `Starts in ${h}h ${m}m`;
    if (m > 0)  return `Starts in ${m}m`;
    return 'Starting soon';
  }
  return 'Past';
}

function getProgress(ev) {
  const now   = new Date();
  const start = new Date(ev.date + 'T' + ev.start + ':00');
  const end   = new Date(ev.date + 'T' + ev.end   + ':00');
  if (now >= start && now <= end) {
    return Math.round(((now - start) / (end - start)) * 100);
  }
  return null;
}

/* ── EVENT PANEL ────────────────────────────────────────────── */

function showDayPanel(dateStr) {
  const panel = document.getElementById('eventPanel');
  if (!panel) return;
  panel.classList.remove('hidden');

  const dayEvents = events
    .filter(e => e.date === dateStr)
    .sort((a, b) => a.start.localeCompare(b.start));

  const d = new Date(dateStr + 'T12:00:00');
  document.getElementById('panelTitle').textContent =
    `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

  if (!dayEvents.length) {
    document.getElementById('panelEvents').innerHTML =
      `<p style="color:var(--muted);font-size:13px;padding:8px 0">No events this day.
       <br><button class="btn" style="margin-top:10px;font-size:12px"
         onclick="openModalDate('${dateStr}','09:00')">+ Add Event</button></p>`;
    return;
  }

  document.getElementById('panelEvents').innerHTML = dayEvents.map(ev => {
    const urg       = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
    const countdown = getCountdown(ev);
    const progress  = getProgress(ev);
    const bgDark    = hexToRgba(ev.color, 0.18);

    return `
      <div class="panel-event-card" id="pcard-${ev.id}"
           style="background:${bgDark};border-left-color:${ev.color}">

        <!-- Card header row: title + action buttons -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="openEditModal('${ev.id}')">
            <div class="pev-title">${ev.title}</div>
            <div class="pev-time">${ev.start} – ${ev.end}</div>
          </div>
          <!-- Action buttons -->
          <div style="display:flex;gap:4px;flex-shrink:0;margin-top:1px">
            <button class="pev-action-btn pev-edit-btn"
                    title="Edit event"
                    onclick="openEditModal('${ev.id}')">✎</button>
            <button class="pev-action-btn pev-delete-btn"
                    title="Delete event"
                    onclick="confirmDeleteEvent('${ev.id}','${ev.title.replace(/'/g,"\\'")}')">✕</button>
          </div>
        </div>

        <!-- Author -->
        <div style="margin-top:5px;cursor:pointer" onclick="openEditModal('${ev.id}')">
          ${authorChip(ev, 'md')}
        </div>

        <!-- Badges -->
        <div class="pev-meta" style="cursor:pointer" onclick="openEditModal('${ev.id}')">
          <span class="badge" style="background:${urg.color}40;color:${urg.color}">
            ${urg.label}
          </span>
          <span class="badge" style="background:rgba(255,255,255,0.1)">${ev.category}</span>
        </div>

        <!-- Countdown -->
        ${countdown
          ? `<div class="pev-countdown" style="cursor:pointer" onclick="openEditModal('${ev.id}')">
               ⏱ ${countdown}
             </div>`
          : ''}

        <!-- Progress bar (if in progress) -->
        ${progress !== null
          ? `<div class="countdown-bar-wrap">
               <div class="countdown-bar" style="width:${progress}%;background:${ev.color}"></div>
             </div>`
          : ''}

        <!-- Labels -->
        ${ev.labels && ev.labels.length
          ? `<div class="pev-labels" style="cursor:pointer" onclick="openEditModal('${ev.id}')">
               ${ev.labels.map(l => `<span class="label-tag">${l}</span>`).join('')}
             </div>`
          : ''}

        <!-- Description -->
        ${ev.desc
          ? `<div class="pev-desc" style="cursor:pointer" onclick="openEditModal('${ev.id}')">${ev.desc}</div>`
          : ''}

        <!-- Inline confirm row (hidden by default, shown by confirmDeleteEvent) -->
        <div id="confirm-${ev.id}" class="pev-confirm-row" style="display:none">
          <span style="font-size:12px;color:var(--muted)">Delete "<strong style="color:var(--text)">${ev.title}</strong>"?</span>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="pev-confirm-yes"
                    onclick="deleteEvent('${ev.id}')">Yes, delete</button>
            <button class="pev-confirm-no"
                    onclick="cancelDeleteEvent('${ev.id}')">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ── VIEW SWITCHING ─────────────────────────────────────────── */

function setView(v) {
  view = v;
  ['Month', 'Week', 'Day'].forEach(x => {
    const btn = document.getElementById('v' + x);
    if (btn) btn.classList.toggle('active', x.toLowerCase() === v);
  });
  renderView();
}

function renderView() {
  if      (view === 'month') renderMonth();
  else if (view === 'week')  renderWeek();
  else                       renderDay();
  renderMiniCal();
}

function navMain(dir) {
  if      (view === 'month') navDate.setMonth(navDate.getMonth() + dir);
  else if (view === 'week')  navDate.setDate(navDate.getDate() + dir * 7);
  else                       navDate.setDate(navDate.getDate() + dir);
  renderView();
}

function goToday() {
  navDate     = new Date();
  miniNavDate = new Date();
  renderView();
}

/* ── MONTH VIEW ─────────────────────────────────────────────── */

function renderMonth() {
  const titleEl = document.getElementById('mainTitle');
  if (titleEl) titleEl.textContent = MONTHS[navDate.getMonth()] + ' ' + navDate.getFullYear();

  const area = document.getElementById('calArea');
  if (!area) return;

  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(7,1fr);flex:1;overflow:auto;width:100%';

  // Day headers
  DAYS_SHORT.forEach(d => {
    const h = document.createElement('div');
    h.className   = 'month-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay     = new Date(navDate.getFullYear(), navDate.getMonth(), 1).getDay();
  const daysInMonth  = new Date(navDate.getFullYear(), navDate.getMonth() + 1, 0).getDate();
  const prevMonDays  = new Date(navDate.getFullYear(), navDate.getMonth(), 0).getDate();
  const todayStr     = todayDate();
  const totalCells   = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    let day, month = navDate.getMonth(), year = navDate.getFullYear(), other = false;

    if (i < firstDay) {
      day = prevMonDays - firstDay + i + 1;
      month--; if (month < 0) { month = 11; year--; }
      other = true;
    } else if (i >= firstDay + daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      month++; if (month > 11) { month = 0; year++; }
      other = true;
    } else {
      day = i - firstDay + 1;
    }

    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const dayEvs  = events
      .filter(e => e.date === dateStr)
      .sort((a, b) => a.start.localeCompare(b.start));
    const isToday = dateStr === todayStr;

    const cell = document.createElement('div');
    cell.className = `month-cell ${isToday ? 'today-cell' : ''} ${other ? 'other-month-cell' : ''}`;
    cell.innerHTML = `
      <div class="month-date-num ${isToday ? 'today-cell-num' : ''}">${day}</div>
    `;

    // Up to 3 events shown inline
    dayEvs.slice(0, 3).forEach(ev => {
      const e = document.createElement('div');
      e.className   = 'month-event';
      e.style.cssText = `
        background:${hexToRgba(ev.color, 0.22)};
        color:${ev.color};
        border-left:3px solid ${ev.color};
      `;
      const urg = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
      // Show title + author initials in month view
      e.innerHTML = `
        <span>${ev.start} ${ev.title}</span>
        <span class="month-ev-author" title="By ${ev.createdBy || 'Unknown'}"
              style="border-radius:50%;background:${ev.createdByColor||'#7a7d8c'};
                     color:#fff;font-size:8px;font-weight:700;
                     width:13px;height:13px;display:inline-flex;align-items:center;
                     justify-content:center;margin-left:4px;vertical-align:middle;flex-shrink:0">
          ${(ev.createdByInitials || '?')}
        </span>
      `;
      e.title = `${ev.title} · ${urg.label} · by ${ev.createdBy || 'Unknown'}`;
      e.onclick = x => { x.stopPropagation(); selectDay(dateStr); };
      cell.appendChild(e);
    });

    if (dayEvs.length > 3) {
      const more = document.createElement('div');
      more.className   = 'month-more';
      more.textContent = `+${dayEvs.length - 3} more`;
      more.onclick = x => { x.stopPropagation(); selectDay(dateStr); };
      cell.appendChild(more);
    }

    cell.onclick = () => selectDay(dateStr);
    grid.appendChild(cell);
  }

  area.innerHTML = '';
  area.appendChild(grid);
}

/* ── WEEK VIEW ──────────────────────────────────────────────── */

function renderWeek() {
  const startOfWeek = new Date(navDate);
  startOfWeek.setDate(navDate.getDate() - navDate.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const titleEl = document.getElementById('mainTitle');
  if (titleEl) {
    titleEl.textContent =
      `${MONTHS[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} – ` +
      `${MONTHS[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
  }

  const area = document.getElementById('calArea');
  if (!area) return;

  const wrap = document.createElement('div');
  wrap.className = 'week-wrapper';
  wrap.style.flex = '1';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:56px repeat(7,1fr);';

  // Corner header cell
  const cornerHead = document.createElement('div');
  cornerHead.className = 'week-header-cell';
  cornerHead.style.cssText =
    'grid-column:1;grid-row:1;position:sticky;top:0;z-index:11;' +
    'background:var(--surface);border-bottom:1px solid var(--border)';
  grid.appendChild(cornerHead);

  const todayStr = todayDate();

  // Day header cells
  for (let d = 0; d < 7; d++) {
    const day  = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + d);
    const dStr    = toDateStr(day);
    const isToday = dStr === todayStr;

    const h = document.createElement('div');
    h.className = 'week-header-cell day-col';
    h.style.cssText =
      `grid-column:${d + 2};grid-row:1;position:sticky;top:0;z-index:10;background:var(--surface)`;
    h.innerHTML = `
      <span class="day-label">${DAYS_SHORT[day.getDay()]}</span>
      <span class="day-num ${isToday ? 'today-num' : ''}">${day.getDate()}</span>
    `;
    h.onclick = () => selectDay(dStr);
    grid.appendChild(h);
  }

  // Hour rows (background grid cells)
  for (let h = 0; h < 24; h++) {
    const ts = document.createElement('div');
    ts.className = 'time-slot';
    ts.style.cssText = `grid-column:1;grid-row:${h + 2}`;
    ts.textContent = h === 0 ? '' : `${pad(h)}:00`;
    grid.appendChild(ts);

    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      cell.className = 'day-column';
      cell.style.cssText =
        `grid-column:${d + 2};grid-row:${h + 2};` +
        `height:56px;border-bottom:1px solid var(--border)`;

      const day  = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + d);
      const dStr = toDateStr(day);
      cell.onclick = e => {
        if (e.target === cell) openModalDate(dStr, `${pad(h)}:00`);
      };
      grid.appendChild(cell);
    }
  }

  // Overlay per day column for events + now-line
  for (let d = 0; d < 7; d++) {
    const day  = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + d);
    const dStr = toDateStr(day);

    const overlay = document.createElement('div');
    overlay.style.cssText =
      `grid-column:${d + 2};grid-row:2/${24 + 2};position:relative;pointer-events:none;`;
    overlay.style.pointerEvents = 'auto';

    // Place events
    events
      .filter(e => e.date === dStr)
      .forEach(ev => {
        const [sh, sm] = ev.start.split(':').map(Number);
        const [eh, em] = ev.end.split(':').map(Number);
        const topPx    = (sh * 60 + sm) / 60 * 56;
        const heightPx = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 56, 24);

        const evEl = document.createElement('div');
        evEl.className  = 'cal-event';
        evEl.style.cssText =
          `top:${topPx}px;height:${heightPx}px;` +
          `background:${hexToRgba(ev.color, 0.22)};` +
          `border-left:3px solid ${ev.color};color:${ev.color};` +
          `left:3px;right:3px;`;

        const urg = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
        const cd  = getCountdown(ev);

        evEl.innerHTML = `
          <div class="ev-title">${ev.title}</div>
          <div class="ev-time">${ev.start}–${ev.end}</div>
          ${heightPx > 48
            ? `<span class="ev-urgency-badge"
                     style="background:${urg.color}40;color:${urg.color}">
                 ${urg.label}
               </span>`
            : ''}
          ${heightPx > 60 && cd
            ? `<div class="ev-countdown">${cd}</div>`
            : ''}
          ${heightPx > 72
            ? authorChip(ev, 'sm')
            : ''}
        `;
        evEl.onclick = e => { e.stopPropagation(); selectDay(dStr); };
        overlay.appendChild(evEl);
      });

    // Now-line
    const now = new Date();
    if (now >= startOfWeek && now <= endOfWeek && now.getDay() === d) {
      const mins = now.getHours() * 60 + now.getMinutes();
      const nl   = document.createElement('div');
      nl.className  = 'now-line';
      nl.style.top  = (mins / 60 * 56) + 'px';
      overlay.appendChild(nl);
    }

    grid.appendChild(overlay);
  }

  wrap.appendChild(grid);
  area.innerHTML = '';
  area.appendChild(wrap);

  // Scroll to 7am
  requestAnimationFrame(() => { wrap.scrollTop = 7 * 56; });
}

/* ── DAY VIEW ───────────────────────────────────────────────── */

function renderDay() {
  const dStr    = toDateStr(navDate);
  const isToday = dStr === todayDate();

  const titleEl = document.getElementById('mainTitle');
  if (titleEl) {
    titleEl.textContent =
      `${DAYS_SHORT[navDate.getDay()]}, ` +
      `${MONTHS[navDate.getMonth()]} ${navDate.getDate()}, ` +
      `${navDate.getFullYear()}`;
  }

  const area = document.getElementById('calArea');
  if (!area) return;

  const wrap = document.createElement('div');
  wrap.className = 'week-wrapper';
  wrap.style.flex = '1';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:56px 1fr;';

  // Corner
  const ch = document.createElement('div');
  ch.style.cssText =
    'grid-column:1;grid-row:1;position:sticky;top:0;z-index:11;' +
    'background:var(--surface);border-bottom:1px solid var(--border);height:48px';
  grid.appendChild(ch);

  // Day header
  const dh = document.createElement('div');
  dh.className = 'week-header-cell day-col';
  dh.style.cssText =
    'grid-column:2;grid-row:1;position:sticky;top:0;z-index:10;background:var(--surface)';
  dh.innerHTML = `
    <span class="day-label">${DAYS_SHORT[navDate.getDay()]}</span>
    <span class="day-num ${isToday ? 'today-num' : ''}">${navDate.getDate()}</span>
  `;
  grid.appendChild(dh);

  // Hour rows
  for (let h = 0; h < 24; h++) {
    const ts = document.createElement('div');
    ts.className = 'time-slot';
    ts.style.cssText = `grid-column:1;grid-row:${h + 2}`;
    ts.textContent = h === 0 ? '' : `${pad(h)}:00`;
    grid.appendChild(ts);

    const cell = document.createElement('div');
    cell.className = 'day-column';
    cell.style.cssText =
      `grid-column:2;grid-row:${h + 2};height:56px;border-bottom:1px solid var(--border)`;
    cell.onclick = e => {
      if (e.target === cell) openModalDate(dStr, `${pad(h)}:00`);
    };
    grid.appendChild(cell);
  }

  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'grid-column:2;grid-row:2/26;position:relative;';

  events
    .filter(e => e.date === dStr)
    .forEach(ev => {
      const [sh, sm] = ev.start.split(':').map(Number);
      const [eh, em] = ev.end.split(':').map(Number);
      const topPx    = (sh * 60 + sm) / 60 * 56;
      const heightPx = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 56, 28);

      const evEl = document.createElement('div');
      evEl.className  = 'cal-event';
      const urg  = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
      const cd   = getCountdown(ev);
      const prog = getProgress(ev);

      evEl.style.cssText =
        `top:${topPx}px;height:${heightPx}px;` +
        `background:${hexToRgba(ev.color, 0.22)};` +
        `border-left:3px solid ${ev.color};color:${ev.color};` +
        `left:3px;right:3px;`;

      evEl.innerHTML = `
        <div class="ev-title">${ev.title}</div>
        <div class="ev-time">${ev.start}–${ev.end}</div>
        <span class="ev-urgency-badge"
              style="background:${urg.color}40;color:${urg.color}">${urg.label}</span>
        ${cd ? `<div class="ev-countdown">${cd}</div>` : ''}
        ${prog !== null
          ? `<div class="countdown-bar-wrap" style="margin-top:4px">
               <div class="countdown-bar" style="width:${prog}%;background:${ev.color}"></div>
             </div>`
          : ''}
        ${heightPx > 72 ? authorChip(ev, 'sm') : ''}
        ${ev.labels && ev.labels.length
          ? `<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">
               ${ev.labels.map(l =>
                 `<span style="font-size:9px;padding:1px 5px;border-radius:8px;
                               border:1px solid ${ev.color}40;color:${ev.color}">${l}</span>`
               ).join('')}
             </div>`
          : ''}
      `;
      evEl.onclick = () => selectDay(dStr);
      overlay.appendChild(evEl);
    });

  // Now-line
  if (isToday) {
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const nl   = document.createElement('div');
    nl.className = 'now-line';
    nl.style.top = (mins / 60 * 56) + 'px';
    overlay.appendChild(nl);
  }

  grid.appendChild(overlay);
  wrap.appendChild(grid);
  area.innerHTML = '';
  area.appendChild(wrap);

  requestAnimationFrame(() => { wrap.scrollTop = 7 * 56; });
}

/* ── MODAL ──────────────────────────────────────────────────── */

function openModal(date, time) {
  editingId = null;

  document.getElementById('evTitle').value = '';
  document.getElementById('evDate').value  = date || todayDate();
  document.getElementById('evStart').value = time  || '09:00';
  document.getElementById('evEnd').value   = time  ? addHour(time) : '10:00';
  document.getElementById('evDesc').value  = '';
  document.getElementById('evCat').value   = 'work';

  // Show current user as the author in modal
  const u = getCurrentUser();
  const authorPreview = document.getElementById('evAuthorPreview');
  if (authorPreview) {
    authorPreview.innerHTML = `
      <div class="avatar" style="background:${u.color};width:22px;height:22px;font-size:9px">
        ${u.initials}
      </div>
      <span>${u.name}</span>
    `;
  }

  currentLabels   = [];
  selectedColor   = COLORS[0];
  selectedUrgency = 'medium';
  renderLabelChips();
  renderColorSwatches();
  renderUrgencyOpts();

  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('evTitle').focus();
}

function openModalDate(date, time) { openModal(date, time); }

function openEditModal(id) {
  const ev = events.find(e => e.id == id);
  if (!ev) return;

  editingId = id;

  document.getElementById('evTitle').value = ev.title;
  document.getElementById('evDate').value  = ev.date;
  document.getElementById('evStart').value = ev.start;
  document.getElementById('evEnd').value   = ev.end;
  document.getElementById('evDesc').value  = ev.desc || '';
  document.getElementById('evCat').value   = ev.category;

  // Show original author in modal (read-only)
  const authorPreview = document.getElementById('evAuthorPreview');
  if (authorPreview) {
    const color    = ev.createdByColor    || '#7a7d8c';
    const initials = ev.createdByInitials || '?';
    const name     = ev.createdBy         || 'Unknown';
    authorPreview.innerHTML = `
      <div class="avatar" style="background:${color};width:22px;height:22px;font-size:9px">
        ${initials}
      </div>
      <span>${name}</span>
      <span style="font-size:10px;color:var(--muted)">(original author)</span>
    `;
  }

  currentLabels   = [...(ev.labels || [])];
  selectedColor   = ev.color   || COLORS[0];
  selectedUrgency = ev.urgency || 'medium';

  renderLabelChips();
  renderColorSwatches();
  renderUrgencyOpts();

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/* ── MODAL FORM HELPERS ─────────────────────────────────────── */

function renderColorSwatches() {
  const el = document.getElementById('colorSwatches');
  if (!el) return;
  el.innerHTML = COLORS.map(c =>
    `<div class="color-swatch ${c === selectedColor ? 'selected' : ''}"
          style="background:${c}"
          onclick="selectColor('${c}')"></div>`
  ).join('');
}

function selectColor(c) {
  selectedColor = c;
  renderColorSwatches();
}

function renderUrgencyOpts() {
  const el = document.getElementById('urgencyOpts');
  if (!el) return;
  el.innerHTML = URGENCY.map(u =>
    `<div class="urgency-opt ${u.key === selectedUrgency ? 'selected' : ''}"
          style="${u.key === selectedUrgency
            ? `background:${u.color}30;border-color:${u.color};color:${u.color}`
            : ''}"
          onclick="selectUrgency('${u.key}')">${u.label}</div>`
  ).join('');
}

function selectUrgency(k) {
  selectedUrgency = k;
  renderUrgencyOpts();
}

function addLabel() {
  const inp = document.getElementById('evLabelInput');
  const v   = inp.value.trim();
  if (v && !currentLabels.includes(v)) {
    currentLabels.push(v);
    inp.value = '';
    renderLabelChips();
  }
}

function removeLabel(l) {
  currentLabels = currentLabels.filter(x => x !== l);
  renderLabelChips();
}

function renderLabelChips() {
  const el = document.getElementById('labelChips');
  if (!el) return;
  el.innerHTML = currentLabels.map(l =>
    `<div class="label-chip">${l}
       <button onclick="removeLabel('${l}')">×</button>
     </div>`
  ).join('');
}

/* ── SAVE EVENT ─────────────────────────────────────────────── */

function saveEvent() {
  const title = document.getElementById('evTitle').value.trim();
  const date  = document.getElementById('evDate').value;
  const start = document.getElementById('evStart').value;
  const end   = document.getElementById('evEnd').value;
  const cat   = document.getElementById('evCat').value;
  const desc  = document.getElementById('evDesc').value.trim();

  if (!title || !date || !start || !end) {
    showToast('Please fill in all required fields.', '#f87171');
    return;
  }

  const u = getCurrentUser();

  if (editingId) {
    // Update — preserve original author, update editor info
    const idx = events.findIndex(e => e.id == editingId);
    if (idx > -1) {
      events[idx] = {
        ...events[idx],
        title, date, start, end,
        category : cat,
        color    : selectedColor,
        urgency  : selectedUrgency,
        labels   : [...currentLabels],
        desc,
        lastEditedBy       : u.name,
        lastEditedInitials : u.initials,
        lastEditedColor    : u.color
      };
    }
    showToast('Event updated by ' + u.name, selectedColor);
  } else {
    // New event — attach current user as author
    events.push({
      id                 : Date.now(),
      title, date, start, end,
      category           : cat,
      color              : selectedColor,
      urgency            : selectedUrgency,
      labels             : [...currentLabels],
      desc,
      createdBy          : u.name,
      createdByInitials  : u.initials,
      createdByColor     : u.color,
      createdAt          : new Date().toISOString()
    });
    showToast('Event added by ' + u.name, selectedColor);
  }

  saveEvents();
  closeModal();
  renderAll();
  if (selectedDay === date) showDayPanel(date);
}

/* ── DELETE EVENT ───────────────────────────────────────────── */

function deleteEvent(id) {
  events = events.filter(e => e.id != id);
  saveEvents();
  closeModal();
  renderAll();
  if (selectedDay) showDayPanel(selectedDay);
  showToast('Event deleted', '#f87171');
}

/* ── TOAST ──────────────────────────────────────────────────── */

function showToast(msg, color) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <div class="toast-dot" style="background:${color || '#34d399'}"></div>
    ${msg}
  `;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ── HELPERS ────────────────────────────────────────────────── */

function hexToRgba(hex, alpha) {
  let r = 0, g = 0, b = 0;
  const h = hex.replace('#', '');
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── REALTIME SIMULATION ────────────────────────────────────── */



/* ── AUTO-REFRESH COUNTDOWNS ────────────────────────────────── */

setInterval(() => {
  if (selectedDay) showDayPanel(selectedDay);
  if (view !== 'month') renderView();
}, 60000);

/* ── RENDER ALL ─────────────────────────────────────────────── */

function renderAll() {
  renderUserSwitcher();
  renderUserPills();
  renderOnlineList();
  renderCatList();
  renderMiniCal();
  renderView();
}

/* ── KEYBOARD SHORTCUTS ─────────────────────────────────────── */

document.addEventListener('keydown', e => {
  const inInput = e.target.matches('input,textarea,select');
  if (e.key === 'Escape')                                    closeModal();
  if ((e.key === 'n' || e.key === 'N') && !inInput)         openModal();
  if (e.key === 'ArrowLeft'            && !inInput)          navMain(-1);
  if (e.key === 'ArrowRight'           && !inInput)          navMain(1);
  if (e.key === 'm'                    && !inInput)          setView('month');
  if (e.key === 'w'                    && !inInput)          setView('week');
  if (e.key === 'd'                    && !inInput)          setView('day');
  if (e.key === 't'                    && !inInput)          goToday();
});

// Close modal on overlay click
document.getElementById('modalOverlay')
  ?.addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

// Close user dropdown on outside click
document.addEventListener('click', e => {
  const btn = document.getElementById('currentUserBtn');
  const dd  = document.getElementById('userDropdown');
  if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
    toggleUserDropdown(false);
  }
});

// Label input: press Enter to add
document.getElementById('evLabelInput')
  ?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addLabel(); }
  });

/* ── INIT ───────────────────────────────────────────────────── */

loadEvents();
renderAll();
