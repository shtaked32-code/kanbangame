// ===================================================
//  LANE HELPERS
// ===================================================
function getLane(laneKey) { return G[laneKey] || []; }

function wipCount(laneKey) {
  if (laneKey === 'analysis')       return G.analysis.length + G.analysisDone.length;
  if (laneKey === 'development')    return G.development.length + G.devDone.length;
  if (laneKey === 'expAnalysis')    return G.expAnalysis.length + G.expAnalysisDone.length;
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

function canAssignWorker(worker, story) {
  if (!worker || !worker.active) return false;
  const bar = activeBar(story);
  if (bar < 0) return false;
  if (story.blocker) return true;
  if (G.carlosPolicy) {
    const inTest = story.lane === 'test' || story.lane === 'expTest';
    if (inTest  && worker.type !== 'tester') return false;
    if (!inTest && worker.type === 'tester') return false;
  }
  if (G.lockdown && !isSpecialist(worker.type, story.lane)) return false;
  return true;
}

function removeSid(laneKey, sid) { G[laneKey] = G[laneKey].filter(id => id !== sid); }
function addSid(laneKey, sid)    { if (!G[laneKey].includes(sid)) G[laneKey].push(sid); }

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
    saveState();
  } else {
    toast('WIP-лимит достигнут — нельзя взять!');
  }
}

function pullFromBacklog(type) {
  if (!canPullTo('ready')) { toast(`Достигнут WIP-лимит «Готово к работе» (макс. ${WIP.ready})`); return; }
  const sid = G.backlog.find(id => G.stories[id].type === type);
  if (!sid) { toast('В бэклоге больше нет историй типа ' + type.toUpperCase()); return; }
  moveTo(sid, 'ready');
  render();
  saveState();
}

function pullExpediteFromBacklog() {
  if (G.expBacklog.length === 0)         { toast('Срочных историй пока нет'); return; }
  if (G.expReady.length >= WIP.expedite) { toast('Срочная линия заполнена'); return; }
  const sid = G.expBacklog[0];
  moveTo(sid, 'expReady');
  render();
  saveState();
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
  if (!canAssignWorker(worker, story)) {
    if (!worker.active)  { toast('Сотрудник недоступен'); return; }
    if (G.carlosPolicy)  { toast('Политика Карлоса: только тестировщики тестируют'); return; }
    if (G.lockdown)      { toast('Карантин: только специалисты работают в своей колонке'); return; }
    toast('Назначение невозможно'); return;
  }
  const bar = activeBar(story);
  if (bar < 0) { toast('У этой истории нет активного этапа работы'); return; }
  if (worker.assigned === sid) {
    worker.assigned = null;
    story.assignedWorkers = story.assignedWorkers.filter(id => id !== wid);
  } else {
    if (worker.assigned) {
      const prev = G.stories[worker.assigned];
      if (prev) prev.assignedWorkers = prev.assignedWorkers.filter(id => id !== wid);
    }
    worker.assigned = sid;
    if (!story.assignedWorkers.includes(wid)) story.assignedWorkers.push(wid);
  }
  selectedWorker = null;
  render();
  saveState();
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
  saveState();
}

// ===================================================
//  GAME MECHANICS — START WORK
// ===================================================
function startWork() {
  if (G.workDone) return;
  const unassigned = G.workers.filter(w => w.active && !w.assigned);
  if (unassigned.length > 0 && !G.warnShown) {
    G.warnShown = true;
    document.getElementById('unassigned-warning').style.display = 'flex';
    return;
  }
  G.warnShown = false;
  document.getElementById('unassigned-warning').style.display = 'none';
  G.workDone = true;
  document.getElementById('btn-start').disabled = true;

  const log = [];
  const workerEmoji = { analyst:'🔴', developer:'🔵', tester:'🟢' };

  window._newlyFilledBlocks = {};
  const pendingAdvances = [];
  let cumulativeDelay = 0;

  const laneOrder = [
    'expAnalysis','expAnalysisDone','expDevelopment','expDevDone','expTest',
    'analysis','analysisDone','development','devDone','test',
  ];
  laneOrder.forEach(lane => {
    (G[lane] || []).forEach(sid => {
      const story = G.stories[sid];
      if (!story) return;
      const assignedHere = G.workers.filter(w => w.assigned === sid);

      if (story.blocker && story.blockerRemaining > 0) {
        assignedHere.forEach(worker => {
          const prevCleared = story.blockerTotal - story.blockerRemaining;
          const r1 = Math.floor(Math.random() * 6) + 1;
          const overflow = Math.max(0, r1 - story.blockerRemaining);
          story.blockerRemaining = Math.max(0, story.blockerRemaining - r1);
          const currCleared = story.blockerTotal - story.blockerRemaining;
          const filled = currCleared - prevCleared;

          const cls = worker.type === 'analyst' ? 'log-a' : worker.type === 'developer' ? 'log-d' : 'log-t';
          log.push(`<span class="${cls}">${workerEmoji[worker.type]} ${worker.id.toUpperCase()}</span> → ${story.id} (дефект): 1d6: ${r1}`);

          if (filled > 0) {
            if (!window._newlyFilledBlocks[story.id]) window._newlyFilledBlocks[story.id] = {};
            if (!window._newlyFilledBlocks[story.id][3]) window._newlyFilledBlocks[story.id][3] = [];
            window._newlyFilledBlocks[story.id][3].push({ start: prevCleared, count: filled, baseDelay: cumulativeDelay });
            cumulativeDelay += (filled - 1) * 620 + 560 + 80;
          }

          if (story.blockerRemaining === 0) {
            story.blocker = false;
            if (overflow > 0) {
              const barIdx = activeBar(story);
              if (barIdx >= 0) {
                const prevDone = story.w[barIdx] - story.wr[barIdx];
                story.wr[barIdx] = Math.max(0, story.wr[barIdx] - overflow);
                const overflowFilled = (story.w[barIdx] - story.wr[barIdx]) - prevDone;
                if (overflowFilled > 0) {
                  if (!window._newlyFilledBlocks[story.id]) window._newlyFilledBlocks[story.id] = {};
                  if (!window._newlyFilledBlocks[story.id][barIdx]) window._newlyFilledBlocks[story.id][barIdx] = [];
                  window._newlyFilledBlocks[story.id][barIdx].push({ start: prevDone, count: overflowFilled, baseDelay: cumulativeDelay });
                  cumulativeDelay += (overflowFilled - 1) * 620 + 560 + 80;
                }
                if (story.wr[barIdx] === 0 && !pendingAdvances.includes(sid)) pendingAdvances.push(sid);
              }
            }
          }
        });
        return;
      }

      const bar = activeBar(story);
      if (bar < 0) return;
      assignedHere.forEach(worker => {
        const prevDone = story.w[bar] - story.wr[bar];
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
        work += G.buffs[worker.type] || 0;
        story.wr[bar] = Math.max(0, story.wr[bar] - work);
        const currDone = story.w[bar] - story.wr[bar];
        const filled = currDone - prevDone;

        const cls = worker.type === 'analyst' ? 'log-a' : worker.type === 'developer' ? 'log-d' : 'log-t';
        log.push(`<span class="${cls}">${workerEmoji[worker.type]} ${worker.id.toUpperCase()}</span> → ${story.id}: ${rollDesc} = <strong>${work}</strong> работы`);

        if (filled > 0) {
          if (!window._newlyFilledBlocks[story.id]) window._newlyFilledBlocks[story.id] = {};
          if (!window._newlyFilledBlocks[story.id][bar]) window._newlyFilledBlocks[story.id][bar] = [];
          window._newlyFilledBlocks[story.id][bar].push({ start: prevDone, count: filled, baseDelay: cumulativeDelay });
          cumulativeDelay += (filled - 1) * 620 + 560 + 80;
        }
        if (story.wr[bar] === 0 && !pendingAdvances.includes(sid)) pendingAdvances.push(sid);
      });
    });
  });

  [...G.ready, ...G.analysis, ...G.analysisDone, ...G.development, ...G.devDone, ...G.test,
   ...G.expReady, ...G.expAnalysis, ...G.expAnalysisDone, ...G.expDevelopment, ...G.expDevDone, ...G.expTest].forEach(sid => {
    G.stories[sid].age = (G.stories[sid].age || 0) + 1;
  });

  const fillDuration = cumulativeDelay + 200;
  recordChartData();
  showWorkLog(log);
  render();

  setTimeout(() => {
    window._newlyFilledBlocks = {};

    const workerSources = {};
    G.workers.filter(w => w.assigned).forEach(w => {
      const badge = document.querySelector('[data-wid="' + w.id + '"]');
      if (badge) workerSources[w.id] = { rect: badge.getBoundingClientRect(), type: w.type };
    });

    const fromRects = {};
    pendingAdvances.forEach(sid => {
      const el = document.querySelector('[data-sid="' + sid + '"]');
      if (el) fromRects[sid] = el.getBoundingClientRect();
    });

    Object.values(G.stories).forEach(s => { s.assignedWorkers = []; });
    G.workers.forEach(w => { w.assigned = null; });

    pendingAdvances.forEach(sid => advanceStory(sid, []));

    G.dailyRev = G.deployed.concat(G.expDeployed)
      .filter(sid => G.stories[sid].type === 's')
      .reduce((sum, sid) => sum + G.stories[sid].val, 0);
    G.revenue += G.dailyRev;

    render();

    const workerTargets = {};
    G.workers.forEach(w => {
      const el = document.querySelector('#worker-pool [data-wid="' + w.id + '"]');
      if (el) workerTargets[w.id] = el.getBoundingClientRect();
    });

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
      setTimeout(() => { clone.remove(); toEl.style.visibility = ''; }, 580);
    });

    setTimeout(advanceDay, 1000);
  }, fillDuration);
}

// ===================================================
//  STORY ADVANCEMENT
// ===================================================
function advanceStory(sid, log) {
  const story = G.stories[sid];
  const loc = story.lane;
  const nextMap = {
    'analysis':       'analysisDone',
    'development':    'devDone',
    'test':           'deployed',
    'expAnalysis':    'expAnalysisDone',
    'expDevelopment': 'expDevDone',
    'expTest':        'expDeployed',
  };
  const next = nextMap[loc];
  if (!next) return;

  if (next === 'deployed' || next === 'expDeployed') {
    story.deployedDay = G.day;
    G.ctHistory.push({ id: story.id, days: G.day - (story.enteredDay || G.day) + 1, deployedDay: G.day });
    applyFixedDateBonus(story);
    applyIntangibleBuff(story);
    applyExpediteBonus(story);
    log.push(`<span class="log-dep">★ ${story.id} ВЫПУЩЕНА в День ${G.day}!</span>`);
  }
  moveTo(sid, next);
}

function applyFixedDateBonus(story) {
  if (story.type !== 'f') return;
  const onTime = story.deployedDay <= story.dueDay;
  if (onTime && story.val > 0) {
    G.revenue += story.val;
    toast(`✅ ${story.id} сдана в срок! +${story.val.toLocaleString('ru-RU')} ₽ бонус`);
  } else if (!onTime && story.val > 0) {
    toast(`❌ ${story.id} просрочена (День ${story.dueDay}) — бонус не начислен`);
  } else if (!onTime && story.val < 0) {
    G.revenue += story.val;
    toast(`⚠️ ${story.id} сдана с опозданием — штраф ${Math.abs(story.val).toLocaleString('ru-RU')} ₽!`);
  } else {
    toast(`✅ ${story.id} сдана до Дня ${story.dueDay} — штраф избежан!`);
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
    toast(`⚡ ${story.id} срочная сдана вовремя! +${story.val.toLocaleString('ru-RU')} ₽ бонус!`);
  } else if (!onTime && story.val > 0) {
    toast(`⚡ ${story.id} срочная сдана с опозданием — бонус не начислен.`);
  } else if (story.val < 0) {
    G.revenue += story.val;
    toast(`⚡ ${story.id} штраф срочной: -${Math.abs(story.val).toLocaleString('ru-RU')} ₽!`);
  }
}

// ===================================================
//  DAY ADVANCEMENT
// ===================================================
function findOverdueStories(day) {
  const allLanes = [
    ...G.ready, ...G.analysis, ...G.analysisDone,
    ...G.development, ...G.devDone, ...G.test,
    ...G.expBacklog, ...G.expReady, ...G.expAnalysis, ...G.expAnalysisDone,
    ...G.expDevelopment, ...G.expDevDone, ...G.expTest,
  ];
  return allLanes.map(sid => G.stories[sid]).filter(s => s && (s.type === 'f' || s.type === 'e') && s.dueDay === day);
}

function removeOverdueStories(stories) {
  stories.forEach(s => {
    const lane = s.lane;
    if (G[lane]) G[lane] = G[lane].filter(id => id !== s.id);
    if (s.assignedWorkers && s.assignedWorkers.length) {
      s.assignedWorkers.forEach(wid => {
        const w = G.workers.find(w => w.id === wid);
        if (w) w.assigned = null;
      });
      s.assignedWorkers = [];
    }
    if (s.val < 0) G.revenue += s.val;
    s.lane = 'removed';
  });
}

function buildOverdueHtml(stories) {
  if (!stories.length) return '';
  let html = '<hr style="margin:12px 0;border:none;border-top:1px solid #f0ad4e">';
  html += '<p style="color:#c0392b;font-weight:bold">⚠️ Просроченные задачи сняты с доски:</p>';
  stories.forEach(s => {
    const penaltyText = s.val < 0
      ? `штраф <strong>${Math.abs(s.val).toLocaleString('ru-RU')} ₽</strong>`
      : 'бонус потерян';
    html += `<p style="margin:4px 0">${s.id} (Срок: День ${s.dueDay}) — ${penaltyText}</p>`;
  });
  return html;
}

function advanceDay() {
  const completedDay = G.day;
  G.day++;
  G.workDone = false;

  const event = DAY_EVENTS[completedDay];
  const overdue = findOverdueStories(completedDay);

  const continueAfterModal = () => {
    if (event && event.effects.length) applyDayEffects(event.effects);
    if (overdue.length) removeOverdueStories(overdue);

    if (completedDay >= 35) {
      recordChartData();
      render();
      showGameOver();
      // Завершить сессию на сервере
      if (window.GAME_SESSION_ID) {
        API.completeSession(window.GAME_SESSION_ID, G.revenue).catch(e => console.error(e));
      }
      return;
    }

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
    showDayNotify();
    render();
    saveState();
  };

  const eventMsg = event ? event.msg : '';
  const overdueMsg = buildOverdueHtml(overdue);
  const fullMsg = eventMsg + overdueMsg;

  if (fullMsg) {
    showEndOfDayModal(completedDay, fullMsg, continueAfterModal);
  } else {
    continueAfterModal();
  }
}

function applyDayEffects(effects) {
  effects.forEach(eff => {
    switch (eff.type) {
      case 'workerOut': {
        const w = G.workers.find(w => w.type === eff.workerType && w.active);
        if (w) {
          if (w.assigned) {
            const s = G.stories[w.assigned];
            if (s) s.assignedWorkers = s.assignedWorkers.filter(id => id !== w.id);
            w.assigned = null;
          }
          w.active = false;
        }
        break;
      }
      case 'workerIn': {
        const w = G.workers.find(w => w.type === eff.workerType && !w.active);
        if (w) w.active = true;
        break;
      }
      case 'blocker': {
        const laneKey = eff.lane === 'test' ? 'test' : 'development';
        const expLane = eff.lane === 'test' ? 'expTest' : 'expDevelopment';
        const sid = G[laneKey][0] || G[expLane]?.[0];
        if (sid) {
          const total = 5 + Math.floor(Math.random() * 3);
          G.stories[sid].blocker = true;
          G.stories[sid].blockerRemaining = total;
          G.stories[sid].blockerTotal = total;
          toast(`🚫 Серьёзный дефект на истории ${sid}!`);
        }
        break;
      }
      case 'wipChange':
        WIP[eff.lane] = eff.value;
        renderWipHeaders();
        break;
      case 'carlosOn':
        G.carlosPolicy = true;
        toast('⚠️ Политика Карлоса: только тестировщики тестируют!');
        break;
      case 'carlosOff':
        G.carlosPolicy = false;
        toast('✅ Политика Карлоса отменена');
        break;
      case 'lockdownOn':
        G.lockdown = true;
        toast('🔒 Карантин: только специалисты в своей колонке!');
        break;
    }
  });
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
