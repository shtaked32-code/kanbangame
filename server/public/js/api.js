// ===================================================
//  API CLIENT
// ===================================================
const API_BASE = '/kanban_game/api';

function getToken() { return localStorage.getItem('kangame_token'); }
function setToken(t) { localStorage.setItem('kangame_token', t); }
function setUser(u)  { localStorage.setItem('kangame_user', JSON.stringify(u)); }
function getUser()   { try { return JSON.parse(localStorage.getItem('kangame_user')); } catch { return null; } }
function clearAuth() { localStorage.removeItem('kangame_token'); localStorage.removeItem('kangame_user'); }

async function apiRequest(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (getToken() || ''),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

const API = {
  login:          (login, password)      => apiRequest('POST', '/auth/login',    { login, password }),
  register:       (login, password)      => apiRequest('POST', '/auth/register', { login, password }),
  logout:         ()                     => apiRequest('POST', '/auth/logout'),
  me:             ()                     => apiRequest('GET',  '/auth/me'),

  getUsers:       ()                     => apiRequest('GET',  '/users'),
  createUser:     (data)                 => apiRequest('POST', '/users', data),
  deleteUser:     (id)                   => apiRequest('DELETE', `/users/${id}`),
  updateUserRole: (id, role)             => apiRequest('PATCH',  `/users/${id}/role`, { role }),

  createSession:  ()                     => apiRequest('POST', '/sessions'),
  getMySessions:  ()                     => apiRequest('GET',  '/sessions/my'),
  getActiveSessions: ()                  => apiRequest('GET',  '/sessions/active'),
  getSession:     (id)                   => apiRequest('GET',  `/sessions/${id}`),
  saveSession:    (id, data)             => apiRequest('PATCH', `/sessions/${id}`, data),
  completeSession:(id, revenue)          => apiRequest('POST',  `/sessions/${id}/complete`, { revenue }),

  leaderboard:    ()                     => apiRequest('GET',  '/leaderboard'),
  topGames:       ()                     => apiRequest('GET',  '/top-games'),
};

// Навигация в игру: создать сессию и перейти
async function startNewGame() {
  try {
    const session = await API.createSession();
    window.location.href = 'game.html?sid=' + session.id;
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
}

// Перенаправление если не авторизован
function requireAuthRedirect() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}
