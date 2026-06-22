// ===================================================
//  UI HELPERS
// ===================================================
function showWorkLog(lines) {
  const el = document.getElementById('work-log');
  el.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  el.style.display = 'block';
}

function hideWorkLog() {
  document.getElementById('work-log').style.display = 'none';
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showDayNotify() {
  const el = document.getElementById('day-notify');
  document.getElementById('db-day').textContent = `День ${G.day}`;
  document.getElementById('db-rev').textContent = `Дневная выручка: ${G.dailyRev.toLocaleString('ru-RU')} ₽  |  Итого: ${G.revenue.toLocaleString('ru-RU')} ₽`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 1500);
}

function showHelp() { document.getElementById('help-overlay').style.display = 'flex'; }
function hideHelp() { document.getElementById('help-overlay').style.display = 'none'; }

let _eodCallback = null;
function showEndOfDayModal(day, msg, callback) {
  _eodCallback = callback;
  document.getElementById('eod-day').textContent = `Конец Дня ${day}`;
  document.getElementById('eod-body').innerHTML = msg;
  document.getElementById('eod-overlay').style.display = 'flex';
}
function hideEndOfDayModal() {
  document.getElementById('eod-overlay').style.display = 'none';
  const cb = _eodCallback;
  _eodCallback = null;
  if (cb) cb();
}

async function confirmExit() {
  if (confirm('Выйти из игры? Прогресс сохранён и доступен в личном кабинете.')) {
    await saveState();
    window.location.href = 'dashboard.html';
  }
}

function hideGameOver() { document.getElementById('game-over').style.display = 'none'; }
function showGameOver() {
  const deployed = [...G.deployed, ...G.expDeployed].map(sid => G.stories[sid]);
  const byType = t => deployed.filter(s => s.type === t).length;
  const fmt = n => n.toLocaleString('ru-RU');

  document.getElementById('go-score').textContent = `${fmt(G.revenue)} ₽`;
  document.getElementById('go-table').innerHTML = `
    <tr><td>Сыграно дней</td><td>35</td></tr>
    <tr><td>Всего выпущено</td><td>${deployed.length}</td></tr>
    <tr><td><span class="badge badge-s">S</span> Стандартных</td><td>${byType('s')}</td></tr>
    <tr><td><span class="badge badge-f">F</span> Фиксированная дата</td><td>${byType('f')}</td></tr>
    <tr><td><span class="badge badge-i">I</span> Нематериальных</td><td>${byType('i')}</td></tr>
    <tr><td><span class="badge badge-e">E</span> Срочных</td><td>${byType('e')}</td></tr>
    <tr><td>Итоговая выручка</td><td>${fmt(G.revenue)} ₽</td></tr>
  `;
  document.getElementById('game-over').style.display = 'flex';
}

// ===================================================
//  CHARTS
// ===================================================
function showCharts(type) {
  currentChart = type || currentChart;
  ['cfd','ct','fin'].forEach(t => {
    document.getElementById('tab-' + t).className = 'chart-tab' + (t === currentChart ? ' active' : '');
  });
  document.getElementById('charts-overlay').style.display = 'flex';
  renderChart(currentChart);
}

function hideCharts() { document.getElementById('charts-overlay').style.display = 'none'; }

function renderChart(type) {
  const canvas = document.getElementById('chart-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (type === 'cfd')      renderCFD(ctx, canvas);
  else if (type === 'ct')  renderCycleTime(ctx, canvas);
  else if (type === 'fin') renderFinancial(ctx, canvas);
}

function renderCFD(ctx, canvas) {
  const data = G.cfdHistory;
  if (!data.length) { ctx.fillStyle='#333'; ctx.font='12px Arial'; ctx.fillText('Данных пока нет', 10, 30); return; }

  const OX = 55, OY = 15;
  const W = canvas.width - OX - 20;
  const H = canvas.height - OY - 48; // 48px снизу: метки X + подпись оси

  // 6 слоёв снизу вверх; analysis и dev — суммируют подзоны
  const layers = ['deployed','test','dev','analysis','ready','backlog'];
  const fillColors = [
    'rgba(39,174,96,0.85)',   // deployed
    'rgba(46,204,113,0.50)',  // test
    'rgba(52,152,219,0.65)',  // dev
    'rgba(231,76,60,0.60)',   // analysis
    'rgba(189,195,199,0.70)', // ready
    'rgba(220,220,220,0.50)', // backlog
  ];
  const lineColors = ['#27ae60','#2ecc71','#3498db','#e74c3c','#95a5a6','#bbb'];

  // Объединяем подзоны и обеспечиваем обратную совместимость
  const nd = data.map(d => ({
    ...d,
    dev:      (d.dev      || 0) + (d.devDone      || 0),
    analysis: (d.analysis || 0) + (d.analysisDone || 0),
  }));

  const cumTop = (d, li) => layers.slice(0, li+1).reduce((s,k) => s + (d[k] || 0), 0);
  const maxVal = Math.max(...nd.map(d => cumTop(d, layers.length-1)), 1);
  const step   = maxVal <= 20 ? 5 : maxVal <= 60 ? 10 : 15;
  const gridMax = Math.ceil(maxVal / step) * step || step;

  const xFor = i => OX + (i / Math.max(nd.length-1, 1)) * W;
  const yFor = v => OY + H - (v / gridMax) * H;

  // Подпись оси Y (повёрнуто)
  ctx.save();
  ctx.translate(11, OY + H/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle='#999'; ctx.font='11px Arial'; ctx.textAlign='center';
  ctx.fillText('Историй', 0, 0);
  ctx.restore();

  // Сетка и метки Y
  ctx.lineWidth=0.5; ctx.font='11px Arial'; ctx.textAlign='right';
  for (let g=0; g<=gridMax; g+=step) {
    const yy = yFor(g);
    ctx.strokeStyle='#e8e8e8';
    ctx.beginPath(); ctx.moveTo(OX, yy); ctx.lineTo(OX+W, yy); ctx.stroke();
    ctx.fillStyle='#999'; ctx.fillText(g, OX-5, yy+4);
  }

  // Метки и вертикальные линии X
  ctx.textAlign='center';
  nd.forEach((d,i) => {
    if (i===0 || d.day%5===0 || i===nd.length-1) {
      const xx = xFor(i);
      ctx.strokeStyle='#e8e8e8';
      ctx.beginPath(); ctx.moveTo(xx, OY); ctx.lineTo(xx, OY+H); ctx.stroke();
      ctx.fillStyle='#999'; ctx.font='11px Arial'; ctx.fillText(d.day, xx, OY+H+14);
    }
  });

  // Подпись оси X
  ctx.fillStyle='#999'; ctx.font='11px Arial'; ctx.textAlign='center';
  ctx.fillText('День', OX+W/2, OY+H+30);

  // Закрашенные зоны (без точек)
  for (let li=layers.length-1; li>=0; li--) {
    ctx.beginPath();
    nd.forEach((d,i) => {
      const x=xFor(i), y=yFor(cumTop(d,li));
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    for (let i=nd.length-1; i>=0; i--)
      ctx.lineTo(xFor(i), yFor(li>0 ? cumTop(nd[i],li-1) : 0));
    ctx.closePath();
    ctx.fillStyle=fillColors[li]; ctx.fill();

    ctx.beginPath();
    nd.forEach((d,i) => {
      const x=xFor(i), y=yFor(cumTop(d,li));
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle=lineColors[li]; ctx.lineWidth=1.2; ctx.stroke();
  }

  // Оси
  ctx.strokeStyle='#bbb'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(OX,OY); ctx.lineTo(OX,OY+H); ctx.lineTo(OX+W,OY+H); ctx.stroke();

  // Легенда слева (сверху вниз, порядок как на диаграмме: бэклог → выпущено)
  const legendItems = [
    ['Бэклог',          5],
    ['Готово к работе', 4],
    ['Анализ',          3],
    ['Разработка',      2],
    ['Тест',            1],
    ['Выпущено',        0],
  ];
  legendItems.forEach(([label, li], idx) => {
    const lx = OX + 8, ly = OY + 8 + idx * 18;
    ctx.fillStyle=fillColors[li]; ctx.fillRect(lx, ly, 12, 11);
    ctx.strokeStyle=lineColors[li]; ctx.lineWidth=1; ctx.strokeRect(lx, ly, 12, 11);
    ctx.fillStyle='#444'; ctx.font='11px Arial'; ctx.textAlign='left';
    ctx.fillText(label, lx+15, ly+9);
  });
}

function renderCycleTime(ctx, canvas) {
  const data = G.ctHistory;
  ctx.fillStyle='#333'; ctx.font='12px Arial'; ctx.textAlign='left';
  if (!data.length) { ctx.fillText('Историй ещё не выпущено.', 40, 50); return; }
  const W = canvas.width - 80, H = canvas.height - 60, OX = 55, OY = 15;

  const maxCT = Math.max(...data.map(d=>d.days), 5);
  const gridMax = Math.ceil(maxCT) + 1;

  ctx.strokeStyle='#eee'; ctx.lineWidth=0.5; ctx.textAlign='right';
  for (let g=0; g<=gridMax; g++) {
    const yy = OY + H - (g/gridMax)*H;
    ctx.beginPath(); ctx.moveTo(OX,yy); ctx.lineTo(OX+W,yy); ctx.stroke();
    ctx.fillStyle='#666'; ctx.font='11px Arial'; ctx.fillText(g, OX-5, yy+4);
  }

  const byDay = {};
  data.forEach(d => { const day=d.deployedDay||0; if(!byDay[day])byDay[day]=[]; byDay[day].push(d.days); });
  const days = Object.keys(byDay).map(Number).sort((a,b)=>a-b);
  const n = days.length;
  const slotW = W / Math.max(n, 1);
  const barW = Math.min(slotW * 0.35, 22);

  days.forEach((day, di) => {
    const bars = byDay[day];
    const cx = OX + (di + 0.5) * slotW;
    const totalBarW = bars.length * barW + (bars.length-1) * 2;
    bars.forEach((ct, bi) => {
      const x = cx - totalBarW/2 + bi*(barW+2);
      const barH = (ct/gridMax)*H;
      const y = OY + H - barH;
      ctx.fillStyle='#bbb'; ctx.fillRect(x, y, barW, barH);
      ctx.strokeStyle='#888'; ctx.lineWidth=0.5; ctx.strokeRect(x, y, barW, barH);
    });
    ctx.fillStyle='#555'; ctx.font='11px Arial'; ctx.textAlign='center';
    ctx.fillText(day, cx, OY+H+14);
  });

  ctx.strokeStyle='#888'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(OX,OY); ctx.lineTo(OX,OY+H); ctx.lineTo(OX+W,OY+H); ctx.stroke();
}

function renderFinancial(ctx, canvas) {
  const data = G.revHistory;
  ctx.fillStyle='#333'; ctx.font='12px Arial'; ctx.textAlign='left';
  if (!data.length) { ctx.fillText('Данных пока нет.', 40, 50); return; }
  const W = canvas.width - 90, H = canvas.height - 60, OX = 80, OY = 15;

  const maxRev = Math.max(...data.map(d=>d.cumRev), 1000);
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxRev)) - 1);
  const gridMax = Math.ceil(maxRev / magnitude / 5) * magnitude * 5;
  const gridStep = gridMax / 5;

  ctx.strokeStyle='#ddd'; ctx.lineWidth=0.5; ctx.textAlign='right';
  for (let g=0; g<=5; g++) {
    const val = g * gridStep;
    const yy = OY + H - (val/gridMax)*H;
    ctx.beginPath(); ctx.moveTo(OX,yy); ctx.lineTo(OX+W,yy); ctx.stroke();
    const label = val >= 1000000 ? (val/1000000).toFixed(1)+'М ₽' : val >= 1000 ? Math.round(val/1000)+'К ₽' : val+'₽';
    ctx.fillStyle='#666'; ctx.font='10px Arial'; ctx.fillText(label, OX-5, yy+4);
  }

  const n = data.length;
  const slotW = W / Math.max(n, 1);
  const barW = Math.max(slotW * 0.7, 4);
  data.forEach((d, i) => {
    const x = OX + i*slotW + (slotW-barW)/2;
    const barH = (d.cumRev/gridMax)*H;
    const y = OY + H - barH;
    ctx.fillStyle='rgba(92,184,92,0.7)'; ctx.fillRect(x, y, barW, barH);
    ctx.strokeStyle='#5cb85c'; ctx.lineWidth=0.5; ctx.strokeRect(x, y, barW, barH);
    if (i===0 || d.day%5===0 || i===n-1) {
      ctx.fillStyle='#555'; ctx.font='11px Arial'; ctx.textAlign='center';
      ctx.fillText(d.day, x+barW/2, OY+H+14);
    }
  });

  ctx.fillStyle='rgba(92,184,92,0.7)'; ctx.fillRect(OX+8, OY+6, 14, 12);
  ctx.strokeStyle='#5cb85c'; ctx.lineWidth=1; ctx.strokeRect(OX+8, OY+6, 14, 12);
  ctx.fillStyle='#333'; ctx.font='11px Arial'; ctx.textAlign='left';
  ctx.fillText('Накопленная выручка', OX+26, OY+16);

  ctx.strokeStyle='#888'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(OX,OY); ctx.lineTo(OX,OY+H); ctx.lineTo(OX+W,OY+H); ctx.stroke();
}
