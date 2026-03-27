// ===================================================
//  RENDER
// ===================================================
function render() {
  renderHeader();
  renderBacklog();
  renderLane('lane-ready',         G.ready,        'ready');
  renderLane('lane-analysis',      G.analysis,     'analysis');
  renderLane('lane-analysis-done', G.analysisDone, 'analysisDone');
  renderLane('lane-development',   G.development,  'development');
  renderLane('lane-dev-done',      G.devDone,      'devDone');
  renderLane('lane-test',          G.test,         'test');
  renderLane('lane-deployed',      G.deployed,     'deployed');
  renderExpedite();
  renderWorkerPool();
  renderWipHeaders();
}

function renderHeader() {
  document.getElementById('hdr-day').textContent = `Day ${G.day}`;
  document.getElementById('hdr-rev').textContent = `$${G.revenue.toLocaleString()}`;
}

function renderWipHeaders() {
  const ra = G.analysis.length + G.analysisDone.length;
  const rd = G.development.length + G.devDone.length;
  const rt = G.test.length;
  const rr = G.ready.length;

  function cls(val, max) { return val > max ? ' wip-over' : ''; }

  document.getElementById('sh-ready').innerHTML =
    `Готово к работе <span class="${cls(rr,WIP.ready)}">(${rr}/5)</span>`;
  document.getElementById('sh-analysis').innerHTML =
    `Анализ <span class="${cls(ra,WIP.analysis)}">(${ra}/3)</span>
    <div class="sh-sub"><div class="sh-sub-cell">В работе</div><div class="sh-sub-cell">Готово</div></div>`;
  document.getElementById('sh-development').innerHTML =
    `Разработка <span class="${cls(rd,WIP.development)}">(${rd}/5)</span>
    <div class="sh-sub"><div class="sh-sub-cell">В работе</div><div class="sh-sub-cell">Готово</div></div>`;
  document.getElementById('sh-test').innerHTML =
    `Тестирование <span class="${cls(rt,WIP.test)}">(${rt}/3)</span>`;
}

function renderBacklog() {
  const el = document.getElementById('lane-backlog');
  const types = [
    { type:'f', label:'Фиксированная дата', pullFn: () => pullFromBacklog('f') },
    { type:'s', label:'Стандартная',         pullFn: () => pullFromBacklog('s') },
    { type:'i', label:'Нематериальная',      pullFn: () => pullFromBacklog('i') },
  ];

  let html = '';
  types.forEach(({ type, label }) => {
    const ids = G.backlog.filter(id => G.stories[id].type === type);
    if (ids.length === 0) {
      html += `<div class="bl-section"><div class="bl-title">${label}</div><div style="text-align:center;color:#ccc;font-size:10px;margin-bottom:6px">—</div></div>`;
      return;
    }
    const topStory = G.stories[ids[0]];
    html += `<div class="bl-section">
      <div class="bl-title">${label}</div>
      <div class="bl-stack" draggable="true" ondragstart="dragStart(event,'${ids[0]}')" ondragend="dragEnd(event)" onclick="pullFromBacklog('${type}')">
        ${ids.length > 1 ? '<div class="bl-shadow" style="top:4px;left:4px"></div>' : ''}
        ${ids.length > 2 ? '<div class="bl-shadow" style="top:8px;left:8px"></div>' : ''}
        <div class="card card-${topStory.type} bl-top">${cardHTML(topStory, true)}</div>
        ${ids.length > 1 ? `<div class="bl-stack-count">ещё ${ids.length} →</div>` : ''}
      </div>
    </div>`;
  });

  el.innerHTML = html;
}

function renderLane(elId, sids, laneKey) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = sids.map(sid => {
    const story = G.stories[sid];
    const canClick = !!selectedWorker;
    const isDone = laneKey === 'analysisDone' || laneKey === 'devDone';
    let extra = '';
    if (isDone) {
      const toLane = laneKey === 'analysisDone' ? 'development' : 'test';
      const ok = canPullTo(toLane);
      extra = `<button class="pull-btn" onclick="pullCard('${sid}')" ${ok ? '' : 'disabled'}>→ Взять</button>`;
    }
    if (laneKey === 'ready') {
      extra = `<button class="pull-btn" onclick="pullCard('${sid}')">→ Начать анализ</button>`;
    }
    const arrived = window._arrivedCards?.has(sid) ? ' card-arrived' : '';
    return `<div class="card card-${story.type} ${canClick && activeBar(story) >= 0 ? 'clickable' : ''}${arrived}"
      draggable="true" ondragstart="dragStart(event,'${sid}')" ondragend="dragEnd(event)"
      ondragover="workerDragOver(event)" ondrop="workerDrop(event,'${sid}')"
      onclick="assignToStory('${sid}')"
      data-sid="${sid}">
      ${cardHTML(story, false)}
      ${extra}
    </div>`;
  }).join('');
}

function renderExpedite() {
  const expLanes = [
    ['exp-backlog',       G.expBacklog,      'expBacklog'],
    ['exp-ready',         G.expReady,        'expReady'],
    ['exp-analysis',      G.expAnalysis,     'expAnalysis'],
    ['exp-analysis-done', G.expAnalysisDone, 'expAnalysisDone'],
    ['exp-development',   G.expDevelopment,  'expDevelopment'],
    ['exp-dev-done',      G.expDevDone,      'expDevDone'],
    ['exp-test',          G.expTest,         'expTest'],
    ['exp-deployed',      G.expDeployed,     'expDeployed'],
  ];
  expLanes.forEach(([elId, sids, laneKey]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (laneKey === 'expBacklog') {
      el.innerHTML = sids.length > 0
        ? `<div class="bl-stack" style="margin:4px auto" draggable="true" ondragstart="dragStart(event,'${sids[0]}')" ondragend="dragEnd(event)" onclick="pullExpediteFromBacklog()">${cardHTML(G.stories[sids[0]], true)}</div>`
        : '';
      return;
    }
    const isDone = laneKey === 'expAnalysisDone' || laneKey === 'expDevDone';
    el.innerHTML = sids.map(sid => {
      const story = G.stories[sid];
      let extra = '';
      if (isDone) extra = `<button class="pull-btn" onclick="pullCard('${sid}')">→ Взять</button>`;
      if (laneKey === 'expReady') extra = `<button class="pull-btn" onclick="pullCard('${sid}')">→ Начать анализ</button>`;
      const arrived = window._arrivedCards?.has(sid) ? ' card-arrived' : '';
      return `<div class="card card-${story.type} ${selectedWorker && activeBar(story)>=0 ? 'clickable' : ''}${arrived}"
        draggable="true" ondragstart="dragStart(event,'${sid}')" ondragend="dragEnd(event)"
        ondragover="workerDragOver(event)" ondrop="workerDrop(event,'${sid}')"
        onclick="assignToStory('${sid}')" data-sid="${sid}">
        ${cardHTML(story, false)}${extra}</div>`;
    }).join('');
  });
}

function renderWorkerPool() {
  const pool = document.getElementById('worker-pool');
  pool.innerHTML = '';
  G.workers.forEach(w => {
    const el = document.createElement('div');
    el.className = `worker ${w.type}${selectedWorker === w.id ? ' w-selected' : ''}`;
    el.title = `${w.id.toUpperCase()} (${w.type})${w.assigned ? ' → ' + w.assigned : ''}`;
    el.dataset.wid = w.id;
    el.innerHTML = workerIcon(w.type);
    el.draggable = true;
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', 'worker:' + w.id);
      e.dataTransfer.effectAllowed = 'copy';
      window._dragValidTarget = null;
    });
    el.addEventListener('dragend', dragEnd);
    if (w.assigned) {
      el.style.opacity = '0.5';
      el.style.cursor = 'not-allowed';
      el.title = `${w.id} назначен на ${w.assigned} — нажмите для снятия`;
      el.onclick = () => unassignWorker(w.id);
    } else {
      el.onclick = () => selectWorker(w.id);
    }
    pool.appendChild(el);
  });

  // Show buffs
  const buffNames = { analyst:'аналитик', developer:'разработчик', tester:'тестировщик' };
  const buffInfo = Object.entries(G.buffs).filter(([,v]) => v > 0).map(([k,v]) => `${buffNames[k]}+${v}`).join(' ');
  if (buffInfo) {
    const b = document.createElement('span');
    b.style.cssText = 'font-size:9px;color:#5cb85c;margin-left:5px';
    b.textContent = '🎯 ' + buffInfo;
    pool.appendChild(b);
  }
}

function workerIcon(type) {
  return type === 'analyst' ? '👩' : type === 'developer' ? '👨‍💻' : '🤓';
}

function cardHTML(story, compact) {
  const hdrLeft = story.id;
  let hdrRight = '';
  if (story.type === 's' || story.type === 'e') hdrRight = `$${story.val}`;
  else if (story.type === 'f') hdrRight = `$${story.val}`;

  let desc = '';
  if (story.type === 's') desc = 'Стандартная история';
  else if (story.type === 'f') {
    const overdue = story.dueDay && G && G.day > story.dueDay && story.lane !== 'deployed';
    desc = `<span class="${overdue ? 'overdue' : 'due-desc'}">Срок: День ${story.dueDay}</span>`;
  }
  else if (story.type === 'i') desc = story.name;
  else if (story.type === 'e') desc = `<span class="due-desc">Срок: День ${story.dueDay}</span>`;

  function bar(remaining, total, cls, barIdx) {
    let html = '';
    const done = total - remaining;
    const newStart = window._newlyFilledBlocks?.[story.id]?.[barIdx] ?? -1;
    for (let i = 0; i < done; i++) {
      const isNew = newStart >= 0 && i >= newStart;
      const delay = isNew ? (i - newStart) * 620 : 0;
      html += `<div class="blk blk-${cls}${isNew ? ` blk-new-${cls}` : ''}"${isNew ? ` style="animation-delay:${delay}ms"` : ''}></div>`;
    }
    for (let i = 0; i < remaining; i++) html += `<div class="blk blk-empty"></div>`;
    return html;
  }

  const barsHtml = `<div class="bars">
    <div class="pbar">${bar(story.wr[0], story.w[0], 'a', 0)}</div>
    <div class="pbar">${bar(story.wr[1], story.w[1], 'd', 1)}</div>
    <div class="pbar">${bar(story.wr[2], story.w[2], 't', 2)}</div>
  </div>`;

  const age = story.age || 0;
  const footer = story.enteredDay
    ? `${age} ${age === 1 ? 'день' : age >= 2 && age <= 4 ? 'дня' : 'дней'}`
    : 'Доступна';

  const workerBadge = !compact && story.assignedWorkers && story.assignedWorkers.length > 0
    ? `<div class="card-workers">${story.assignedWorkers.map(wid => {
        const w = G.workers.find(ww => ww.id === wid);
        return w ? `<div class="worker ${w.type} w-small" data-wid="${wid}" title="Снять ${wid}" draggable="true" ondragstart="event.stopPropagation();event.dataTransfer.setData('text/plain','worker:${wid}');event.dataTransfer.effectAllowed='move';" onclick="event.stopPropagation();unassignWorker('${wid}')">${workerIcon(w.type)}</div>` : '';
      }).join('')}</div>`
    : '';

  return `<div class="card-hdr"><span class="card-id">${hdrLeft}</span><span class="card-val">${hdrRight}</span></div>
    <div class="card-desc ${story.type === 'f' || story.type === 'e' ? 'due-desc' : ''}">${desc}</div>
    ${barsHtml}
    ${workerBadge}
    <div class="card-footer">${footer}</div>`;
}
