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

  // Seed admin sessions
  const adminRow = db.prepare("SELECT id FROM users WHERE login = 'admin'").get();
  if (adminRow) {
    const adminSessions = db.prepare('SELECT COUNT(*) AS c FROM game_sessions WHERE user_id = ?').get(adminRow.id).c;
    if (adminSessions === 0) seedAdminSessions(adminRow.id);
  }
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
// ===================================================
//  ОБЩИЕ ДАННЫЕ ОБ ИСТОРИЯХ (совпадают с client data.js)
// ===================================================
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

function buildMidGameState() {
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
      // Начальная расстановка: test:S1-S3, devDone:S4-S5, dev:S6-S7, analysisDone:S8, analysis:S9-S10, ready:S11-S13,F1,I1
      { day:9,  backlog:45, ready:5, analysis:2, analysisDone:1, dev:2, devDone:2, test:3, deployed:0 },
      // S1,S2,S3 деплой; S4,S5 → test
      { day:10, backlog:45, ready:5, analysis:2, analysisDone:1, dev:2, devDone:0, test:2, deployed:3 },
      // S4,S5 деплой; S6 → devDone
      { day:11, backlog:45, ready:5, analysis:2, analysisDone:0, dev:2, devDone:1, test:0, deployed:5 },
      // S6 деплой; S8 → dev; S7 → test
      { day:12, backlog:45, ready:4, analysis:2, analysisDone:0, dev:2, devDone:0, test:1, deployed:6 },
      // S9,S10 → analysisDone/dev; прогресс
      { day:13, backlog:45, ready:3, analysis:2, analysisDone:1, dev:2, devDone:0, test:1, deployed:6 },
      // Без изменений структуры (прогресс работы)
      { day:14, backlog:45, ready:3, analysis:2, analysisDone:1, dev:2, devDone:0, test:1, deployed:6 },
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

// ===================================================
//  СОСТОЯНИЕ ДЛЯ ДЕНЬ 34 (один день до конца игры)
// ===================================================
function makeStoryObj(def) {
  return {
    id: def.id, type: def.type,
    ...(def.val      !== undefined ? { val: def.val }           : {}),
    ...(def.name                   ? { name: def.name }         : {}),
    ...(def.buff                   ? { buff: def.buff }         : {}),
    ...(def.dueDay   !== undefined ? { dueDay: def.dueDay }     : {}),
    ...(def.appearDay !== undefined ? { appearDay: def.appearDay } : {}),
    w: [...def.w], wr: [...def.w],
    age: 0, enteredDay: null, deployedDay: null,
    assignedWorkers: [],
    lane: def.type === 'e' ? 'hidden' : 'backlog',
    expedite: def.type === 'e',
    blocker: false, blockerRemaining: 0, blockerTotal: 0,
  };
}

function buildDay34State(options) {
  const {
    deployedIds = [], testIds = [], devDoneIds = [], developmentIds = [],
    analysisDoneIds = [], analysisIds = [], readyIds = [],
    expDeployedIds = [], expTestIds = [], expBacklogIds = [],
    removedIds = [],
    revenue, buffs = { analyst:0, developer:0, tester:0 },
    blockerStoryId = null,
  } = options;

  const stories = {};
  STORIES_DEF.forEach(def => { stories[def.id] = makeStoryObj(def); });
  const get = id => STORIES_DEF.find(d => d.id === id);
  function set(id, props) { if (stories[id]) Object.assign(stories[id], props); }

  // Деплой: равномерно распределяем по дням 9-33
  deployedIds.forEach((id, i) => {
    const d = 9 + Math.floor(i * 24 / Math.max(deployedIds.length - 1, 1));
    set(id, { wr:[0,0,0], lane:'deployed', enteredDay:Math.max(1, d-4), deployedDay:Math.min(d,33), age:0 });
  });

  testIds.forEach(id => {
    const w = get(id)?.w || [6,7,5];
    set(id, { wr:[0,0,Math.ceil(w[2]*0.4)], lane:'test', enteredDay:30, age:3 });
  });
  devDoneIds.forEach(id => {
    const w = get(id)?.w || [6,7,5];
    set(id, { wr:[0,0,w[2]], lane:'devDone', enteredDay:28, age:5 });
  });
  developmentIds.forEach(id => {
    const w = get(id)?.w || [6,7,5];
    set(id, { wr:[0,Math.ceil(w[1]*0.55),w[2]], lane:'development', enteredDay:26, age:7 });
  });
  analysisDoneIds.forEach(id => {
    const w = get(id)?.w || [6,7,5];
    set(id, { wr:[0,w[1],w[2]], lane:'analysisDone', enteredDay:25, age:8 });
  });
  analysisIds.forEach(id => {
    const w = get(id)?.w || [6,7,5];
    set(id, { wr:[Math.ceil(w[0]*0.45),w[1],w[2]], lane:'analysis', enteredDay:27, age:6 });
  });
  readyIds.forEach(id => {
    const w = get(id)?.w || [6,7,5];
    set(id, { wr:[...w], lane:'ready', enteredDay:31, age:2 });
  });
  expDeployedIds.forEach(id => {
    set(id, { wr:[0,0,0], lane:'expDeployed', enteredDay:32, deployedDay:33, age:0 });
  });
  expTestIds.forEach(id => {
    const w = get(id)?.w || [3,4,2];
    set(id, { wr:[0,0,Math.ceil(w[2]*0.4)], lane:'expTest', enteredDay:32, age:2 });
  });
  expBacklogIds.forEach(id => set(id, { lane:'expBacklog' }));
  removedIds.forEach(id => set(id, { lane:'removed' }));

  if (blockerStoryId && stories[blockerStoryId]) {
    Object.assign(stories[blockerStoryId], { blocker:true, blockerRemaining:4, blockerTotal:6 });
  }

  const placed = new Set([...deployedIds,...testIds,...devDoneIds,...developmentIds,
    ...analysisDoneIds,...analysisIds,...readyIds,...removedIds,
    ...expDeployedIds,...expTestIds,...expBacklogIds]);
  const backlog = STORIES_DEF.filter(d => d.type !== 'e' && !placed.has(d.id)).map(d => d.id);

  // cfdHistory: нарастающая кривая от дня 9 до 33
  const cfdHistory = [];
  for (let day = 9; day <= 34; day++) {
    const prog = Math.pow((day - 9) / 25, 0.75);
    const dep  = Math.round(deployedIds.length * prog);
    const pip  = Math.max(0, 15 - dep + 5);
    cfdHistory.push({
      day, deployed: dep,
      test: Math.max(0, Math.floor(pip * 0.2)),
      devDone: Math.max(0, Math.floor(pip * 0.1)),
      dev: Math.max(0, Math.floor(pip * 0.25)),
      analysisDone: Math.max(0, Math.floor(pip * 0.1)),
      analysis: Math.max(0, Math.floor(pip * 0.25)),
      ready: Math.min(3, Math.max(1, Math.floor(pip * 0.1))),
      backlog: Math.max(0, 45 - dep - pip),
    });
  }

  // revHistory: нарастающая выручка
  const revHistory = [];
  for (let day = 9; day <= 34; day++) {
    const prog = Math.pow((day - 9) / 25, 1.6);
    const cumRev = Math.round(revenue * prog);
    const prevRev = day > 9 ? Math.round(revenue * Math.pow((day - 10) / 25, 1.6)) : 0;
    revHistory.push({ day, cumRev, dailyRev: Math.max(0, cumRev - prevRev) });
  }

  const ctHistory = deployedIds.map(id => {
    const s = stories[id];
    return { id, days: Math.max(1, (s.deployedDay||9) - (s.enteredDay||1) + 1), deployedDay: s.deployedDay||9 };
  });

  // Состав команды после всех событий до конца дня 33:
  // a1 ушёл день 32; d1 ушёл день 26; t1 вернулся день 29; lockdown вкл день 33; WIP.ready=3 с дня 17
  return {
    day: 34, revenue, dailyRev: 0,
    buffs, workDone: false, carlosPolicy: false, lockdown: true, warnShown: false,
    backlog,
    ready: readyIds, analysis: analysisIds, analysisDone: analysisDoneIds,
    development: developmentIds, devDone: devDoneIds, test: testIds,
    deployed: deployedIds,
    expBacklog: expBacklogIds, expReady: [], expAnalysis: [], expAnalysisDone: [],
    expDevelopment: [], expDevDone: [], expTest: expTestIds, expDeployed: expDeployedIds,
    workers: [
      { id:'a1', type:'analyst',   active:false, assigned:null },
      { id:'a2', type:'analyst',   active:true,  assigned:null },
      { id:'a3', type:'analyst',   active:false, assigned:null },
      { id:'a4', type:'analyst',   active:false, assigned:null },
      { id:'d1', type:'developer', active:false, assigned:null },
      { id:'d2', type:'developer', active:true,  assigned:null },
      { id:'d3', type:'developer', active:true,  assigned:null },
      { id:'d4', type:'developer', active:false, assigned:null },
      { id:'t1', type:'tester',    active:true,  assigned:null },
      { id:'t2', type:'tester',    active:true,  assigned:null },
      { id:'t3', type:'tester',    active:true,  assigned:null },
      { id:'t4', type:'tester',    active:false, assigned:null },
    ],
    stories, cfdHistory, ctHistory, revHistory, log: [],
    _wip: { ready:3, analysis:3, development:5, test:3, expedite:1 },
  };
}

// ===================================================
//  SEED — 3 СЕССИИ ДЛЯ ADMIN
// ===================================================
function seedAdminSessions(adminId) {
  // Сессия 1: хороший игрок — 23 стандартных, F1+F3 бонусы, I1+I2 баффы, E1 вовремя, E4 в тестировании
  const s1 = buildDay34State({
    deployedIds: [
      'S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12',
      'S13','S14','S15','S16','S17','S18','S19','S20','S21','S22','S23',
      'F1','F3','I1','I2','E1',
    ],
    testIds: ['S24','S25'], devDoneIds: ['S26'],
    developmentIds: ['S27','S28'], analysisDoneIds: ['S29'],
    analysisIds: ['S30','S31'], readyIds: ['S32'],
    expTestIds: ['E4'],
    removedIds: ['F2','E2','E3'],  // F2 просрочена(-35K), E2 просрочена(-175K), E3 просрочена(-70K)
    revenue: 2_380_000,
    buffs: { analyst:1, developer:1, tester:0 },
  });

  // Сессия 2: средний игрок — 16 стандартных, F1 вовремя, I1 бафф, E1 вовремя, E4 в бэклоге
  const s2 = buildDay34State({
    deployedIds: [
      'S1','S2','S3','S4','S5','S6','S7','S8','S9',
      'S10','S11','S12','S13','S14','S15','S16',
      'F1','I1','E1',
    ],
    testIds: ['S17','S18'], devDoneIds: ['S19'],
    developmentIds: ['S20','S21'], analysisDoneIds: ['S22'],
    analysisIds: ['S23','S24'], readyIds: ['S25','S26'],
    expBacklogIds: ['E4'],
    removedIds: ['F2','E2','E3'],
    revenue: 1_640_000,
    buffs: { analyst:0, developer:1, tester:0 },
  });

  // Сессия 3: слабый игрок — 9 стандартных, F1 вовремя, блокер в тестировании, E4 в бэклоге
  const s3 = buildDay34State({
    deployedIds: ['S1','S2','S3','S4','S5','S6','S7','S8','S9','F1'],
    testIds: ['S10'], devDoneIds: ['S11'],
    developmentIds: ['S12','S13'], analysisDoneIds: ['S14'],
    analysisIds: ['S15','S16'], readyIds: ['S17','S18','S19'],
    expBacklogIds: ['E4'],
    removedIds: ['F2','E2','E3'],
    revenue: 980_000,
    buffs: { analyst:0, developer:0, tester:0 },
    blockerStoryId: 'S10',
  });

  [s1, s2, s3].forEach((state, i) => {
    const startDate = new Date(Date.now() - (30 - i * 3) * 86400000).toISOString();
    db.prepare(`
      INSERT INTO game_sessions (user_id, user_login, status, start_date, current_day, revenue, game_state)
      VALUES (?, 'admin', 'in_progress', ?, 34, ?, ?)
    `).run(adminId, startDate, state.revenue, JSON.stringify(state));
  });
}

module.exports = { db, initDb };
