// ===================================================
//  STORY DATABASE
// ===================================================
const STORIES = [
  // Standard
  {id:'S1',  type:'s', val:110, w:[8,8,6]},
  {id:'S2',  type:'s', val:120, w:[10,9,6]},
  {id:'S3',  type:'s', val:110, w:[9,9,7]},
  {id:'S4',  type:'s', val:100, w:[8,8,6]},
  {id:'S5',  type:'s', val:130, w:[10,9,7]},
  {id:'S6',  type:'s', val:110, w:[9,7,3]},
  {id:'S7',  type:'s', val:120, w:[10,8,9]},
  {id:'S8',  type:'s', val:100, w:[8,8,9]},
  {id:'S9',  type:'s', val:120, w:[9,9,12]},
  {id:'S10', type:'s', val:110, w:[10,9,7]},
  {id:'S11', type:'s', val:130, w:[12,7,9]},
  {id:'S12', type:'s', val:100, w:[7,8,10]},
  {id:'S13', type:'s', val:100, w:[8,9,9]},
  {id:'S14', type:'s', val:100, w:[5,6,4]},
  {id:'S15', type:'s', val:70,  w:[5,5,4]},
  {id:'S16', type:'s', val:60,  w:[4,4,3]},
  {id:'S17', type:'s', val:70,  w:[5,5,4]},
  {id:'S18', type:'s', val:70,  w:[5,6,4]},
  {id:'S19', type:'s', val:100, w:[6,6,5]},
  {id:'S20', type:'s', val:80,  w:[5,5,4]},
  {id:'S21', type:'s', val:70,  w:[4,5,3]},
  {id:'S22', type:'s', val:90,  w:[6,6,5]},
  {id:'S23', type:'s', val:110, w:[7,6,5]},
  {id:'S24', type:'s', val:90,  w:[6,6,5]},
  {id:'S25', type:'s', val:80,  w:[5,5,4]},
  {id:'S26', type:'s', val:110, w:[7,7,5]},
  {id:'S27', type:'s', val:100, w:[6,7,5]},
  {id:'S28', type:'s', val:90,  w:[6,6,5]},
  {id:'S29', type:'s', val:110, w:[7,7,6]},
  {id:'S30', type:'s', val:70,  w:[4,5,3]},
  {id:'S31', type:'s', val:80,  w:[5,6,4]},
  {id:'S32', type:'s', val:80,  w:[5,5,4]},
  {id:'S33', type:'s', val:60,  w:[4,4,3]},
  {id:'S34', type:'s', val:130, w:[8,8,6]},
  {id:'S35', type:'s', val:90,  w:[5,6,5]},
  {id:'S36', type:'s', val:110, w:[7,6,5]},
  {id:'S37', type:'s', val:80,  w:[5,5,4]},
  {id:'S38', type:'s', val:80,  w:[5,6,4]},
  {id:'S39', type:'s', val:100, w:[6,6,5]},
  {id:'S40', type:'s', val:90,  w:[5,6,4]},
  {id:'S41', type:'s', val:110, w:[7,7,5]},
  {id:'S42', type:'s', val:90,  w:[6,6,5]},
  {id:'S43', type:'s', val:70,  w:[4,5,3]},
  {id:'S44', type:'s', val:110, w:[7,7,5]},
  {id:'S45', type:'s', val:90,  w:[6,6,4]},
  {id:'S46', type:'s', val:90,  w:[6,6,5]},
  {id:'S47', type:'s', val:110, w:[7,7,5]},
  {id:'S48', type:'s', val:90,  w:[5,6,5]},
  {id:'S49', type:'s', val:70,  w:[4,5,4]},
  {id:'S50', type:'s', val:110, w:[7,7,5]},
  // Fixed date
  {id:'F1', type:'f', val:150,  dueDay:15, w:[2,3,2]},
  {id:'F2', type:'f', val:-500, dueDay:20, w:[4,5,3]},
  {id:'F3', type:'f', val:100,  dueDay:25, w:[8,9,8]},
  {id:'F4', type:'f', val:200,  dueDay:30, w:[6,7,5]},
  {id:'F5', type:'f', val:-300, dueDay:28, w:[5,6,4]},
  // Intangible
  {id:'I1', type:'i', name:'Обновление базы данных',     w:[6,9,7], buff:'developer'},
  {id:'I2', type:'i', name:'Документация легаси-кода',   w:[2,6,4], buff:'analyst'},
  {id:'I3', type:'i', name:'Рефакторинг ядра системы',   w:[4,7,5], buff:'developer'},
  {id:'I4', type:'i', name:'Настройка CI/CD пайплайна',  w:[3,5,3], buff:'tester'},
  {id:'I5', type:'i', name:'Улучшение покрытия тестами', w:[2,4,5], buff:'tester'},
  // Expedite (appear at specific days)
  {id:'E1', type:'e', val:2000,  dueDay:18, appearDay:8,  w:[3,4,2]},
  {id:'E2', type:'e', val:-2500, dueDay:25, appearDay:12, w:[4,5,3]},
  {id:'E3', type:'e', val:-1000, dueDay:30, appearDay:18, w:[3,4,3]},
  {id:'E4', type:'e', val:3000,  dueDay:35, appearDay:22, w:[5,6,4]},
];

// ===================================================
//  CONSTANTS
// ===================================================
const WIP = { ready:5, analysis:3, development:5, test:3, expedite:1 };

const STD_LANES = ['backlog','ready','analysis','analysisDone','development','devDone','test','deployed'];
const EXP_LANES = ['expBacklog','expReady','expAnalysis','expAnalysisDone','expDevelopment','expDevDone','expTest','expDeployed'];

// Valid forward moves: fromLane → toLane
const VALID_MOVES = {
  'backlog':        'ready',
  'ready':          'analysis',
  'analysisDone':   'development',
  'devDone':        'test',
  'expBacklog':     'expReady',
  'expReady':       'expAnalysis',
  'expAnalysisDone':'expDevelopment',
  'expDevDone':     'expTest',
};
