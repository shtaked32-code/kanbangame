// ===================================================
//  LANE HELPERS
// ===================================================
function getLane(laneKey) { return G[laneKey] || []; }

function wipCount(laneKey) {
  if (laneKey === 'analysis')      return G.analysis.length + G.analysisDone.length;
  if (laneKey === 'development')   return G.development.length + G.devDone.length;
  if (laneKey === 'expAnalysis')   return G.expAnalysis.length + G.expAnalysisDone.length;
  if (laneKey === 'expDevelopment') return G.expDevelopment.length + G.expDevDone.length;
  return G[laneKey] ? G[laneKey].length : 0;
}

function activeBar(story) {
  const loc = story.lane;
  if (loc === 'analysis'    || loc === 'expAnalysis')    return 0;
  if (loc === 'development' || loc === 'expDevelopment') return 1;
  if (loc === 'test'        || loc === 'expTest')        return 2;
  return -1;
}

function isSpecialist(workerType, lane) {
  if (workerType === 'analyst'   && (lane === 'analysis'    || lane === 'expAnalysis'))    return true;
  if (workerType === 'developer' && (lane === 'development' || lane === 'expDevelopment')) return true;
  if (workerType === 'tester'    && (lane === 'test'        || lane === 'expTest'))        return true;
  return false;
}

function removeSid(laneKey, sid) {
  G[laneKey] = G[laneKey].filter(id => id !== sid);
}

function addSid(laneKey, sid) {
  if (!G[laneKey].includes(sid)) G[laneKey].push(sid);
}

function moveTo(sid, toLane) {
  const story = G.stories[sid];
  const from = story.lane;
  removeSid(from, sid);
  addSid(toLane, sid);
  story.lane = toLane;
  if (from === 'backlog' || from === 'expBacklog') {
    story.enteredDay = G.day;
    story.age = 0;
  }
}

// ===================================================
//  PULL MECHANICS
// ===================================================
function canPullTo(toLane) {
  if (toLane === 'ready')          return wipCount('ready')          < WIP.ready;
  if (toLane === 'analysis')       return wipCount('analysis')       < WIP.analysis;
  if (toLane === 'development')    return wipCount('development')    < WIP.development;
  if (toLane === 'test')           return wipCount('test')           < WIP.test;
  if (toLane === 'expAnalysis')    return wipCount('expAnalysis')    < WIP.analysis;
  if (toLane === 'expDevelopment') return wipCount('expDevelopment') < WIP.development;
  if (toLane === 'expTest')        return wipCount('expTest')        < WIP.test;
  return true;
}

function pullCard(sid) {
  const story = G.stories[sid];
  const loc = story.lane;
  let to = null;
  if (loc === 'analysisDone')    to = canPullTo('development')    ? 'development'    : null;
  if (loc === 'devDone')         to = canPullTo('test')           ? 'test'           : null;
  if (loc === 'expAnalysisDone') to = canPullTo('expDevelopment') ? 'expDevelopment' : null;
  if (loc === 'expDevDone')      to = canPullTo('expTest')        ? 'expTest'        : null;
  if (loc === 'ready')           to = canPullTo('analysis')       ? 'analysis'       : null;
  if (loc === 'expReady')        to = canPullTo('expAnalysis')    ? 'expAnalysis'    : null;
  if (to) {
    moveTo(sid, to);
    render();
  } else {
    toast('WIP-лимит достигнут — нельзя взять!');
  }
}

function pullFromBacklog(type) {
  if (!canPullTo('ready')) { toast('Достигнут WIP-лимит «Готово к работе» (макс. 5)'); return; }
  const sid = G.backlog.find(id => G.stories[id].type === type);
  if (!sid) { toast('В бэклоге больше нет историй типа ' + type.toUpperCase()); return; }
  moveTo(sid, 'ready');
  render();
}

function pullExpediteFromBacklog() {
  if (G.expBacklog.length === 0)       { toast('Срочных историй пока нет'); return; }
  if (G.expReady.length >= WIP.expedite) { toast('Срочная линия заполнена'); return; }
  const sid = G.expBacklog[0];
  moveTo(sid, 'expReady');
  render();
}

// ===================================================
//  WORKER ASSIGNMENT
// ===================================================
function selectWorker(wid) {
  selectedWorker = (selectedWorker === wid) ? null : wid;
  render();
}

function assignWorkerToStory(wid, sid) {
  const story = G.stories[sid];
  const worker = G.workers.find(w => w.id === wid);
  if (!worker || !story) return;
  const bar = activeBar(story);
  if (bar < 0) { toast('У этой истории нет активного этапа работы'); return; }
  if (worker.assigned === sid) {
    // Toggle off — unassign
    worker.assigned = null;
    story.assignedWorkers = story.assignedWorkers.filter(id => id !== wid);
  } else {
    // Unassign from previous story
    if (worker.assigned) {
      const prev = G.stories[worker.assigned];
      if (prev) prev.assignedWorkers = prev.assignedWorkers.filter(id => id !== wid);
    }
    worker.assigned = sid;
    if (!story.assignedWorkers.includes(wid)) story.assignedWorkers.push(wid);
  }
  selectedWorker = null;
  render();
}

function assignToStory(sid) {
  if (!selectedWorker) return;
  assignWorkerToStory(selectedWorker, sid);
}

function unassignWorker(wid) {
  const worker = G.workers.find(w => w.id === wid);
  if (!worker || !worker.assigned) return;
  const story = G.stories[worker.assigned];
  if (story) story.assignedWorkers = story.assignedWorkers.filter(id => id !== wid);
  worker.assigned = null;
  render();
}

// ===================================================
//  GAME MECHANICS — START WORK
// ===================================================
function startWork() {
  if (G.workDone) return;
  G.workDone = true;
  document.getElementById('btn-start').disabled = true;

  const log = [];
  const workerNames = { analyst:'Аналитик', developer:'Разработчик', tester:'Тестировщик' };
  const workerEmoji = { analyst:'🔴', developer:'🔵', tester:'🟢' };

  // Snapshot work remaining before applying work
  const wrBefore = {};
  G.workers.forEach(w => {
    if (w.assigned && G.stories[w.assigned]) {
      wrBefore[w.assigned] = [...G.stories[w.assigned].wr];
    }
  });

  // Process each assigned worker — collect pending advances instead of calling immediately
  const pendingAdvances = [];
  G.workers.forEach(worker => {
    if (!worker.assigned) return;
    const story = G.stories[worker.assigned];
    if (!story) return;
    const bar = activeBar(story);
    if (bar < 0) return;

    const spec = isSpecialist(worker.type, story.lane);
    let work, rollDesc;
    if (spec) {
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      work = r1 + r2;
      rollDesc = `2d6: ${r1}+${r2}=${work}`;
    } else {
      const r1 = Math.floor(Math.random() * 6) + 1;
      work = r1;
      rollDesc = `1d6: ${r1}`;
    }

    // Apply buff bonus
    work += G.buffs[worker.type] || 0;
    story.wr[bar] = Math.max(0, story.wr[bar] - work);

    const cls = worker.type === 'analyst' ? 'log-a' : worker.type === 'developer' ? 'log-d' : 'log-t';
    log.push(`<span class="${cls}">${workerEmoji[worker.type]} ${worker.id.toUpperCase()}</span> → ${story.id}: ${rollDesc} = <strong>${work}</strong> работы`);

    if (story.wr[bar] === 0) {
      pendingAdvances.push(story.id);
    }
  });

  // Age all in-pipeline stories
  [...G.ready, ...G.analysis, ...G.analysisDone, ...G.development, ...G.devDone, ...G.test,
   ...G.expReady, ...G.expAnalysis, ...G.expAnalysisDone, ...G.expDevelopment, ...G.expDevDone, ...G.expTest].forEach(sid => {
    G.stories[sid].age = (G.stories[sid].age || 0) + 1;
  });

  // Daily revenue from deployed standard stories
  G.dailyRev = G.deployed.concat(G.expDeployed)
    .filter(sid => G.stories[sid].type === 's')
    .reduce((sum, sid) => sum + G.stories[sid].val, 0);
  G.revenue += G.dailyRev;

  // Compute newly filled blocks for animation
  window._newlyFilledBlocks = {};
  Object.entries(wrBefore).forEach(([sid, prevWr]) => {
    const story = G.stories[sid];
    if (!story) return;
    [0, 1, 2].forEach(barIdx => {
      const prevDone = story.w[barIdx] - prevWr[barIdx];
      const currDone = story.w[barIdx] - story.wr[barIdx];
      if (currDone > prevDone) {
        if (!window._newlyFilledBlocks[sid]) window._newlyFilledBlocks[sid] = {};
        window._newlyFilledBlocks[sid][barIdx] = prevDone;
      }
    });
  });

  // Compute how long fill animation takes (last block delay + animation duration + buffer)
  let maxDelay = 0;
  Object.entries(window._newlyFilledBlocks).forEach(([sid, bars]) => {
    const story = G.stories[sid];
    Object.entries(bars).forEach(([barIdx, newStart]) => {
      const done = story.w[barIdx] - story.wr[barIdx];
      const lastDelay = (done - 1 - newStart) * 620;
      if (lastDelay > maxDelay) maxDelay = lastDelay;
    });
  });
  const fillDuration = maxDelay + 560 + 200; // last block delay + anim duration + buffer

  // Record chart data (workers still assigned — unassign after animation)
  recordChartData();

  // Show log
  showWorkLog(log);

  // Render: shows fill animation
  render();

  // After fill animation: fly workers back, then fly completed cards
  setTimeout(() => {
    window._newlyFilledBlocks = {};

    // Capture worker badge positions (source for flyback)
    const workerSources = {};
    G.workers.filter(w => w.assigned).forEach(w => {
      const badge = document.querySelector('[data-wid="' + w.id + '"]');
      if (badge) workerSources[w.id] = { rect: badge.getBoundingClientRect(), type: w.type };
    });

    // Capture card FROM positions before advancing
    const fromRects = {};
    pendingAdvances.forEach(sid => {
      const el = document.querySelector('[data-sid="' + sid + '"]');
      if (el) fromRects[sid] = el.getBoundingClientRect();
    });

    // Unassign all workers now
    Object.values(G.stories).forEach(s => { s.assignedWorkers = []; });
    G.workers.forEach(w => { w.assigned = null; });

    // Advance stories in game state and re-render (badges gone, pool restored)
    pendingAdvances.forEach(sid => advanceStory(sid, []));
    render();

    // Capture pool TARGET positions after re-render
    const workerTargets = {};
    G.workers.forEach(w => {
      const el = document.querySelector('#worker-pool [data-wid="' + w.id + '"]');
      if (el) workerTargets[w.id] = el.getBoundingClientRect();
    });

    // Fly worker clones from card positions back to pool
    Object.entries(workerSources).forEach(([wid, { rect: fromRect, type }]) => {
      const toRect = workerTargets[wid];
      if (!toRect) return;
      const clone = document.createElement('div');
      clone.className = 'worker ' + type + ' w-small';
      clone.innerHTML = workerIcon(type);
      clone.style.cssText =
        'position:fixed;left:' + fromRect.left + 'px;top:' + fromRect.top + 'px;' +
        'width:' + fromRect.width + 'px;height:' + fromRect.height + 'px;' +
        'z-index:9998;pointer-events:none;' +
        'transition:left 0.52s cubic-bezier(.4,0,.2,1),top 0.52s cubic-bezier(.4,0,.2,1);';
      document.body.appendChild(clone);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clone.style.left = toRect.left + 'px';
        clone.style.top  = toRect.top  + 'px';
      }));
      setTimeout(() => clone.remove(), 580);
    });

    // Fly each card from its old position to the new one
    pendingAdvances.forEach(sid => {
      const fromRect = fromRects[sid];
      if (!fromRect) return;
      const toEl = document.querySelector('[data-sid="' + sid + '"]');
      if (!toEl) return;
      const toRect = toEl.getBoundingClientRect();

      const clone = toEl.cloneNode(true);
      clone.removeAttribute('draggable');
      clone.style.cssText =
        'position:fixed;left:' + fromRect.left + 'px;top:' + fromRect.top + 'px;' +
        'width:' + fromRect.width + 'px;z-index:9999;pointer-events:none;' +
        'box-shadow:4px 8px 24px rgba(0,0,0,0.38);' +
        'transition:left 0.52s cubic-bezier(.4,0,.2,1),top 0.52s cubic-bezier(.4,0,.2,1);';
      document.body.appendChild(clone);
      toEl.style.visibility = 'hidden';

      requestAnimationFrame(() => requestAnimationFrame(() => {
        clone.style.left = toRect.left + 'px';
        clone.style.top  = toRect.top  + 'px';
      }));

      setTimeout(() => {
        clone.remove();
        toEl.style.visibility = '';
      }, 580);
    });

    setTimeout(advanceDay, 4000);
  }, fillDuration);
}

// ===================================================
//  STORY ADVANCEMENT
// ===================================================
function advanceStory(sid, log) {
  const story = G.stories[sid];
  const loc = story.lane;
  const nextMap = {
    'analysis':        'analysisDone',
    'development':     'devDone',
    'test':            'deployed',
    'expAnalysis':     'expAnalysisDone',
    'expDevelopment':  'expDevDone',
    'expTest':         'expDeployed',
  };
  const next = nextMap[loc];
  if (!next) return;

  if (next === 'deployed' || next === 'expDeployed') {
    story.deployedDay = G.day;
    G.ctHistory.push({ id: story.id, days: G.day - (story.enteredDay || G.day) + 1 });
    applyFixedDateBonus(story);
    applyIntangibleBuff(story);
    applyExpediteBonus(story);
    log.push(`<span class="log-dep">★ ${story.id} ВЫПУЩЕНА в День ${G.day}!</span>`);
  } else {
    const stageNames = {
      analysisDone:'Анализ готово', development:'Разработка', devDone:'Разработка готово',
      test:'Тестирование', deployed:'Выпущено',
      expAnalysisDone:'Срочный — Анализ готово', expDevelopment:'Срочный — Разработка',
      expDevDone:'Срочный — Разработка готово', expTest:'Срочный — Тестирование',
      expDeployed:'Срочный — Выпущено'
    };
    log.push(`<span class="log-adv">→ ${story.id} перешла в ${stageNames[next] || next}</span>`);
  }
  moveTo(sid, next);
}

function applyFixedDateBonus(story) {
  if (story.type !== 'f') return;
  const onTime = story.deployedDay <= story.dueDay;
  if (onTime && story.val > 0) {
    G.revenue += story.val;
    toast(`✅ ${story.id} delivered on time! +$${story.val} bonus`);
  } else if (!onTime && story.val > 0) {
    toast(`❌ ${story.id} missed deadline (Day ${story.dueDay}) — no bonus`);
  } else if (!onTime && story.val < 0) {
    G.revenue += story.val;
    toast(`⚠️ ${story.id} delivered late — $${Math.abs(story.val)} penalty!`);
  } else {
    toast(`✅ ${story.id} delivered before Day ${story.dueDay} — penalty avoided!`);
  }
}

function applyIntangibleBuff(story) {
  if (story.type !== 'i' || !story.buff) return;
  G.buffs[story.buff] = (G.buffs[story.buff] || 0) + 1;
  const buffNames2 = { analyst:'аналитики', developer:'разработчики', tester:'тестировщики' };
  toast(`${story.id} выпущена — ${buffNames2[story.buff] || story.buff} получают +1 к броску!`);
}

function applyExpediteBonus(story) {
  if (story.type !== 'e') return;
  const onTime = story.deployedDay <= story.dueDay;
  if (onTime && story.val > 0) {
    G.revenue += story.val;
    toast(`⚡ ${story.id} expedite delivered on time! +$${story.val.toLocaleString()} bonus!`);
  } else if (!onTime && story.val > 0) {
    toast(`⚡ ${story.id} expedite delivered late — no bonus.`);
  } else if (story.val < 0) {
    G.revenue += story.val;
    toast(`⚡ ${story.id} expedite penalty: -$${Math.abs(story.val).toLocaleString()}!`);
  }
}

// ===================================================
//  DAY ADVANCEMENT
// ===================================================
function advanceDay() {
  G.day++;
  G.workDone = false;

  // Check for expedite stories appearing
  STORIES.filter(s => s.type === 'e' && s.appearDay === G.day).forEach(s => {
    const story = G.stories[s.id];
    if (story.lane === 'hidden') {
      addSid('expBacklog', s.id);
      story.lane = 'expBacklog';
      toast(`⚡ Срочная история ${s.id} появилась! (Срок: День ${s.dueDay})`);
    }
  });

  document.getElementById('btn-start').disabled = false;
  hideWorkLog();

  if (G.day > 35) {
    endGame();
    return;
  }

  showDayNotify();
  render();
}

function endGame() {
  recordChartData();
  render();
  showGameOver();
}

// ===================================================
//  CHART DATA
// ===================================================
function recordChartData() {
  const d = G.day;
  G.cfdHistory.push({
    day: d,
    backlog:  G.backlog.length,
    ready:    G.ready.length,
    analysis: G.analysis.length + G.analysisDone.length,
    dev:      G.development.length + G.devDone.length,
    test:     G.test.length,
    deployed: G.deployed.length + G.expDeployed.length,
  });
  G.revHistory.push({ day: d, cumRev: G.revenue, dailyRev: G.dailyRev });
}
