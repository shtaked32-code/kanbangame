// ===================================================
//  GAME STATE
// ===================================================
let G = {};
let selectedWorker = null;
let currentChart = 'cfd';

function mkStory(def) {
  return {
    ...def,
    w: [...def.w],
    wr: [...def.w],
    age: 0,
    enteredDay: null,
    deployedDay: null,
    assignedWorkers: [],
    lane: def.type === 'e' ? 'hidden' : 'backlog',
    expedite: def.type === 'e',
    blocker: false,
    blockerRemaining: 0,
    blockerTotal: 0,
  };
}

// ===================================================
//  ИНИЦИАЛИЗАЦИЯ НОВОЙ ИГРЫ (без API)
// ===================================================
function setupFreshGame() {
  WIP.ready = 5; WIP.analysis = 3; WIP.development = 5; WIP.test = 3; WIP.expedite = 1;
  const stories = STORIES.map(mkStory);

  G = {
    day: 9,
    revenue: 0,
    dailyRev: 0,
    buffs: { analyst:0, developer:0, tester:0 },
    workDone: false,
    stories: Object.fromEntries(stories.map(s => [s.id, s])),
    backlog:        stories.filter(s => s.type !== 'e').map(s => s.id),
    ready: [], analysis: [], analysisDone: [], development: [],
    devDone: [], test: [], deployed: [],
    expBacklog: [], expReady: [], expAnalysis: [], expAnalysisDone: [],
    expDevelopment: [], expDevDone: [], expTest: [], expDeployed: [],
    carlosPolicy: false, lockdown: false, warnShown: false,
    workers: [
      {id:'a1', type:'analyst',   active:true,  assigned:null},
      {id:'a2', type:'analyst',   active:true,  assigned:null},
      {id:'a3', type:'analyst',   active:false, assigned:null},
      {id:'a4', type:'analyst',   active:false, assigned:null},
      {id:'d1', type:'developer', active:true,  assigned:null},
      {id:'d2', type:'developer', active:true,  assigned:null},
      {id:'d3', type:'developer', active:false, assigned:null},
      {id:'d4', type:'developer', active:false, assigned:null},
      {id:'t1', type:'tester',    active:true,  assigned:null},
      {id:'t2', type:'tester',    active:true,  assigned:null},
      {id:'t3', type:'tester',    active:true,  assigned:null},
      {id:'t4', type:'tester',    active:false, assigned:null},
    ],
    cfdHistory: [], ctHistory: [], revHistory: [], log: [],
  };

  const initialBoard = {
    test:         ['S1', 'S2', 'S3'],
    devDone:      ['S4', 'S5'],
    development:  ['S6', 'S7'],
    analysisDone: ['S8'],
    analysis:     ['S9', 'S10'],
    ready:        ['S11', 'S12', 'S13', 'F1', 'I1'],
  };
  Object.entries(initialBoard).forEach(([lane, ids]) => {
    ids.forEach(id => {
      const story = G.stories[id];
      if (!story) return;
      G.backlog = G.backlog.filter(sid => sid !== id);
      G[lane].push(id);
      story.lane = lane;
      story.enteredDay = 1;
      story.age = 0;
      if (lane === 'test' || lane === 'devDone') {
        story.wr[0] = 0; story.wr[1] = 0;
      } else if (lane === 'development') {
        story.wr[0] = 0;
        story.wr[1] = Math.ceil(story.w[1] * 0.6);
      } else if (lane === 'analysisDone') {
        story.wr[0] = 0;
      } else if (lane === 'analysis') {
        story.wr[0] = Math.ceil(story.w[0] * 0.6);
      }
    });
  });

  selectedWorker = null;
  render();
  recordChartData();
  showHelp();
}

// ===================================================
//  ЗАГРУЗКА СЕССИИ С СЕРВЕРА
// ===================================================
async function initGame() {
  if (!requireAuthRedirect()) return;

  const params = new URLSearchParams(window.location.search);
  const sid = params.get('sid');
  if (!sid) { window.location.href = 'dashboard.html'; return; }
  window.GAME_SESSION_ID = parseInt(sid);

  try {
    const session = await API.getSession(sid);
    if (session.status === 'completed') {
      window.location.href = 'dashboard.html';
      return;
    }
    if (session.game_state) {
      restoreState(session.game_state);
    } else {
      setupFreshGame();
      await saveState();
    }
  } catch (e) {
    alert('Не удалось загрузить сессию: ' + e.message);
    window.location.href = 'dashboard.html';
  }
}

function restoreState(savedState) {
  const { _wip, ...rest } = savedState;
  G = rest;
  if (_wip) {
    WIP.ready = _wip.ready;
    WIP.analysis = _wip.analysis;
    WIP.development = _wip.development;
    WIP.test = _wip.test;
    WIP.expedite = _wip.expedite;
  }
  selectedWorker = null;
  render();
  renderWipHeaders();
}

// ===================================================
//  СОХРАНЕНИЕ СОСТОЯНИЯ
// ===================================================
async function saveState() {
  if (!window.GAME_SESSION_ID) return;
  const stateToSave = { ...G, _wip: { ...WIP } };
  try {
    await API.saveSession(window.GAME_SESSION_ID, {
      current_day: G.day,
      revenue: G.revenue,
      game_state: stateToSave,
    });
  } catch (e) {
    console.error('Не удалось сохранить состояние:', e);
  }
}
