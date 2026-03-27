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
    wr: [...def.w],  // remaining work
    age: 0,
    enteredDay: null,
    deployedDay: null,
    assignedWorkers: [],
    lane: def.type === 'e' ? 'hidden' : 'backlog',
    expedite: def.type === 'e',
  };
}

function newGame() {
  hideGameOver();
  const stories = STORIES.map(mkStory);

  G = {
    day: 9,
    revenue: 0,
    dailyRev: 0,
    buffs: { analyst:0, developer:0, tester:0 },
    workDone: false,

    // All stories keyed by id
    stories: Object.fromEntries(stories.map(s => [s.id, s])),

    // Lane arrays — expedite stories start hidden; appear at appearDay
    backlog:        stories.filter(s => s.type !== 'e').map(s => s.id),
    ready:          [],
    analysis:       [],
    analysisDone:   [],
    development:    [],
    devDone:        [],
    test:           [],
    deployed:       [],
    expBacklog:     [],
    expReady:       [],
    expAnalysis:    [],
    expAnalysisDone:[],
    expDevelopment: [],
    expDevDone:     [],
    expTest:        [],
    expDeployed:    [],

    workers: [
      {id:'a1', type:'analyst',   assigned:null},
      {id:'a2', type:'analyst',   assigned:null},
      {id:'a3', type:'analyst',   assigned:null},
      {id:'d1', type:'developer', assigned:null},
      {id:'d2', type:'developer', assigned:null},
      {id:'d3', type:'developer', assigned:null},
      {id:'t1', type:'tester',    assigned:null},
      {id:'t2', type:'tester',    assigned:null},
      {id:'t3', type:'tester',    assigned:null},
    ],

    // Chart data
    cfdHistory:  [],   // [{day, backlog, ready, analysis, dev, test, deployed}]
    ctHistory:   [],   // [{id, days}]
    revHistory:  [],   // [{day, cumRev, dailyRev}]

    log: [],
  };

  // Pre-populate initial board
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
      // Zero out work for completed stages
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
  showHelp();
}
