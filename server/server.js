const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db, initDb } = require('./db');

const app = express();
app.use(express.json());
app.use('/kanban_game', express.static(path.join(__dirname, 'public')));

// ===================================================
//  AUTH MIDDLEWARE
// ===================================================
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  const user = db.prepare(`
    SELECT u.* FROM tokens t JOIN users u ON t.user_id = u.id WHERE t.token = ?
  `).get(token);
  if (!user) return res.status(401).json({ error: 'Токен недействителен' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для admin' });
  next();
}

// ===================================================
//  AUTH ROUTES
// ===================================================
app.post('/kanban_game/api/auth/login', (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Заполните все поля' });
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  if (!user || user.password !== password) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const token = uuidv4();
  db.prepare('INSERT INTO tokens (token, user_id) VALUES (?,?)').run(token, user.id);
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  res.json({ token, user: { id: user.id, login: user.login, role: user.role } });
});

app.post('/kanban_game/api/auth/register', (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (login.length < 3) return res.status(400).json({ error: 'Логин минимум 3 символа' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });
  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (existing) return res.status(409).json({ error: 'Логин уже занят' });
  const result = db.prepare("INSERT INTO users (login, password, role) VALUES (?,?,'участник')").run(login, password);
  const token = uuidv4();
  db.prepare('INSERT INTO tokens (token, user_id) VALUES (?,?)').run(token, result.lastInsertRowid);
  res.status(201).json({ token, user: { id: result.lastInsertRowid, login, role: 'участник' } });
});

app.post('/kanban_game/api/auth/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.replace('Bearer ', '').trim();
  db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.get('/kanban_game/api/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, login: req.user.login, role: req.user.role });
});

// ===================================================
//  USERS (admin only)
// ===================================================
app.get('/kanban_game/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.login, u.password, u.role, u.created_at, u.last_login_at,
      (SELECT MAX(revenue) FROM game_sessions WHERE user_id = u.id AND status = 'completed') AS max_revenue
    FROM users u ORDER BY u.created_at ASC
  `).all();
  res.json(users);
});

app.post('/kanban_game/api/users', requireAuth, requireAdmin, (req, res) => {
  const { login, password, role } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Заполните все поля' });
  const allowedRole = (role === 'admin' || role === 'участник') ? role : 'участник';
  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (existing) return res.status(409).json({ error: 'Логин уже занят' });
  const result = db.prepare('INSERT INTO users (login, password, role) VALUES (?,?,?)').run(login, password, allowedRole);
  res.status(201).json({ id: result.lastInsertRowid, login, role: allowedRole });
});

app.delete('/kanban_game/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.patch('/kanban_game/api/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { role } = req.body || {};
  if (id === req.user.id) return res.status(400).json({ error: 'Нельзя изменить свою роль' });
  if (role !== 'admin' && role !== 'участник') return res.status(400).json({ error: 'Неверная роль' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  res.json({ ok: true });
});

// ===================================================
//  GAME SESSIONS
// ===================================================
app.post('/kanban_game/api/sessions', requireAuth, (req, res) => {
  const result = db.prepare(`
    INSERT INTO game_sessions (user_id, user_login, status) VALUES (?,?,'in_progress')
  `).run(req.user.id, req.user.login);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.get('/kanban_game/api/sessions/my', requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT id, user_login, status, start_date, current_day, revenue, completed_at
    FROM game_sessions WHERE user_id = ? ORDER BY start_date DESC
  `).all(req.user.id);
  res.json(sessions);
});

app.get('/kanban_game/api/sessions/active', requireAuth, requireAdmin, (req, res) => {
  const sessions = db.prepare(`
    SELECT id, user_login, start_date, current_day, revenue
    FROM game_sessions WHERE status = 'in_progress' ORDER BY start_date DESC
  `).all();
  res.json(sessions);
});

app.get('/kanban_game/api/sessions/:id', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
  if (session.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Нет доступа' });
  const out = { ...session };
  if (out.game_state) out.game_state = JSON.parse(out.game_state);
  res.json(out);
});

app.patch('/kanban_game/api/sessions/:id', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
  if (session.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Нет доступа' });
  const { current_day, revenue, game_state } = req.body || {};
  db.prepare(`
    UPDATE game_sessions SET current_day = ?, revenue = ?, game_state = ? WHERE id = ?
  `).run(
    current_day ?? session.current_day,
    revenue ?? session.revenue,
    game_state !== undefined ? JSON.stringify(game_state) : session.game_state,
    req.params.id
  );
  res.json({ ok: true });
});

app.post('/kanban_game/api/sessions/:id/complete', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
  if (session.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Нет доступа' });
  const { revenue } = req.body || {};
  db.prepare(`
    UPDATE game_sessions SET status = 'completed', revenue = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(revenue ?? session.revenue, req.params.id);
  res.json({ ok: true });
});

// ===================================================
//  LEADERBOARD & TOP-GAMES
// ===================================================
app.get('/kanban_game/api/leaderboard', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT user_login, revenue, completed_at
    FROM game_sessions WHERE status = 'completed'
    ORDER BY revenue DESC LIMIT 10
  `).all();
  res.json(rows);
});

app.get('/kanban_game/api/top-games', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT user_login, revenue, completed_at
    FROM game_sessions WHERE status = 'completed'
    ORDER BY revenue DESC LIMIT 10
  `).all();
  res.json(rows);
});

// ===================================================
//  ENTRY POINT
// ===================================================
app.get('/kanban_game', (req, res) => res.redirect('/kanban_game/login.html'));
app.get('/kanban_game/', (req, res) => res.redirect('/kanban_game/login.html'));

initDb();
const PORT = 3001;
app.listen(PORT, () => console.log(`Kanban Game server on :${PORT}`));
