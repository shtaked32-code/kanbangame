// ===================================================
//  DRAG & DROP
// ===================================================
function dragStart(event, sid) {
  event.dataTransfer.setData('text/plain', sid);
  event.dataTransfer.effectAllowed = 'move';
  const story = G.stories[sid];
  const validTarget = VALID_MOVES[story ? story.lane : ''];
  document.querySelectorAll('.lane').forEach(el => {
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
  });
  window._dragValidTarget = validTarget;
}

function onDragEnter(e) {
  const laneId = this.id;
  const idToLane = {
    'lane-ready':'ready', 'lane-analysis':'analysis', 'lane-analysis-done':'analysisDone',
    'lane-development':'development', 'lane-dev-done':'devDone', 'lane-test':'test',
    'exp-ready':'expReady', 'exp-analysis':'expAnalysis', 'exp-analysis-done':'expAnalysisDone',
    'exp-development':'expDevelopment', 'exp-dev-done':'expDevDone', 'exp-test':'expTest',
  };
  if (idToLane[laneId] === window._dragValidTarget) this.classList.add('drop-target');
}

function onDragLeave(e) {
  this.classList.remove('drop-target');
}

function dragEnd(event) {
  document.querySelectorAll('.lane.drop-target').forEach(el => el.classList.remove('drop-target'));
  document.querySelectorAll('.lane').forEach(el => {
    el.removeEventListener('dragenter', onDragEnter);
    el.removeEventListener('dragleave', onDragLeave);
  });
  window._dragValidTarget = null;
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
}

function workerDropToPool(event) {
  const data = event.dataTransfer.getData('text/plain');
  if (!data.startsWith('worker:')) return;
  event.preventDefault();
  dragEnd(event);
  unassignWorker(data.slice(7));
}

function dropCard(event, toLane) {
  event.preventDefault();
  const data = event.dataTransfer.getData('text/plain');
  if (!data || data.startsWith('worker:')) return;
  const story = G.stories[data];
  if (!story) return;
  const from = story.lane;
  if (VALID_MOVES[from] !== toLane) { toast('Недопустимое перемещение'); return; }
  if (!canPullTo(toLane)) { toast('WIP-лимит достигнут!'); return; }
  moveTo(data, toLane);
  render();
}
