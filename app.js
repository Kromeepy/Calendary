/* ============================================================
   ChronoSync — app.js
   Real login/register · Per-user events · Delete with undo
   No simulation data — all data is user-created
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

const AVATAR_COLORS = [
  '#4f9cf9','#a78bfa','#34d399','#fb923c',
  '#f87171','#fbbf24','#e879f9','#2dd4bf'
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ── STORAGE KEYS ───────────────────────────────────────────── */

const KEY_USERS    = 'cs_users';       // all registered accounts
const KEY_SESSION  = 'cs_session';     // current logged-in user id
const KEY_EVENTS   = 'cs_events';      // all events (shared calendar)

/* ── AUTH STATE ─────────────────────────────────────────────── */

let currentUser = null;   // { id, name, email, initials, avatarColor, createdAt }

/* ── CALENDAR STATE ─────────────────────────────────────────── */

let events          = [];
let selectedColor   = COLORS[0];
let selectedUrgency = 'medium';
let currentLabels   = [];
let view            = 'month';
let navDate         = new Date();
let miniNavDate     = new Date();
let selectedDay     = null;
let editingId       = null;

/* ── UNDO STATE ─────────────────────────────────────────────── */

let undoBuffer   = null;
let undoToastEl  = null;

/* ══════════════════════════════════════════════════════════════
   AUTH — REGISTER / LOGIN / LOGOUT
══════════════════════════════════════════════════════════════ */

function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

function getSession() {
  return localStorage.getItem(KEY_SESSION);
}

function setSession(userId) {
  localStorage.setItem(KEY_SESSION, userId);
}

function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}

/** Derive initials from full name */
function makeInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Pick a consistent avatar color based on email */
function pickAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Simple hash — NOT cryptographic, fine for a localStorage demo */
function hashPassword(pw) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) {
    h ^= pw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/* ── SHOW / HIDE AUTH SCREENS ───────────────────────────────── */

function showAuthScreen(which) {          // 'login' | 'register'
  document.getElementById('authOverlay').style.display = 'flex';
  document.getElementById('appShell').style.display    = 'none';
  document.getElementById('loginBox').style.display    = which === 'login'    ? 'flex' : 'none';
  document.getElementById('registerBox').style.display = which === 'register' ? 'flex' : 'none';
  clearAuthErrors();
}

function showApp() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('appShell').style.display    = 'flex';
}

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.auth-input').forEach(el => el.classList.remove('input-error'));
}

function setAuthError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(fieldId + 'Err');
  if (field) field.classList.add('input-error');
  if (err)   err.textContent = msg;
}

/* ── REGISTER ───────────────────────────────────────────────── */

function handleRegister() {
  clearAuthErrors();
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pw    = document.getElementById('regPw').value;
  const pw2   = document.getElementById('regPw2').value;

  let valid = true;
  if (!name)  { setAuthError('regName',  'Name is required.');          valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthError('regEmail', 'Enter a valid email address.');            valid = false;
  }
  if (pw.length < 6) { setAuthError('regPw', 'Password must be at least 6 characters.'); valid = false; }
  if (pw !== pw2)    { setAuthError('regPw2', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    setAuthError('regEmail', 'An account with this email already exists.');
    return;
  }

  const user = {
    id          : crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    name,
    email,
    initials    : makeInitials(name),
    avatarColor : pickAvatarColor(email),
    pwHash      : hashPassword(pw),
    createdAt   : new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);
  setSession(user.id);
  currentUser = user;

  // Clear form
  ['regName','regEmail','regPw','regPw2'].forEach(id => document.getElementById(id).value = '');

  bootApp();
}

/* ── LOGIN ──────────────────────────────────────────────────── */

function handleLogin() {
  clearAuthErrors();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw    = document.getElementById('loginPw').value;

  if (!email) { setAuthError('loginEmail', 'Email is required.');    return; }
  if (!pw)    { setAuthError('loginPw',    'Password is required.'); return; }

  const users = getUsers();
  const user  = users.find(u => u.email === email);
  if (!user || user.pwHash !== hashPassword(pw)) {
    setAuthError('loginPw', 'Incorrect email or password.');
    return;
  }

  setSession(user.id);
  currentUser = user;
  ['loginEmail','loginPw'].forEach(id => document.getElementById(id).value = '');
  bootApp();
}

/* ── LOGOUT ─────────────────────────────────────────────────── */

function logout() {
  clearSession();
  currentUser = null;
  events      = [];
  selectedDay = null;
  showAuthScreen('login');
}

/* ── BOOT ───────────────────────────────────────────────────── */

function bootApp() {
  loadEvents();
  showApp();
  renderHeaderUser();
  renderAll();
}

/* ── KEYBOARD: Enter submits forms ─────────────────────────── */

function loginOnEnter(e)   { if (e.key === 'Enter') handleLogin();    }
function registerOnEnter(e){ if (e.key === 'Enter') handleRegister(); }

/* ══════════════════════════════════════════════════════════════
   EVENTS STORAGE  (shared calendar — all users see all events)
══════════════════════════════════════════════════════════════ */

function loadEvents() {
  try { events = JSON.parse(localStorage.getItem(KEY_EVENTS)) || []; }
  catch { events = []; }
}

function saveEvents() {
  localStorage.setItem(KEY_EVENTS, JSON.stringify(events));
}

/* ══════════════════════════════════════════════════════════════
   DATE HELPERS
══════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════════════════════ */

function renderHeaderUser() {
  if (!currentUser) return;

  // Avatar button
  const btn = document.getElementById('currentUserBtn');
  if (btn) {
    btn.innerHTML = `
      <div class="avatar" style="background:${currentUser.avatarColor}">
        ${currentUser.initials}
      </div>
      <span style="font-size:12px;font-weight:500">
        ${currentUser.name.split(' ')[0]}
      </span>
      <div class="online-dot"></div>
      <span style="font-size:10px;color:var(--muted);margin-left:2px">▾</span>
    `;
  }

  // Online list — all registered users (for shared calendar context)
  renderOnlineList();
  renderUserPills();
}

/* ── Tiny avatars of recent event authors in the header ─────── */

function renderUserPills() {
  const el = document.getElementById('userPills');
  if (!el) return;
  // Show distinct event authors from the last 30 events
  const seen    = new Set();
  const authors = [];
  [...events].reverse().forEach(ev => {
    if (!seen.has(ev.createdById) && ev.createdById !== currentUser?.id) {
      seen.add(ev.createdById);
      authors.push({ initials: ev.createdByInitials, color: ev.createdByColor, name: ev.createdBy });
    }
  });
  el.innerHTML = authors.slice(0, 3).map(a => `
    <div class="user-pill" title="${a.name}">
      <div class="avatar" style="background:${a.color};width:24px;height:24px;font-size:10px">
        ${a.initials}
      </div>
    </div>
  `).join('');
}

/* ── Online list ────────────────────────────────────────────── */

function renderOnlineList() {
  const el = document.getElementById('onlineList');
  if (!el) return;
  const users = getUsers();
  if (!users.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:12px;padding:4px 8px">No other members yet.</p>`;
    document.getElementById('onlineText').textContent = '1 member';
    return;
  }
  el.innerHTML = users.map(u => {
    const isMe = u.id === currentUser?.id;
    return `
      <div class="online-item">
        <div class="avatar" style="background:${u.avatarColor};width:24px;height:24px;font-size:10px">
          ${u.initials}
        </div>
        <span class="online-name">${u.name}${isMe ? ' <span style="color:var(--accent2);font-size:10px">(you)</span>' : ''}</span>
        <div class="status-dot online" style="margin-left:auto"></div>
      </div>
    `;
  }).join('');
  document.getElementById('onlineText').textContent = `${users.length} member${users.length > 1 ? 's' : ''}`;
}

/* ── Profile dropdown ───────────────────────────────────────── */

let profileDropOpen = false;

function toggleProfileDrop(force) {
  profileDropOpen = force !== undefined ? force : !profileDropOpen;
  const dd = document.getElementById('profileDrop');
  if (!dd) return;
  if (profileDropOpen) {
    const u = currentUser;
    dd.innerHTML = `
      <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
        <div style="font-weight:600;font-size:13px">${u.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${u.email}</div>
      </div>
      <div class="profile-drop-item" onclick="showProfileEdit()">Edit profile</div>
      <div class="profile-drop-item profile-drop-danger" onclick="logout()">Sign out</div>
    `;
    dd.style.display = 'flex';
  } else {
    dd.style.display = 'none';
  }
}

/* ── Profile edit (simple name change) ─────────────────────── */

function showProfileEdit() {
  toggleProfileDrop(false);
  document.getElementById('profileEditName').value = currentUser.name;
  document.getElementById('profileEditOverlay').classList.add('open');
}

function closeProfileEdit() {
  document.getElementById('profileEditOverlay').classList.remove('open');
}

function saveProfile() {
  const name = document.getElementById('profileEditName').value.trim();
  if (!name) { showToast('Name cannot be empty.', '#f87171'); return; }
  const users = getUsers();
  const idx   = users.findIndex(u => u.id === currentUser.id);
  if (idx > -1) {
    users[idx].name     = name;
    users[idx].initials = makeInitials(name);
    saveUsers(users);
    currentUser.name     = name;
    currentUser.initials = makeInitials(name);
  }
  closeProfileEdit();
  renderHeaderUser();
  showToast('Profile updated.', '#34d399');
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════
   MINI CALENDAR
══════════════════════════════════════════════════════════════ */

function renderMiniCal() {
  const labelEl = document.getElementById('miniMonthLabel');
  if (!labelEl) return;
  const d = new Date(miniNavDate.getFullYear(), miniNavDate.getMonth(), 1);
  labelEl.textContent = MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();

  const dayNames     = DAYS_SHORT.map(dn => `<div class="day-name">${dn[0]}</div>`).join('');
  const startDay     = d.getDay();
  const totalDays    = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const prevMonDays  = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
  const todayStr     = todayDate();

  let html = dayNames;
  for (let i = startDay - 1; i >= 0; i--)
    html += `<div class="mini-day other-month">${prevMonDays - i}</div>`;

  for (let i = 1; i <= totalDays; i++) {
    const ds    = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i)}`;
    const hasEv = events.some(e => e.date === ds);
    const today = ds === todayStr;
    const sel   = ds === selectedDay;
    html += `<div class="mini-day ${today ? 'today' : ''} ${sel ? 'selected' : ''} ${hasEv ? 'has-event' : ''}"
                  onclick="selectDay('${ds}')">${i}</div>`;
  }
  const rem = 42 - startDay - totalDays;
  for (let i = 1; i <= rem; i++)
    html += `<div class="mini-day other-month">${i}</div>`;

  document.getElementById('miniCal').innerHTML = html;
}

function miniNavMonth(dir) {
  miniNavDate.setMonth(miniNavDate.getMonth() + dir);
  renderMiniCal();
}

function selectDay(dateStr) {
  selectedDay = dateStr;
  navDate     = new Date(dateStr + 'T12:00:00');
  renderView();
  renderMiniCal();
  showDayPanel(dateStr);
}

/* ══════════════════════════════════════════════════════════════
   AUTHOR CHIP
══════════════════════════════════════════════════════════════ */

function authorChip(ev, size = 'sm') {
  const name     = ev.createdBy         || 'Unknown';
  const initials = ev.createdByInitials || name.slice(0, 2).toUpperCase();
  const color    = ev.createdByColor    || '#7a7d8c';
  const isMe     = ev.createdById       === currentUser?.id;
  const label    = isMe ? 'You' : name;
  const avSize   = size === 'sm' ? '14px' : '20px';
  const avFont   = size === 'sm' ?  '7px' :  '9px';
  const txtSize  = size === 'sm' ?  '9px' : '11px';
  return `
    <span class="author-chip" title="Created by ${name}${isMe ? ' (you)' : ''}">
      <span class="author-av"
            style="width:${avSize};height:${avSize};font-size:${avFont};background:${color}">
        ${initials}
      </span>
      <span style="font-size:${txtSize};color:rgba(255,255,255,0.65)">${label}</span>
    </span>
  `;
}

/* ══════════════════════════════════════════════════════════════
   COUNTDOWN & PROGRESS
══════════════════════════════════════════════════════════════ */

function getCountdown(ev) {
  const now   = new Date();
  const start = new Date(ev.date + 'T' + ev.start + ':00');
  const end   = new Date(ev.date + 'T' + ev.end   + ':00');
  if (now >= start && now <= end) return 'In progress';
  if (now < start) {
    const diff = start - now;
    const h    = Math.floor(diff / 3600000);
    const m    = Math.floor((diff % 3600000) / 60000);
    if (h > 48) return `Starts in ${Math.floor(h / 24)}d`;
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
  if (now >= start && now <= end)
    return Math.round(((now - start) / (end - start)) * 100);
  return null;
}

/* ══════════════════════════════════════════════════════════════
   EVENT PANEL
══════════════════════════════════════════════════════════════ */

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
    document.getElementById('panelEvents').innerHTML = `
      <div style="color:var(--muted);font-size:13px;padding:8px 0">
        No events this day.
        <br>
        <button class="btn" style="margin-top:10px;font-size:12px"
                onclick="openModalDate('${dateStr}','09:00')">
          + Add Event
        </button>
      </div>
    `;
    return;
  }

  document.getElementById('panelEvents').innerHTML = dayEvents.map(ev => {
    const urg      = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
    const countdown = getCountdown(ev);
    const progress  = getProgress(ev);
    const bgDark    = hexToRgba(ev.color, 0.18);
    const canEdit   = ev.createdById === currentUser?.id;

    return `
      <div class="panel-event-card" id="pcard-${ev.id}"
           style="background:${bgDark};border-left-color:${ev.color}">

        <!-- Header row -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="openEditModal('${ev.id}')">
            <div class="pev-title">${ev.title}</div>
            <div class="pev-time">${ev.start} – ${ev.end}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;margin-top:1px">
            <button class="pev-action-btn pev-edit-btn"
                    title="${canEdit ? 'Edit event' : 'View event'}"
                    onclick="openEditModal('${ev.id}')">✎</button>
            ${canEdit
              ? `<button class="pev-action-btn pev-delete-btn"
                         title="Delete event"
                         onclick="showInlineConfirm('${ev.id}')">✕</button>`
              : ''}
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

        <!-- Progress bar -->
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

        <!-- Inline delete confirm (hidden) -->
        ${canEdit
          ? `<div id="confirm-${ev.id}" class="pev-confirm-row" style="display:none">
               <span style="font-size:12px;color:var(--muted)">
                 Delete "<strong style="color:var(--text)">${ev.title}</strong>"?
               </span>
               <div style="display:flex;gap:6px;margin-top:6px">
                 <button class="pev-confirm-yes" onclick="deleteEvent('${ev.id}')">
                   Yes, delete
                 </button>
                 <button class="pev-confirm-no" onclick="hideInlineConfirm('${ev.id}')">
                   Cancel
                 </button>
               </div>
             </div>`
          : ''}
      </div>
    `;
  }).join('');
}

function showInlineConfirm(id) {
  document.querySelectorAll('.pev-confirm-row').forEach(el => el.style.display = 'none');
  const row = document.getElementById('confirm-' + id);
  if (row) row.style.display = 'block';
}

function hideInlineConfirm(id) {
  const row = document.getElementById('confirm-' + id);
  if (row) row.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
   VIEW SWITCHING
══════════════════════════════════════════════════════════════ */

function setView(v) {
  view = v;
  ['Month','Week','Day'].forEach(x => {
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

/* ══════════════════════════════════════════════════════════════
   MONTH VIEW
══════════════════════════════════════════════════════════════ */

function renderMonth() {
  const titleEl = document.getElementById('mainTitle');
  if (titleEl) titleEl.textContent = MONTHS[navDate.getMonth()] + ' ' + navDate.getFullYear();

  const area = document.getElementById('calArea');
  if (!area) return;

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);flex:1;overflow:auto;width:100%';

  DAYS_SHORT.forEach(d => {
    const h = document.createElement('div');
    h.className   = 'month-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay    = new Date(navDate.getFullYear(), navDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(navDate.getFullYear(), navDate.getMonth() + 1, 0).getDate();
  const prevMonDays = new Date(navDate.getFullYear(), navDate.getMonth(), 0).getDate();
  const todayStr    = todayDate();
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

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
    const dayEvs  = events.filter(e => e.date === dateStr)
                          .sort((a, b) => a.start.localeCompare(b.start));
    const isToday = dateStr === todayStr;

    const cell = document.createElement('div');
    cell.className = `month-cell ${isToday ? 'today-cell' : ''} ${other ? 'other-month-cell' : ''}`;
    cell.innerHTML = `
      <div class="month-date-num ${isToday ? 'today-cell-num' : ''}">${day}</div>
    `;

    dayEvs.slice(0, 3).forEach(ev => {
      const e = document.createElement('div');
      e.className   = 'month-event';
      e.style.cssText =
        `background:${hexToRgba(ev.color, 0.22)};color:${ev.color};border-left:3px solid ${ev.color}`;
      e.innerHTML = `
        <span>${ev.start} ${ev.title}</span>
        <span title="By ${ev.createdBy || 'Unknown'}"
              style="border-radius:50%;background:${ev.createdByColor || '#7a7d8c'};color:#fff;
                     font-size:8px;font-weight:700;width:13px;height:13px;
                     display:inline-flex;align-items:center;justify-content:center;
                     margin-left:4px;vertical-align:middle;flex-shrink:0">
          ${ev.createdByInitials || '?'}
        </span>
      `;
      e.title   = `${ev.title} · by ${ev.createdBy || 'Unknown'}`;
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

/* ══════════════════════════════════════════════════════════════
   WEEK VIEW
══════════════════════════════════════════════════════════════ */

function renderWeek() {
  const startOfWeek = new Date(navDate);
  startOfWeek.setDate(navDate.getDate() - navDate.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const titleEl = document.getElementById('mainTitle');
  if (titleEl) {
    titleEl.textContent =
      `${MONTHS[startOfWeek.getMonth()].slice(0,3)} ${startOfWeek.getDate()} – ` +
      `${MONTHS[endOfWeek.getMonth()].slice(0,3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
  }

  const area = document.getElementById('calArea');
  if (!area) return;

  const wrap = document.createElement('div');
  wrap.className = 'week-wrapper';
  wrap.style.flex = '1';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:56px repeat(7,1fr);';

  // Corner
  const corner = document.createElement('div');
  corner.className = 'week-header-cell';
  corner.style.cssText =
    'grid-column:1;grid-row:1;position:sticky;top:0;z-index:11;' +
    'background:var(--surface);border-bottom:1px solid var(--border)';
  grid.appendChild(corner);

  const todayStr = todayDate();

  // Day headers
  for (let d = 0; d < 7; d++) {
    const day  = new Date(startOfWeek); day.setDate(startOfWeek.getDate() + d);
    const dStr = toDateStr(day);
    const h    = document.createElement('div');
    h.className = 'week-header-cell day-col';
    h.style.cssText =
      `grid-column:${d+2};grid-row:1;position:sticky;top:0;z-index:10;background:var(--surface)`;
    h.innerHTML = `
      <span class="day-label">${DAYS_SHORT[day.getDay()]}</span>
      <span class="day-num ${dStr === todayStr ? 'today-num' : ''}">${day.getDate()}</span>
    `;
    h.onclick = () => selectDay(dStr);
    grid.appendChild(h);
  }

  // Hour rows
  for (let h = 0; h < 24; h++) {
    const ts = document.createElement('div');
    ts.className = 'time-slot';
    ts.style.cssText = `grid-column:1;grid-row:${h+2}`;
    ts.textContent = h === 0 ? '' : `${pad(h)}:00`;
    grid.appendChild(ts);

    for (let d = 0; d < 7; d++) {
      const day  = new Date(startOfWeek); day.setDate(startOfWeek.getDate() + d);
      const dStr = toDateStr(day);
      const cell = document.createElement('div');
      cell.className = 'day-column';
      cell.style.cssText =
        `grid-column:${d+2};grid-row:${h+2};height:56px;border-bottom:1px solid var(--border)`;
      cell.onclick = e => {
        if (e.target === cell) openModalDate(dStr, `${pad(h)}:00`);
      };
      grid.appendChild(cell);
    }
  }

  // Event overlays
  for (let d = 0; d < 7; d++) {
    const day  = new Date(startOfWeek); day.setDate(startOfWeek.getDate() + d);
    const dStr = toDateStr(day);
    const overlay = document.createElement('div');
    overlay.style.cssText =
      `grid-column:${d+2};grid-row:2/${24+2};position:relative;pointer-events:auto;`;

    events.filter(e => e.date === dStr).forEach(ev => {
      const [sh, sm] = ev.start.split(':').map(Number);
      const [eh, em] = ev.end.split(':').map(Number);
      const topPx    = (sh * 60 + sm) / 60 * 56;
      const heightPx = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 56, 24);
      const urg      = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
      const cd       = getCountdown(ev);

      const evEl = document.createElement('div');
      evEl.className  = 'cal-event';
      evEl.style.cssText =
        `top:${topPx}px;height:${heightPx}px;` +
        `background:${hexToRgba(ev.color,0.22)};` +
        `border-left:3px solid ${ev.color};color:${ev.color};left:3px;right:3px;`;
      evEl.innerHTML = `
        <div class="ev-title">${ev.title}</div>
        <div class="ev-time">${ev.start}–${ev.end}</div>
        ${heightPx > 48
          ? `<span class="ev-urgency-badge" style="background:${urg.color}40;color:${urg.color}">
               ${urg.label}
             </span>`
          : ''}
        ${heightPx > 60 && cd ? `<div class="ev-countdown">${cd}</div>` : ''}
        ${heightPx > 72 ? authorChip(ev, 'sm') : ''}
      `;
      evEl.onclick = e => { e.stopPropagation(); selectDay(dStr); };
      overlay.appendChild(evEl);
    });

    // Now-line
    const now = new Date();
    if (now >= startOfWeek && now <= endOfWeek && now.getDay() === d) {
      const mins = now.getHours() * 60 + now.getMinutes();
      const nl = document.createElement('div');
      nl.className = 'now-line';
      nl.style.top = (mins / 60 * 56) + 'px';
      overlay.appendChild(nl);
    }

    grid.appendChild(overlay);
  }

  wrap.appendChild(grid);
  area.innerHTML = '';
  area.appendChild(wrap);
  requestAnimationFrame(() => { wrap.scrollTop = 7 * 56; });
}

/* ══════════════════════════════════════════════════════════════
   DAY VIEW
══════════════════════════════════════════════════════════════ */

function renderDay() {
  const dStr    = toDateStr(navDate);
  const isToday = dStr === todayDate();

  const titleEl = document.getElementById('mainTitle');
  if (titleEl) {
    titleEl.textContent =
      `${DAYS_SHORT[navDate.getDay()]}, ${MONTHS[navDate.getMonth()]} ` +
      `${navDate.getDate()}, ${navDate.getFullYear()}`;
  }

  const area = document.getElementById('calArea');
  if (!area) return;

  const wrap = document.createElement('div');
  wrap.className = 'week-wrapper';
  wrap.style.flex = '1';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:56px 1fr;';

  const ch = document.createElement('div');
  ch.style.cssText =
    'grid-column:1;grid-row:1;position:sticky;top:0;z-index:11;' +
    'background:var(--surface);border-bottom:1px solid var(--border);height:48px';
  grid.appendChild(ch);

  const dh = document.createElement('div');
  dh.className = 'week-header-cell day-col';
  dh.style.cssText =
    'grid-column:2;grid-row:1;position:sticky;top:0;z-index:10;background:var(--surface)';
  dh.innerHTML = `
    <span class="day-label">${DAYS_SHORT[navDate.getDay()]}</span>
    <span class="day-num ${isToday ? 'today-num' : ''}">${navDate.getDate()}</span>
  `;
  grid.appendChild(dh);

  for (let h = 0; h < 24; h++) {
    const ts = document.createElement('div');
    ts.className = 'time-slot';
    ts.style.cssText = `grid-column:1;grid-row:${h+2}`;
    ts.textContent = h === 0 ? '' : `${pad(h)}:00`;
    grid.appendChild(ts);

    const cell = document.createElement('div');
    cell.className = 'day-column';
    cell.style.cssText =
      `grid-column:2;grid-row:${h+2};height:56px;border-bottom:1px solid var(--border)`;
    cell.onclick = e => {
      if (e.target === cell) openModalDate(dStr, `${pad(h)}:00`);
    };
    grid.appendChild(cell);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'grid-column:2;grid-row:2/26;position:relative;';

  events.filter(e => e.date === dStr).forEach(ev => {
    const [sh, sm] = ev.start.split(':').map(Number);
    const [eh, em] = ev.end.split(':').map(Number);
    const topPx    = (sh * 60 + sm) / 60 * 56;
    const heightPx = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 56, 28);
    const urg      = URGENCY.find(u => u.key === ev.urgency) || URGENCY[2];
    const cd       = getCountdown(ev);
    const prog     = getProgress(ev);

    const evEl = document.createElement('div');
    evEl.className  = 'cal-event';
    evEl.style.cssText =
      `top:${topPx}px;height:${heightPx}px;` +
      `background:${hexToRgba(ev.color,0.22)};` +
      `border-left:3px solid ${ev.color};color:${ev.color};left:3px;right:3px;`;
    evEl.innerHTML = `
      <div class="ev-title">${ev.title}</div>
      <div class="ev-time">${ev.start}–${ev.end}</div>
      <span class="ev-urgency-badge" style="background:${urg.color}40;color:${urg.color}">
        ${urg.label}
      </span>
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

  if (isToday) {
    const now  = new Date();
    const nl   = document.createElement('div');
    nl.className = 'now-line';
    nl.style.top = ((now.getHours() * 60 + now.getMinutes()) / 60 * 56) + 'px';
    overlay.appendChild(nl);
  }

  grid.appendChild(overlay);
  wrap.appendChild(grid);
  area.innerHTML = '';
  area.appendChild(wrap);
  requestAnimationFrame(() => { wrap.scrollTop = 7 * 56; });
}

/* ══════════════════════════════════════════════════════════════
   EVENT MODAL
══════════════════════════════════════════════════════════════ */

function openModal(date, time) {
  editingId = null;
  document.getElementById('evTitle').value = '';
  document.getElementById('evDate').value  = date || todayDate();
  document.getElementById('evStart').value = time || '09:00';
  document.getElementById('evEnd').value   = time ? addHour(time) : '10:00';
  document.getElementById('evDesc').value  = '';
  document.getElementById('evCat').value   = 'work';

  const u = currentUser;
  const ap = document.getElementById('evAuthorPreview');
  if (ap) ap.innerHTML = `
    <div class="avatar" style="background:${u.avatarColor};width:22px;height:22px;font-size:9px">
      ${u.initials}
    </div>
    <span>${u.name}</span>
  `;

  currentLabels   = [];
  selectedColor   = COLORS[0];
  selectedUrgency = 'medium';
  renderLabelChips();
  renderColorSwatches();
  renderUrgencyOpts();

  document.getElementById('modalHeading').textContent = 'Add Event';
  document.getElementById('deleteBtn').style.display  = 'none';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('evTitle').focus();
}

function openModalDate(date, time) { openModal(date, time); }

function openEditModal(id) {
  const ev = events.find(e => e.id == id);
  if (!ev) return;

  editingId = id;
  const canEdit = ev.createdById === currentUser?.id;

  document.getElementById('evTitle').value = ev.title;
  document.getElementById('evDate').value  = ev.date;
  document.getElementById('evStart').value = ev.start;
  document.getElementById('evEnd').value   = ev.end;
  document.getElementById('evDesc').value  = ev.desc || '';
  document.getElementById('evCat').value   = ev.category;

  // Make fields read-only if not the author
  ['evTitle','evDate','evStart','evEnd','evDesc','evCat'].forEach(id => {
    document.getElementById(id).disabled = !canEdit;
  });

  const ap = document.getElementById('evAuthorPreview');
  if (ap) {
    const color    = ev.createdByColor    || '#7a7d8c';
    const initials = ev.createdByInitials || '?';
    const name     = ev.createdBy         || 'Unknown';
    const isMe     = ev.createdById       === currentUser?.id;
    ap.innerHTML = `
      <div class="avatar" style="background:${color};width:22px;height:22px;font-size:9px">
        ${initials}
      </div>
      <span>${name}${isMe ? ' <span style="color:var(--accent2);font-size:10px">(you)</span>' : ''}</span>
    `;
  }

  currentLabels   = [...(ev.labels || [])];
  selectedColor   = ev.color   || COLORS[0];
  selectedUrgency = ev.urgency || 'medium';
  renderLabelChips();
  renderColorSwatches();
  renderUrgencyOpts();

  document.getElementById('modalHeading').textContent = canEdit ? 'Edit Event' : 'View Event';
  document.getElementById('deleteBtn').style.display  = canEdit ? 'block' : 'none';
  if (canEdit) {
    document.getElementById('deleteEventBtn').onclick = () => deleteEvent(id);
  }
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  // Re-enable fields
  ['evTitle','evDate','evStart','evEnd','evDesc','evCat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
}

/* ── Modal form helpers ──────────────────────────────────────── */

function renderColorSwatches() {
  const el = document.getElementById('colorSwatches');
  if (!el) return;
  el.innerHTML = COLORS.map(c =>
    `<div class="color-swatch ${c === selectedColor ? 'selected' : ''}"
          style="background:${c}" onclick="selectColor('${c}')"></div>`
  ).join('');
}
function selectColor(c) { selectedColor = c; renderColorSwatches(); }

function renderUrgencyOpts() {
  const el = document.getElementById('urgencyOpts');
  if (!el) return;
  el.innerHTML = URGENCY.map(u =>
    `<div class="urgency-opt ${u.key === selectedUrgency ? 'selected' : ''}"
          style="${u.key === selectedUrgency
            ? `background:${u.color}30;border-color:${u.color};color:${u.color}` : ''}"
          onclick="selectUrgency('${u.key}')">${u.label}</div>`
  ).join('');
}
function selectUrgency(k) { selectedUrgency = k; renderUrgencyOpts(); }

function addLabel() {
  const inp = document.getElementById('evLabelInput');
  const v   = inp.value.trim();
  if (v && !currentLabels.includes(v)) { currentLabels.push(v); inp.value = ''; renderLabelChips(); }
}
function removeLabel(l) { currentLabels = currentLabels.filter(x => x !== l); renderLabelChips(); }
function renderLabelChips() {
  const el = document.getElementById('labelChips');
  if (!el) return;
  el.innerHTML = currentLabels.map(l =>
    `<div class="label-chip">${l}<button onclick="removeLabel('${l}')">×</button></div>`
  ).join('');
}

/* ── Save ───────────────────────────────────────────────────── */

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

  const u = currentUser;

  if (editingId) {
    const idx = events.findIndex(e => e.id == editingId);
    if (idx > -1) {
      events[idx] = {
        ...events[idx],
        title, date, start, end, category: cat,
        color: selectedColor, urgency: selectedUrgency,
        labels: [...currentLabels], desc,
        lastEditedBy      : u.name,
        lastEditedInitials: u.initials,
        lastEditedAt      : new Date().toISOString()
      };
    }
    showToast('Event updated.', selectedColor);
  } else {
    events.push({
      id                : Date.now(),
      title, date, start, end, category: cat,
      color             : selectedColor,
      urgency           : selectedUrgency,
      labels            : [...currentLabels],
      desc,
      createdBy         : u.name,
      createdByInitials : u.initials,
      createdByColor    : u.avatarColor,
      createdById       : u.id,
      createdAt         : new Date().toISOString()
    });
    showToast('Event added.', selectedColor);
  }

  saveEvents();
  closeModal();
  renderAll();
  if (selectedDay === date) showDayPanel(date);
}

/* ══════════════════════════════════════════════════════════════
   DELETE EVENT  (with 5-second undo)
══════════════════════════════════════════════════════════════ */

function deleteEvent(id) {
  const ev = events.find(e => e.id == id);
  if (!ev) return;

  // Check ownership
  if (ev.createdById !== currentUser?.id) {
    showToast('You can only delete your own events.', '#f87171');
    return;
  }

  // Clear any previous undo
  if (undoBuffer) {
    clearTimeout(undoBuffer.timeoutId);
    if (undoToastEl) { undoToastEl.remove(); undoToastEl = null; }
  }

  events = events.filter(e => e.id != id);
  saveEvents();
  closeModal();
  renderAll();
  if (selectedDay) showDayPanel(selectedDay);

  const timeoutId = setTimeout(() => {
    undoBuffer  = null;
    undoToastEl = null;
  }, 5000);

  undoBuffer  = { event: ev, timeoutId };
  undoToastEl = showUndoToast(ev.title);
}

function undoDelete() {
  if (!undoBuffer) return;
  clearTimeout(undoBuffer.timeoutId);
  events.push(undoBuffer.event);
  events.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  saveEvents();
  if (undoToastEl) { undoToastEl.remove(); undoToastEl = null; }
  undoBuffer = null;
  renderAll();
  if (selectedDay) showDayPanel(selectedDay);
  showToast('Event restored ✓', '#34d399');
}

function showUndoToast(title) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return null;
  const t = document.createElement('div');
  t.className   = 'toast';
  t.style.cssText =
    'min-width:260px;flex-direction:column;align-items:stretch;padding:10px 14px;gap:0';
  t.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div class="toast-dot" style="background:#f87171;flex-shrink:0"></div>
      <span style="flex:1;font-size:13px">
        "<strong>${title}</strong>" deleted
      </span>
      <button onclick="undoDelete()"
              style="background:rgba(248,113,113,0.2);color:#f87171;
                     border:1px solid rgba(248,113,113,0.4);border-radius:6px;
                     padding:3px 10px;font-size:12px;font-weight:600;
                     cursor:pointer;font-family:var(--font-body)">
        Undo
      </button>
    </div>
    <div style="height:2px;background:rgba(255,255,255,0.08);border-radius:1px;overflow:hidden">
      <div id="undoBar"
           style="height:100%;background:#f87171;width:100%;
                  transition:width 5s linear;border-radius:1px"></div>
    </div>
  `;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const bar = t.querySelector('#undoBar');
    if (bar) bar.style.width = '0%';
  }));
  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 5000);
  return t;
}

/* ══════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════ */

function showToast(msg, color) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="toast-dot" style="background:${color||'#34d399'}"></div>${msg}`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  let r, g, b;
  if (h.length === 3) {
    r = parseInt(h[0]+h[0], 16);
    g = parseInt(h[1]+h[1], 16);
    b = parseInt(h[2]+h[2], 16);
  } else {
    r = parseInt(h.slice(0,2), 16);
    g = parseInt(h.slice(2,4), 16);
    b = parseInt(h.slice(4,6), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ══════════════════════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════════════════════ */

function renderAll() {
  renderHeaderUser();
  renderCatList();
  renderMiniCal();
  renderView();
}

/* ══════════════════════════════════════════════════════════════
   COUNTDOWN AUTO-REFRESH
══════════════════════════════════════════════════════════════ */

setInterval(() => {
  if (selectedDay) showDayPanel(selectedDay);
  if (view !== 'month') renderView();
}, 60000);

/* ══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS  (calendar only — not active on auth screens)
══════════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  if (document.getElementById('appShell').style.display === 'none') return;
  const inInput = e.target.matches('input,textarea,select');
  if (e.key === 'Escape')                               closeModal();
  if ((e.key === 'n'||e.key === 'N') && !inInput)       openModal();
  if (e.key === 'ArrowLeft'          && !inInput)        navMain(-1);
  if (e.key === 'ArrowRight'         && !inInput)        navMain(1);
  if (e.key === 'm'                  && !inInput)        setView('month');
  if (e.key === 'w'                  && !inInput)        setView('week');
  if (e.key === 'd'                  && !inInput)        setView('day');
  if (e.key === 't'                  && !inInput)        goToday();
});

document.getElementById('modalOverlay')
  ?.addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

document.getElementById('evLabelInput')
  ?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addLabel(); }
  });

document.addEventListener('click', e => {
  const btn = document.getElementById('currentUserBtn');
  const dd  = document.getElementById('profileDrop');
  if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
    toggleProfileDrop(false);
  }
});

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */

(function init() {
  const sessionId = getSession();
  if (sessionId) {
    const users = getUsers();
    const user  = users.find(u => u.id === sessionId);
    if (user) {
      currentUser = user;
      bootApp();
      return;
    }
  }
  showAuthScreen('login');
})();
