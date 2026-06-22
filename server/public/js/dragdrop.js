// ===================================================
//  DRAG & DROP
// ===================================================
function dragStart(event, sid) {
  event.dataTransfer.setData('text/plain', sid);
  event.dataTransfer.effectAllowed = 'move';
  const story = G.stories[sid];
  window._dragValidTargets = VALID_MOVES[story ? story.lane : ''] || [];
  document.querySelectorAll('.lane').forEach(el => {
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
  });
}

function onDragEnter(e) {
  const idToLane = {
    'lane-backlog':'backlog',
    'lane-ready':'ready', 'lane-analysis':'analysis', 'lane-analysis-done':'analysisDone',
    'lane-development':'development', 'lane-dev-done':'devDone', 'lane-test':'test',
    'exp-ready':'expReady', 'exp-analysis':'expAnalysis', 'exp-analysis-done':'expAnalysisDone',
    'exp-development':'expDevelopment', 'exp-dev-done':'expDevDone', 'exp-test':'expTest',
  };
  if ((window._dragValidTargets || []).includes(idToLane[this.id])) this.classList.add('drop-target');
}

function onDragLeave(e) { this.classList.remove('drop-target'); }

function dragEnd(event) {
  document.querySelectorAll('.lane.drop-target').forEach(el => el.classList.remove('drop-target'));
  document.querySelectorAll('.lane').forEach(el => {
    el.removeEventListener('dragenter', onDragEnter);
    el.removeEventListener('dragleave', onDragLeave);
  });
  window._dragValidTargets = [];
}

function workerDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
}

function workerDrop(event, sid) {
  const data = event.dataTransfer.getData('text/plain');
  if (!data.startsWith('worker:')) return;
  event.preventDefault();
  event.stopPropagation();
  dragEnd(event);
  assignWorkerToStory(data.slice(7), sid);
  // saveState вызывается внутри assignWorkerToStory
}

function workerDropToPool(event) {
  const data = event.dataTransfer.getData('text/plain');
  if (!data.startsWith('worker:')) return;
  event.preventDefault();
  dragEnd(event);
  unassignWorker(data.slice(7));
  // saveState вызывается внутри unassignWorker
}

function dropCard(event, toLane) {
  event.preventDefault();
  const data = event.dataTransfer.getData('text/plain');
  if (!data || data.startsWith('worker:')) return;
  const story = G.stories[data];
  if (!story) return;
  const from = story.lane;
  const allowed = VALID_MOVES[from] || [];
  if (!allowed.includes(toLane)) { toast('Недопустимое перемещение'); return; }
  if (!canPullTo(toLane)) { toast('WIP-лимит достигнут!'); return; }

  // Возврат в бэклог: сбрасываем мета-данные, прогресс не трогаем
  if (toLane === 'backlog') {
    story.enteredDay = null;
    story.age = 0;
    story.blocker = false;
    story.blockerRemaining = 0;
    story.blockerTotal = 0;
    if (story.assignedWorkers?.length) {
      story.assignedWorkers.forEach(wid => {
        const w = G.workers.find(w => w.id === wid);
        if (w) w.assigned = null;
      });
      story.assignedWorkers = [];
    }
  }

  moveTo(data, toLane);
  render();
  saveState();
}
