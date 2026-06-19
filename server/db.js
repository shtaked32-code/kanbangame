const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, 'kangame.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===================================================
//  SCHEMA
// ===================================================
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'участник',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_login TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      current_day INTEGER DEFAULT 9,
      revenue INTEGER DEFAULT 0,
      game_state TEXT,
      completed_at DATETIME
    );
  `);

  // Admin account
  const admin = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
  if (!admin) {
    db.prepare("INSERT INTO users (login, password, role) VALUES ('admin','root123','admin')").run();
  }

  // Seed test data
  const participantCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'участник'").get().c;
  if (participantCount === 0) seedTestData();
}

// ===================================================
//  SEED DATA
// ===================================================
function seedTestData() {
  const testUsers = [
    { login: 'ivanov',  password: 'pass42'  },
    { login: 'petrova', password: 'qwerty7' },
    { login: 'sidorov', password: 'zxc123'  },
    { login: 'kozlova', password: 'abc999'  },
    { login: 'morozov', password: 'xyz456'  },
  ];

  const ids = testUsers.map(u => {
    return db.prepare("INSERT INTO users (login, password, role) VALUES (?,?,'участник')").run(u.login, u.password).lastInsertRowid;
  });

  const completedGames = [
    { uIdx: 0, revenue: 823400, daysAgo: 5  },
    { uIdx: 1, revenue: 651200, daysAgo: 12 },
    { uIdx: 2, revenue: 492800, daysAgo: 3  },
    { uIdx: 3, revenue: 734900, daysAgo: 8  },
    { uIdx: 4, revenue: 318500, daysAgo: 20 },
  ];
  completedGames.forEach(g => {
    const completedAt = new Date(Date.now() - g.daysAgo * 86400000).toISOString();
    const startDate   = new Date(Date.now() - (g.daysAgo + 2) * 86400000).toISOString();
    db.prepare(`
      INSERT INTO game_sessions (user_id, user_login, status, start_date, current_day, revenue, completed_at)
      VALUES (?,?,'completed',?,35,?,?)
    `).run(ids[g.uIdx], testUsers[g.uIdx].login, startDate, g.revenue, completedAt);
  });

  // 1 in-progress session for ivanov
  const midState = buildMidGameState();
  db.prepare(`
    INSERT INTO game_sessions (user_id, user_login, status, start_date, current_day, revenue, game_state)
    VALUES (?,?,'in_progress',datetime('now','-1 day'),?,?,?)
  `).run(ids[0], testUsers[0].login, midState.day, midState.revenue, JSON.stringify(midState));
}

// ===================================================
//  MID-GAME STATE — реалистичное состояние на день 15
// ===================================================
function buildMidGameState() {
  const STORIES_DEF = [
    {id:'S1',  type:'s', val:7700,  w:[8,8,6]},
    {id:'S2',  type:'s', val:8400,  w:[10,9,6]},
    {id:'S3',  type:'s', val:7700,  w:[9,9,7]},
    {id:'S4',  type:'s', val:7000,  w:[8,8,6]},
    {id:'S5',  type:'s', val:9100,  w:[10,9,7]},
    {id:'S6',  type:'s', val:7700,  w:[9,7,3]},
    {id:'S7',  type:'s', val:8400,  w:[10,8,9]},
    {id:'S8',  type:'s', val:7000,  w:[8,8,9]},
    {id:'S9',  type:'s', val:8400,  w:[9,9,12]},
    {id:'S10', type:'s', val:7700,  w:[10,9,7]},
    {id:'S11', type:'s', val:9100,  w:[12,7,9]},
    {id:'S12', type:'s', val:7000,  w:[7,8,10]},
    {id:'S13', type:'s', val:7000,  w:[8,9,9]},
    {id:'S14', type:'s', val:7000,  w:[5,6,4]},
    {id:'S15', type:'s', val:4900,  w:[5,5,4]},
    {id:'S16', type:'s', val:4200,  w:[4,4,3]},
    {id:'S17', type:'s', val:4900,  w:[5,5,4]},
    {id:'S18', type:'s', val:4900,  w:[5,6,4]},
    {id:'S19', type:'s', val:7000,  w:[6,6,5]},
    {id:'S20', type:'s', val:5600,  w:[5,5,4]},
    {id:'S21', type:'s', val:4900,  w:[4,5,3]},
    {id:'S22', type:'s', val:6300,  w:[6,6,5]},
    {id:'S23', type:'s', val:7700,  w:[7,6,5]},
    {id:'S24', type:'s', val:6300,  w:[6,6,5]},
    {id:'S25', type:'s', val:5600,  w:[5,5,4]},
    {id:'S26', type:'s', val:7700,  w:[7,7,5]},
    {id:'S27', type:'s', val:7000,  w:[6,7,5]},
    {id:'S28', type:'s', val:6300,  w:[6,6,5]},
    {id:'S29', type:'s', val:7700,  w:[7,7,6]},
    {id:'S30', type:'s', val:4900,  w:[4,5,3]},
    {id:'S31', type:'s', val:5600,  w:[5,6,4]},
    {id:'S32', type:'s', val:5600,  w:[5,5,4]},
    {id:'S33', type:'s', val:4200,  w:[4,4,3]},
    {id:'S34', type:'s', val:9100,  w:[8,8,6]},
    {id:'S35', type:'s', val:6300,  w:[5,6,5]},
    {id:'S36', type:'s', val:7700,  w:[7,6,5]},
    {id:'S37', type:'s', val:5600,  w:[5,5,4]},
    {id:'S38', type:'s', val:5600,  w:[5,6,4]},
    {id:'S39', type:'s', val:7000,  w:[6,6,5]},
    {id:'S40', type:'s', val:6300,  w:[5,6,4]},
    {id:'S41', type:'s', val:7700,  w:[7,7,5]},
    {id:'S42', type:'s', val:6300,  w:[6,6,5]},
    {id:'S43', type:'s', val:4900,  w:[4,5,3]},
    {id:'S44', type:'s', val:7700,  w:[7,7,5]},
    {id:'S45', type:'s', val:6300,  w:[6,6,4]},
    {id:'S46', type:'s', val:6300,  w:[6,6,5]},
    {id:'S47', type:'s', val:7700,  w:[7,7,5]},
    {id:'S48', type:'s', val:6300,  w:[5,6,5]},
    {id:'S49', type:'s', val:4900,  w:[4,5,4]},
    {id:'S50', type:'s', val:7700,  w:[7,7,5]},
    {id:'F1',  type:'f', val:10500,  dueDay:15, w:[2,3,2]},
    {id:'F2',  type:'f', val:-35000, dueDay:20, w:[4,5,3]},
    {id:'F3',  type:'f', val:7000,   dueDay:25, w:[8,9,8]},
    {id:'F4',  type:'f', val:14000,  dueDay:30, w:[6,7,5]},
    {id:'F5',  type:'f', val:-21000, dueDay:28, w:[5,6,4]},
    {id:'I1',  type:'i', name:'Обновление базы данных',     w:[6,9,7],  buff:'developer'},
    {id:'I2',  type:'i', name:'Документация легаси-кода',   w:[2,6,4],  buff:'analyst'},
    {id:'I3',  type:'i', name:'Рефакторинг ядра системы',   w:[4,7,5],  buff:'developer'},
    {id:'I4',  type:'i', name:'Настройка CI/CD пайплайна',  w:[3,5,3],  buff:'tester'},
    {id:'I5',  type:'i', name:'Улучшение покрытия тестами', w:[2,4,5],  buff:'tester'},
    {id:'E1',  type:'e', val:140000,  dueDay:18, appearDay:15, w:[3,4,2]},
    {id:'E2',  type:'e', val:-175000, dueDay:25, appearDay:20, w:[4,5,3]},
    {id:'E3',  type:'e', val:-70000,  dueDay:30, appearDay:28, w:[3,4,3]},
    {id:'E4',  type:'e', val:210000,  dueDay:35, appearDay:32, w:[5,6,4]},
  ];

  const stories = {};
  STORIES_DEF.forEach(def => {
    stories[def.id] = {
      id: def.id, type: def.type,
      ...(def.val !== undefined ? { val: def.val } : {}),
      w: [...def.w], wr: [...def.w],
      age: 0, enteredDay: null, deployedDay: null,
      assignedWorkers: [],
      lane: def.type === 'e' ? 'hidden' : 'backlog',
      expedite: def.type === 'e',
      blocker: false, blockerRemaining: 0, blockerTotal: 0,
      ...(def.name    ? { name: def.name }       : {}),
      ...(def.buff    ? { buff: def.buff }        : {}),
      ...(def.dueDay  !== undefined ? { dueDay: def.dueDay }   : {}),
      ...(def.appearDay !== undefined ? { appearDay: def.appearDay } : {}),
    };
  });

  function set(id, props) { Object.assign(stories[id], props); }

  // Deployed: S1-S3 on day 9, S4-S5 on day 10, S6 on day 12
  ['S1','S2','S3'].forEach(id => set(id, { wr:[0,0,0], lane:'deployed', enteredDay:1, deployedDay:9,  age:0 }));
  ['S4','S5'].forEach(id =>       set(id, { wr:[0,0,0], lane:'deployed', enteredDay:1, deployedDay:10, age:0 }));
  set('S6',  { wr:[0,0,0], lane:'deployed',     enteredDay:1,  deployedDay:12, age:0 });

  // Test
  set('S7',  { wr:[0,0,4], lane:'test',         enteredDay:1,  age:5 });

  // Development
  set('S8',  { wr:[0,5,9], lane:'development',  enteredDay:1,  age:7 });
  set('S9',  { wr:[0,6,12], lane:'development', enteredDay:1,  age:6 });

  // AnalysisDone
  set('S10', { wr:[0,9,7], lane:'analysisDone', enteredDay:1,  age:5 });

  // Analysis
  set('S11', { wr:[6,7,9], lane:'analysis',     enteredDay:1,  age:3 });
  set('F1',  { wr:[1,3,2], lane:'analysis',     enteredDay:9,  age:2 });

  // Ready (stayed from initial board or pulled from backlog)
  set('S12', { wr:[7,8,10], lane:'ready',       enteredDay:9,  age:1 });
  set('S13', { wr:[8,9,9],  lane:'ready',       enteredDay:9,  age:1 });
  set('I1',  { wr:[6,9,7],  lane:'ready',       enteredDay:11, age:0 });

  // E1 appeared on day 15
  set('E1',  { wr:[3,4,2], lane:'expBacklog', enteredDay:null });

  const movedFromBacklog = new Set(['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','F1','I1']);
  const backlog = STORIES_DEF
    .filter(d => d.type !== 'e' && !movedFromBacklog.has(d.id))
    .map(d => d.id);

  // Выручка:
  // День 9:  S1+S2+S3 деплой → dailyRev=23800, cumRev=23800
  // День 10: S4+S5 деплой    → dailyRev=39900, cumRev=63700
  // День 11:                  → dailyRev=39900, cumRev=103600
  // День 12: S6 деплой        → dailyRev=47600, cumRev=151200
  // День 13:                  → dailyRev=47600, cumRev=198800
  // День 14:                  → dailyRev=47600, cumRev=246400
  return {
    day: 15, revenue: 246400, dailyRev: 47600,
    buffs: { analyst:0, developer:0, tester:0 },
    workDone: false, carlosPolicy: false, lockdown: false, warnShown: false,

    backlog,
    ready: ['S12','S13','I1'],
    analysis: ['S11','F1'], analysisDone: ['S10'],
    development: ['S9','S8'], devDone: [],
    test: ['S7'], deployed: ['S1','S2','S3','S4','S5','S6'],
    expBacklog: ['E1'], expReady: [], expAnalysis: [], expAnalysisDone: [],
    expDevelopment: [], expDevDone: [], expTest: [], expDeployed: [],

    // Состав команды с учётом событий дней 10-14:
    // День 10: тестировщик (t1) на больничном
    // День 11: нанят разработчик (d3)
    // День 13: разработчик (d1) на конференции
    workers: [
      { id:'a1', type:'analyst',   active:true,  assigned:null },
      { id:'a2', type:'analyst',   active:true,  assigned:null },
      { id:'a3', type:'analyst',   active:false, assigned:null },
      { id:'a4', type:'analyst',   active:false, assigned:null },
      { id:'d1', type:'developer', active:false, assigned:null },
      { id:'d2', type:'developer', active:true,  assigned:null },
      { id:'d3', type:'developer', active:true,  assigned:null },
      { id:'d4', type:'developer', active:false, assigned:null },
      { id:'t1', type:'tester',    active:false, assigned:null },
      { id:'t2', type:'tester',    active:true,  assigned:null },
      { id:'t3', type:'tester',    active:true,  assigned:null },
      { id:'t4', type:'tester',    active:false, assigned:null },
    ],

    stories,

    cfdHistory: [
      { day:9,  backlog:45, ready:5, analysis:3, dev:4, test:3, deployed:0 },
      { day:10, backlog:45, ready:5, analysis:3, dev:3, test:2, deployed:3 },
      { day:11, backlog:45, ready:5, analysis:3, dev:3, test:1, deployed:5 },
      { day:12, backlog:45, ready:4, analysis:3, dev:3, test:1, deployed:5 },
      { day:13, backlog:45, ready:4, analysis:3, dev:2, test:1, deployed:6 },
      { day:14, backlog:45, ready:3, analysis:3, dev:2, test:1, deployed:6 },
    ],
    ctHistory: [
      { id:'S1', days:9,  deployedDay:9  },
      { id:'S2', days:9,  deployedDay:9  },
      { id:'S3', days:9,  deployedDay:9  },
      { id:'S4', days:10, deployedDay:10 },
      { id:'S5', days:10, deployedDay:10 },
      { id:'S6', days:12, deployedDay:12 },
    ],
    revHistory: [
      { day:9,  cumRev:23800,  dailyRev:23800 },
      { day:10, cumRev:63700,  dailyRev:39900 },
      { day:11, cumRev:103600, dailyRev:39900 },
      { day:12, cumRev:151200, dailyRev:47600 },
      { day:13, cumRev:198800, dailyRev:47600 },
      { day:14, cumRev:246400, dailyRev:47600 },
    ],
    log: [],
    _wip: { ready:5, analysis:3, development:5, test:3, expedite:1 },
  };
}

module.exports = { db, initDb };
