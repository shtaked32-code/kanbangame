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
  document.getElementById('db-rev').textContent = `Дневная выручка: $${G.dailyRev.toLocaleString()}  |  Итого: $${G.revenue.toLocaleString()}`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 1500);
}

function showHelp() { document.getElementById('help-overlay').style.display = 'flex'; }
function hideHelp() { document.getElementById('help-overlay').style.display = 'none'; }

function confirmExit() {
  if (confirm('Выйти из игры? Весь прогресс будет потерян.')) newGame();
}

function hideGameOver() { document.getElementById('game-over').style.display = 'none'; }
function showGameOver() {
  const deployed = [...G.deployed, ...G.expDeployed].map(sid => G.stories[sid]);
  const stdRev = deployed.filter(s => s.type === 's').reduce((sum, s) => sum + s.val * (35 - (s.deployedDay||35) + 1), 0);

  document.getElementById('go-score').textContent = `$${G.revenue.toLocaleString()}`;
  document.getElementById('go-table').innerHTML = `
    <tr><td>Историй выпущено</td><td>${deployed.length}</td></tr>
    <tr><td>Стандартных историй</td><td>${deployed.filter(s=>s.type==='s').length}</td></tr>
    <tr><td>Сыграно дней</td><td>35</td></tr>
    <tr><td>Итоговая выручка</td><td>$${G.revenue.toLocaleString()}</td></tr>
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
  if (data.length === 0) { ctx.fillText('Данных пока нет', 10, 30); return; }
  const W = canvas.width - 60, H = canvas.height - 50, OX = 50, OY = 10;
  const maxVal = Math.max(...data.map(d => d.backlog + d.ready + d.analysis + d.dev + d.test + d.deployed));
  const colors = ['#ddd','#fffbcc','#ffd080','#d9534f','#428bca','#5cb85c','#888'];
  const labels = ['Бэклог','Готово к работе','Анализ','Разработка','Тест','Выпущено'];
  const keys   = ['backlog','ready','analysis','dev','test','deployed'];

  data.forEach((d, i) => {
    const x = OX + (i / Math.max(data.length-1, 1)) * W;
    let y = OY + H;
    keys.map(k => d[k]).forEach((v, vi) => {
      const h = (v / maxVal) * H;
      ctx.fillStyle = colors[vi];
      ctx.fillRect(x - (W / Math.max(data.length, 1) / 2), y - h, W / Math.max(data.length, 1), h);
      y -= h;
    });
  });

  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(OX, OY+H); ctx.lineTo(OX+W, OY+H); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = '11px Arial';
  ctx.fillText('День', OX + W/2 - 10, OY + H + 30);
  ctx.save(); ctx.translate(14, OY + H/2); ctx.rotate(-Math.PI/2); ctx.fillText('Истории', -20, 0); ctx.restore();

  labels.forEach((l, i) => {
    ctx.fillStyle = colors[i]; ctx.fillRect(OX + W - 100, OY + i*15, 12, 12);
    ctx.fillStyle = '#333'; ctx.fillText(l, OX + W - 84, OY + i*15 + 10);
  });
}

function renderCycleTime(ctx, canvas) {
  const data = G.ctHistory;
  ctx.fillStyle = '#333'; ctx.font = '12px Arial';
  if (data.length === 0) { ctx.fillText('Историй ещё не выпущено.', 40, 50); return; }
  const W = canvas.width - 80, H = canvas.height - 60, OX = 60, OY = 20;
  const maxDays = Math.max(...data.map(d => d.days), 10);

  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
  for (let y = 0; y <= 5; y++) {
    const yy = OY + H - (y/5)*H;
    ctx.beginPath(); ctx.moveTo(OX, yy); ctx.lineTo(OX+W, yy); ctx.stroke();
    ctx.fillStyle='#999'; ctx.fillText(Math.round(y/5*maxDays), 5, yy+4);
  }

  data.forEach((d, i) => {
    const x = OX + (i / Math.max(data.length-1, 1)) * W;
    const y = OY + H - (d.days / maxDays) * H;
    ctx.fillStyle = '#428bca';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#555'; ctx.font = '8px Arial';
    ctx.fillText(d.id, x-8, y-8);
  });

  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(OX, OY+H); ctx.lineTo(OX+W, OY+H); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = '11px Arial';
  ctx.fillText('Выпущенные истории (по порядку)', OX + W/2 - 70, OY + H + 30);
  ctx.save(); ctx.translate(14, OY + H/2); ctx.rotate(-Math.PI/2); ctx.fillText('Время цикла (дни)', -40, 0); ctx.restore();
}

function renderFinancial(ctx, canvas) {
  const data = G.revHistory;
  ctx.fillStyle = '#333'; ctx.font = '12px Arial';
  if (data.length === 0) { ctx.fillText('Данных пока нет.', 40, 50); return; }
  const W = canvas.width - 80, H = canvas.height - 60, OX = 60, OY = 20;
  const maxRev = Math.max(...data.map(d => d.cumRev), 1000);

  for (let y = 0; y <= 5; y++) {
    const yy = OY + H - (y/5)*H;
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(OX, yy); ctx.lineTo(OX+W, yy); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = '10px Arial';
    ctx.fillText('$'+Math.round(y/5*maxRev/1000)+'k', 2, yy+4);
  }

  ctx.beginPath(); ctx.moveTo(OX, OY+H);
  data.forEach((d, i) => {
    const x = OX + (i / Math.max(data.length-1, 1)) * W;
    const y = OY + H - (d.cumRev / maxRev) * H;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(OX + W, OY+H); ctx.closePath();
  ctx.fillStyle = 'rgba(92,184,92,0.3)'; ctx.fill();
  ctx.strokeStyle = '#5cb85c'; ctx.lineWidth = 2; ctx.stroke();

  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(OX, OY+H); ctx.lineTo(OX+W, OY+H); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = '11px Arial';
  ctx.fillText('День', OX + W/2 - 10, OY + H + 30);
  ctx.save(); ctx.translate(14, OY + H/2); ctx.rotate(-Math.PI/2); ctx.fillText('Накопленная выручка', -50, 0); ctx.restore();
}
