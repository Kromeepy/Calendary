// ============================================================
//  ChronoSync — server.js
//  Express + better-sqlite3 backend
//  Deploy on Render as a Web Service
// ============================================================

'use strict';

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('./db');

const app = express();

// ── ENV ───────────────────────────────────────────────────────
const PORT       = process.env.PORT       || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';   // set to your GitHub Pages URL on Render

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// Serve the built frontend from /public (optional — for self-hosting)
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH MIDDLEWARE ───────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid.' });
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function makeInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  '#4f9cf9','#a78bfa','#34d399','#fb923c',
  '#f87171','#fbbf24','#e879f9','#2dd4bf'
];

function pickAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++)
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const normalEmail = email.toLowerCase().trim();

  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalEmail);
  if (existing)
    return res.status(409).json({ error: 'An account with this email already exists.' });

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  const avatarColor  = pickAvatarColor(normalEmail);
  const initials     = makeInitials(name);

  const stmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, initials, avatar_color)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name.trim(), normalEmail, passwordHash, initials, avatarColor);
  const userId = result.lastInsertRowid;

  const token = jwt.sign({ id: userId, email: normalEmail }, JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({
    token,
    user: { id: userId, name: name.trim(), email: normalEmail, initials, avatarColor }
  });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const normalEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalEmail);

  if (!user)
    return res.status(401).json({ error: 'Incorrect email or password.' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match)
    return res.status(401).json({ error: 'Incorrect email or password.' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

  res.json({
    token,
    user: {
      id          : user.id,
      name        : user.name,
      email       : user.email,
      initials    : user.initials,
      avatarColor : user.avatar_color
    }
  });
});

// GET /api/auth/me  — verify token and return current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, initials, avatar_color FROM users WHERE id = ?')
                 .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({
    id          : user.id,
    name        : user.name,
    email       : user.email,
    initials    : user.initials,
    avatarColor : user.avatar_color
  });
});

// PATCH /api/auth/me  — update profile (name)
app.patch('/api/auth/me', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: 'Name is required.' });

  const initials = makeInitials(name.trim());
  db.prepare('UPDATE users SET name = ?, initials = ? WHERE id = ?')
    .run(name.trim(), initials, req.user.id);

  const user = db.prepare('SELECT id, name, email, initials, avatar_color FROM users WHERE id = ?')
                 .get(req.user.id);
  res.json({
    id          : user.id,
    name        : user.name,
    email       : user.email,
    initials    : user.initials,
    avatarColor : user.avatar_color
  });
});

// ══════════════════════════════════════════════════════════════
//  MEMBERS ROUTE
// ══════════════════════════════════════════════════════════════

// GET /api/members  — list all registered users (names + avatars only)
app.get('/api/members', requireAuth, (req, res) => {
  const members = db.prepare('SELECT id, name, initials, avatar_color FROM users ORDER BY name')
                    .all();
  res.json(members.map(u => ({
    id          : u.id,
    name        : u.name,
    initials    : u.initials,
    avatarColor : u.avatar_color
  })));
});

// ══════════════════════════════════════════════════════════════
//  EVENTS ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/events  — all events (shared calendar)
app.get('/api/events', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, u.name AS created_by_name, u.initials AS created_by_initials, u.avatar_color AS created_by_color
    FROM events e
    JOIN users u ON e.created_by_id = u.id
    ORDER BY e.date, e.start_time
  `).all();

  res.json(rows.map(formatEvent));
});

// POST /api/events  — create an event
app.post('/api/events', requireAuth, (req, res) => {
  const { title, date, start, end, category, color, urgency, labels, desc } = req.body;

  if (!title || !date || !start || !end)
    return res.status(400).json({ error: 'title, date, start and end are required.' });

  const stmt = db.prepare(`
    INSERT INTO events
      (title, date, start_time, end_time, category, color, urgency, labels, description, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    title.trim(), date, start, end,
    category  || 'work',
    color     || '#4f9cf9',
    urgency   || 'medium',
    JSON.stringify(labels || []),
    (desc || '').trim(),
    req.user.id
  );

  const row = db.prepare(`
    SELECT e.*, u.name AS created_by_name, u.initials AS created_by_initials, u.avatar_color AS created_by_color
    FROM events e JOIN users u ON e.created_by_id = u.id
    WHERE e.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(formatEvent(row));
});

// PATCH /api/events/:id  — update (owner only)
app.patch('/api/events/:id', requireAuth, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  if (ev.created_by_id !== req.user.id)
    return res.status(403).json({ error: 'You can only edit your own events.' });

  const { title, date, start, end, category, color, urgency, labels, desc } = req.body;

  db.prepare(`
    UPDATE events SET
      title = ?, date = ?, start_time = ?, end_time = ?,
      category = ?, color = ?, urgency = ?, labels = ?, description = ?
    WHERE id = ?
  `).run(
    title     ?? ev.title,
    date      ?? ev.date,
    start     ?? ev.start_time,
    end       ?? ev.end_time,
    category  ?? ev.category,
    color     ?? ev.color,
    urgency   ?? ev.urgency,
    labels    !== undefined ? JSON.stringify(labels) : ev.labels,
    desc      !== undefined ? desc.trim() : ev.description,
    ev.id
  );

  const updated = db.prepare(`
    SELECT e.*, u.name AS created_by_name, u.initials AS created_by_initials, u.avatar_color AS created_by_color
    FROM events e JOIN users u ON e.created_by_id = u.id
    WHERE e.id = ?
  `).get(ev.id);

  res.json(formatEvent(updated));
});

// DELETE /api/events/:id  — delete (owner only)
app.delete('/api/events/:id', requireAuth, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  if (ev.created_by_id !== req.user.id)
    return res.status(403).json({ error: 'You can only delete your own events.' });

  db.prepare('DELETE FROM events WHERE id = ?').run(ev.id);
  res.json({ success: true, id: ev.id });
});

// ── FORMAT helper ─────────────────────────────────────────────
function formatEvent(row) {
  return {
    id                : row.id,
    title             : row.title,
    date              : row.date,
    start             : row.start_time,
    end               : row.end_time,
    category          : row.category,
    color             : row.color,
    urgency           : row.urgency,
    labels            : safeParseJSON(row.labels, []),
    desc              : row.description,
    createdBy         : row.created_by_name,
    createdByInitials : row.created_by_initials,
    createdByColor    : row.created_by_color,
    createdById       : row.created_by_id,
    createdAt         : row.created_at
  };
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── FALLBACK (SPA) ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ChronoSync server running on port ${PORT}`);
});
