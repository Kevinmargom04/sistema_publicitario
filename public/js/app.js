// ══════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════
let medios = [
  { n:'TV Abierta',  inv:0, cpr:29000,   am:97, v:190 },
  { n:'TV Local',    inv:0, cpr:22000,   am:40, v:300 },
  { n:'TV Paga',     inv:0, cpr:23000,   am:45, v:300 },
  { n:'Internet',    inv:0, cpr:24359,   am:90, v:280 },
  { n:'OOH',         inv:0, cpr:33233,   am:36, v:300 },
  { n:'Cine',        inv:0, cpr:251000,  am:5,  v:350 },
  { n:'Radio',       inv:0, cpr:119000,  am:28, v:250 },
  { n:'Prensa',      inv:0, cpr:78321,   am:18, v:250 },
  { n:'Revistas',    inv:0, cpr:115937,  am:20, v:250 },
  { n:'Redes',       inv:0, cpr:25000,   am:70, v:150 },
  { n:'CTV',         inv:0, cpr:13043,   am:30, v:200 },
  { n:'Programatic', inv:0, cpr:20000,   am:55, v:200 }
];

const COLORS = [
  '#2471A3','#1E8449','#48C9B0','#7D3C98','#CA6F1E',
  '#C0392B','#D4AC0D','#717D7E','#27AE60','#1A5276',
  '#117864','#F39C12'
];

let scenarios = [];
let globalCalc = { tInv:0, tTRP:0, tAlc:0, freq:0, rs:[] };

// ══════════════════════════════════════════════════════════════
// FORMULAS
// ══════════════════════════════════════════════════════════════
function calcReach(trp, am, v) {
  if (!trp || trp <= 0 || !am || !v) return 0;
  return am * (1 - Math.exp(-trp / (2 * v)));
}

function calcTotalReach(reaches) {
  let f = 1;
  reaches.forEach(r => f *= (1 - r / 100));
  return (1 - f) * 100;
}

function calcIncrementalReach(reaches) {
  const total = calcTotalReach(reaches);
  return reaches.map((_, i) => {
    const without = reaches.filter((_, j) => j !== i);
    return total - calcTotalReach(without);
  });
}

function calcSaturation(m) {
  if (!m.am || m.am === 0) return 0;
  return (m.reach / m.am) * 100;
}

// ══════════════════════════════════════════════════════════════
// CALC ENGINE
// ══════════════════════════════════════════════════════════════
function recalc() {
  const tInv = medios.reduce((s, m) => s + (m.inv || 0), 0);

  medios.forEach(m => {
    m.trp   = (m.cpr > 0 && m.inv > 0) ? m.inv / m.cpr : 0;
    m.soi   = tInv > 0 ? (m.inv / tInv * 100) : 0;
    m.reach = calcReach(m.trp, m.am, m.v);
    m.sat   = calcSaturation(m);
  });

  const reaches   = medios.map(m => m.reach);
  const increms   = calcIncrementalReach(reaches);
  medios.forEach((m, i) => m.incr = increms[i]);

  const tTRP  = medios.reduce((s, m) => s + m.trp, 0);
  const tAlc  = calcTotalReach(reaches);
  const freq  = tAlc > 0.01 ? tTRP / tAlc : 0;
  const tIncr = medios.reduce((s, m) => s + m.incr, 0);
  const activos = medios.filter(m => m.inv > 0).length;

  globalCalc = { tInv, tTRP, tAlc, freq, tIncr, activos, rs: medios.map(m=>({...m})) };

  updateTable(tInv, tTRP, tAlc, tIncr, activos);
  updateKPIs(tInv, tTRP, tAlc, freq, activos);
  updateCampaignTab(tInv, tTRP, tAlc, freq);
  updateCharts(tInv);
  updateExportPreview();
}

// ══════════════════════════════════════════════════════════════
// TABLE
// ══════════════════════════════════════════════════════════════
function buildTable() {
  const tbody = document.getElementById('tabla-body');
  tbody.innerHTML = '';
  medios.forEach((m, i) => {
    const tr = document.createElement('tr');
    tr.id = 'row-' + i;
    tr.innerHTML = `
      <td style="padding:3px 9px;min-width:110px">
        <div style="display:flex;align-items:center;gap:0">
          <span class="dot" style="background:${COLORS[i % COLORS.length]}"></span>
          <input class="ci-text" id="nm-${i}" value="${m.n}"
            oninput="medios[${i}].n=this.value; refreshLabels()" aria-label="Nombre del medio ${i+1}">
        </div>
       </td>
      <td style="padding:3px 9px">
        <input type="number" class="ci" id="inv-${i}" value="${m.inv}" min="0" step="100000"
          oninput="medios[${i}].inv=+this.value||0; recalc()" aria-label="Inversión">
       </td>
      <td class="calc" id="soi-${i}">0.0%</td>
      <td style="padding:3px 9px">
        <input type="number" class="ci" id="cpr-${i}" value="${m.cpr}" min="1" step="500"
          oninput="medios[${i}].cpr=+this.value||1; recalc()" aria-label="CPR">
       </td>
      <td style="padding:3px 9px">
        <input type="number" class="ci" id="am-${i}" value="${m.am}" min="0" max="100" step="0.5"
          oninput="medios[${i}].am=+this.value||0; recalc()" aria-label="Alcance máximo">
       </td>
      <td style="padding:3px 9px">
        <input type="number" class="ci" id="vel-${i}" value="${m.v}" min="1" step="10"
          oninput="medios[${i}].v=+this.value||1; recalc()" aria-label="Velocidad">
       </td>
      <td class="calc" id="trp-${i}">0.0</td>
      <td class="calc" id="alc-${i}">0.0%</td>
      <td class="pos" id="incr-${i}" style="font-size:11px">0.0%</td>
      <td id="sat-${i}" style="padding:4px 9px;min-width:90px">
        <div style="display:flex;align-items:center;gap:5px">
          <div class="bar-wrap"><div class="bar-fill" id="satbar-${i}" style="width:0%;background:${COLORS[i%COLORS.length]}"></div></div>
          <span class="calc" id="satpct-${i}" style="font-size:11px">0%</span>
        </div>
      </td>
      <td style="text-align:center;padding:2px 5px">
        <button class="btn btn-danger" style="padding:2px 6px;font-size:10px" onclick="removeMedio(${i})" title="Eliminar medio">×</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateTable(tInv, tTRP, tAlc, tIncr, activos) {
  medios.forEach((m, i) => {
    const s = id => document.getElementById(id + '-' + i);
    if (s('soi'))    s('soi').textContent    = m.soi.toFixed(1) + '%';
    if (s('trp'))    s('trp').textContent    = m.trp.toFixed(1);
    if (s('alc'))    s('alc').textContent    = m.reach.toFixed(1) + '%';
    if (s('incr'))   s('incr').textContent   = '+' + m.incr.toFixed(2) + '%';
    if (s('satpct')) s('satpct').textContent = m.sat.toFixed(0) + '%';
    if (s('satbar')) s('satbar').style.width = Math.min(m.sat, 100).toFixed(1) + '%';
  });
  document.getElementById('tot-inv').textContent  = fmtMXN(tInv);
  document.getElementById('tot-trp').textContent  = tTRP.toFixed(1);
  document.getElementById('tot-alc').textContent  = tAlc.toFixed(1) + '%';
  document.getElementById('tot-incr').textContent = tIncr.toFixed(1) + '%';
}

function addMedio() {
  const idx = medios.length;
  medios.push({ n: 'Nuevo medio ' + (idx+1), inv: 0, cpr: 25000, am: 50, v: 200 });
  buildTable();
  recalc();
  refreshChartLabels();
}

function removeMedio(i) {
  if (medios.length <= 1) return alert('Debe haber al menos un medio.');
  medios.splice(i, 1);
  buildTable();
  recalc();
  refreshChartLabels();
}

// ══════════════════════════════════════════════════════════════
// KPIs
// ══════════════════════════════════════════════════════════════
function updateKPIs(tInv, tTRP, tAlc, freq, activos) {
  document.getElementById('k-inv').textContent    = fmtMXN(tInv);
  document.getElementById('k-trp').textContent    = tTRP.toFixed(1);
  document.getElementById('k-alc').textContent    = tAlc.toFixed(1) + '%';
  document.getElementById('k-frec').textContent   = freq > 0 ? freq.toFixed(2) + 'x' : '—';
  document.getElementById('k-activos').textContent = activos;
  document.getElementById('k-total-medios').textContent = medios.length;
}

// ══════════════════════════════════════════════════════════════
// CAMPAIGN TAB
// ══════════════════════════════════════════════════════════════
function updateCampaignInfo() {
  const name = document.getElementById('camp-nombre').value || '— Sin campaña activa';
  document.getElementById('topbar-campaign').textContent = name ? '— ' + name : '— Sin campaña activa';
}

function updateCampaignTab(tInv, tTRP, tAlc, freq) {
  document.getElementById('cs-inv').textContent  = fmtMXN(tInv);
  document.getElementById('cs-trp').textContent  = tTRP.toFixed(1);
  document.getElementById('cs-alc').textContent  = tAlc.toFixed(1) + '%';
  document.getElementById('cs-frec').textContent = freq > 0 ? freq.toFixed(2) + 'x' : '—';
}

// ══════════════════════════════════════════════════════════════
// SCENARIOS
// ══════════════════════════════════════════════════════════════
function saveScenario() {
  const name = prompt('Nombre para este escenario:', 'Escenario ' + (scenarios.length + 1));
  if (!name) return;
  const sc = {
    id: Date.now(),
    name,
    fecha: new Date().toLocaleDateString('es-MX'),
    medios: medios.map(m => ({...m})),
    kpis: { ...globalCalc }
  };
  scenarios.push(sc);
  renderScenarios();
}

function loadScenario(id) {
  const sc = scenarios.find(s => s.id === id);
  if (!sc) return;
  medios = sc.medios.map(m => ({...m}));
  buildTable();
  recalc();
  refreshChartLabels();
  showTab('dashboard');
}

function duplicateScenario(id) {
  const sc = scenarios.find(s => s.id === id);
  if (!sc) return;
  const name = prompt('Nombre para el duplicado:', sc.name + ' (copia)');
  if (!name) return;
  scenarios.push({ ...sc, id: Date.now(), name, fecha: new Date().toLocaleDateString('es-MX') });
  renderScenarios();
}

function deleteScenario(id) {
  scenarios = scenarios.filter(s => s.id !== id);
  renderScenarios();
}

function clearScenarios() {
  if (!confirm('¿Eliminar todos los escenarios guardados?')) return;
  scenarios = [];
  renderScenarios();
}

function renderScenarios() {
  const list = document.getElementById('scenario-list');
  if (!scenarios.length) {
    list.innerHTML = '<div class="empty-state">No hay escenarios guardados.<br>Configura una simulación y guárdala.</div>';
  } else {
    list.innerHTML = scenarios.map(sc => `
      <div class="scenario-card">
        <div>
          <strong style="font-size:13px">${sc.name}</strong>
          <div class="scenario-meta">${sc.fecha} &nbsp;·&nbsp; ${sc.medios.filter(m=>m.inv>0).length} medios activos &nbsp;·&nbsp; Inv: ${fmtMXN(sc.kpis.tInv)} &nbsp;·&nbsp; Alc: ${sc.kpis.tAlc.toFixed(1)}% &nbsp;·&nbsp; TRP: ${sc.kpis.tTRP.toFixed(1)}</div>
        </div>
        <div class="sc-actions">
          <button class="btn btn-primary" onclick="loadScenario(${sc.id})">Cargar</button>
          <button class="btn btn-outline" onclick="duplicateScenario(${sc.id})">Duplicar</button>
          <button class="btn btn-danger" onclick="deleteScenario(${sc.id})">Eliminar</button>
        </div>
      </div>
    `).join('');
  }

  const ca = document.getElementById('compare-area');
  if (scenarios.length < 2) {
    ca.innerHTML = '<div class="empty-state">Guarda al menos 2 escenarios para comparar.</div>';
    return;
  }
  const cols = scenarios.map(sc => `<th style="min-width:110px">${sc.name}</th>`).join('');
  const rowData = (label, fn) =>
    `<tr><td style="text-align:left;font-weight:bold;background:#f5f5f5">${label}</td>${scenarios.map(sc => `<td class="calc">${fn(sc)}</td>`).join('')}</tr>`;

  ca.innerHTML = `
    <div class="compare-box">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th style="text-align:left;min-width:140px">Métrica</th>${cols}</tr></thead>
        <tbody>
          ${rowData('Inversión Total',      sc => fmtMXN(sc.kpis.tInv))}
          ${rowData('TRP Total',            sc => sc.kpis.tTRP.toFixed(1))}
          ${rowData('Alcance Total (%)',    sc => sc.kpis.tAlc.toFixed(2) + '%')}
          ${rowData('Frecuencia Prom.',     sc => sc.kpis.freq > 0 ? sc.kpis.freq.toFixed(2) + 'x' : '—')}
          ${rowData('Medios Activos',       sc => sc.medios.filter(m=>m.inv>0).length)}
          ${rowData('Alcance Incremental', sc => sc.kpis.tIncr ? sc.kpis.tIncr.toFixed(2)+'%' : '—')}
        </tbody>
      </table>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════════════════════
let cBar, cDonut, cIncr, cLine, cSat, cScatter;
const TRP_PTS = Array.from({length:61}, (_,i) => i * 10);

const chartDefaults = {
  gridColor: 'rgba(0,0,0,0.06)',
  labelColor: '#999',
  tick: { color: '#999', font: { size: 10 } }
};

function initCharts() {
  const { gridColor, labelColor, tick } = chartDefaults;

  cBar = new Chart(document.getElementById('cBar'), {
    type: 'bar',
    data: { labels: medios.map(m=>m.n), datasets: [{ label:'Alcance %', data: medios.map(()=>0), backgroundColor: COLORS, borderRadius: 3, borderSkipped: false }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>' Alcance: '+c.raw.toFixed(2)+'%'}} },
      scales: {
        x: { ticks:{...tick,maxRotation:40}, grid:{display:false} },
        y: { ticks:{...tick,callback:v=>v+'%'}, grid:{color:gridColor}, min:0, max:100 }
      }
    }
  });

  cDonut = new Chart(document.getElementById('cDonut'), {
    type: 'doughnut',
    data: { labels: medios.map(m=>m.n), datasets: [{ data: medios.map(()=>0), backgroundColor: COLORS, borderWidth: 1, borderColor: '#fff' }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + c.raw.toFixed(1) + '%' } }
      }
    }
  });
  buildDonutLegend();

  cIncr = new Chart(document.getElementById('cIncr'), {
    type: 'bar',
    data: { labels: medios.map(m=>m.n), datasets: [{ label:'Alc. incremental %', data: medios.map(()=>0), backgroundColor: COLORS, borderRadius: 3, borderSkipped: false }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>' +'+c.raw.toFixed(3)+'%'}} },
      scales: {
        x: { ticks:{...tick,maxRotation:40}, grid:{display:false} },
        y: { ticks:{...tick,callback:v=>v+'%'}, grid:{color:gridColor}, min:0 }
      }
    }
  });

  const lineDS = medios.map((m,i)=>({
    label: m.n, data: TRP_PTS.map(t => parseFloat(calcReach(t,m.am,m.v).toFixed(2))),
    borderColor: COLORS[i], backgroundColor:'transparent', borderWidth:1.5, pointRadius:0, tension:0.3
  }));
  lineDS.push({
    label: 'TOTAL', data: TRP_PTS.map(t => {
      const tInv = medios.reduce((s,m)=>s+m.inv,0);
      let f=1; medios.forEach(m=>{ const soi=tInv>0?m.inv/tInv:1/medios.length; f*=(1-calcReach(t*soi,m.am,m.v)/100); });
      return parseFloat(((1-f)*100).toFixed(2));
    }),
    borderColor:'#111', backgroundColor:'transparent', borderWidth:2.5, pointRadius:0, tension:0.3, borderDash:[5,3]
  });

  cLine = new Chart(document.getElementById('cLine'), {
    type:'line', data:{ labels:TRP_PTS, datasets:lineDS },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ mode:'index', intersect:false, callbacks:{
        title:c=>'TRP: '+c[0].label, label:c=>' '+c.dataset.label+': '+c.raw.toFixed(1)+'%'
      }}},
      scales:{
        x:{ title:{display:true,text:'TRP',font:{size:10},color:labelColor}, ticks:{...tick,autoSkip:true,maxTicksLimit:10}, grid:{display:false} },
        y:{ title:{display:true,text:'Alcance (%)',font:{size:10},color:labelColor}, ticks:{...tick,callback:v=>v+'%'}, grid:{color:gridColor}, min:0, max:100 }
      },
      interaction:{mode:'nearest',axis:'x',intersect:false}
    }
  });
  buildCurveLegend();

  cSat = new Chart(document.getElementById('cSat'), {
    type:'bar',
    data:{ labels:medios.map(m=>m.n), datasets:[{ label:'Saturación %', data:medios.map(()=>0), backgroundColor:COLORS.map(c=>c+'99'), borderColor:COLORS, borderWidth:1, borderRadius:3, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>' Saturación: '+c.raw.toFixed(1)+'%'}} },
      scales:{
        x:{ ticks:{...tick,maxRotation:40}, grid:{display:false} },
        y:{ ticks:{...tick,callback:v=>v+'%'}, grid:{color:gridColor}, min:0, max:100,
          title:{display:true,text:'% del potencial máximo usado',font:{size:10},color:labelColor} }
      }
    }
  });

  cScatter = new Chart(document.getElementById('cScatter'), {
    type:'bubble',
    data:{ datasets: medios.map((m,i)=>({ label:m.n, data:[{x:0,y:0,r:5}], backgroundColor:COLORS[i]+'cc', borderColor:COLORS[i] })) },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{ label:c=>` ${c.dataset.label}: TRP=${c.raw.x.toFixed(1)}, Alcance=${c.raw.y.toFixed(1)}%` }} },
      scales:{
        x:{ title:{display:true,text:'TRP invertido',font:{size:10},color:labelColor}, ticks:{...tick}, grid:{color:gridColor} },
        y:{ title:{display:true,text:'Alcance (%)',font:{size:10},color:labelColor}, ticks:{...tick,callback:v=>v+'%'}, grid:{color:gridColor}, min:0, max:100 }
      }
    }
  });
}

function buildDonutLegend() {
  const el = document.getElementById('donut-legend');
  el.innerHTML = '';
  medios.forEach((m,i)=>{
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="dot" style="background:${COLORS[i%COLORS.length]}"></span><span id="dl-${i}">${m.n}</span>`;
    el.appendChild(item);
  });
}

function buildCurveLegend() {
  const el = document.getElementById('curve-legend');
  el.innerHTML = '';
  [...medios.map((m,i)=>({n:m.n,c:COLORS[i%COLORS.length]})), {n:'TOTAL',c:'#111'}].forEach((item,i)=>{
    const isTotal = i === medios.length;
    const span = document.createElement('span');
    span.className = 'legend-item';
    span.innerHTML = `<span class="legend-line" style="background:${item.c};${isTotal?'border-bottom:2px dashed #111;background:transparent':''}"></span>${item.n}`;
    span.onclick = () => {
      if (!cLine) return;
      const ds = cLine.data.datasets[i];
      ds.hidden = !ds.hidden;
      span.style.opacity = ds.hidden ? '0.3' : '1';
      cLine.update();
    };
    el.appendChild(span);
  });
}

function refreshChartLabels() {
  if (cBar)    cBar.data.labels = medios.map(m=>m.n);
  if (cDonut)  cDonut.data.labels = medios.map(m=>m.n);
  if (cIncr)   cIncr.data.labels = medios.map(m=>m.n);
  if (cSat)    cSat.data.labels = medios.map(m=>m.n);
  buildDonutLegend();
  buildCurveLegend();
}

function refreshLabels() {
  medios.forEach((m,i)=>{
    const dl = document.getElementById('dl-'+i);
    if(dl) dl.textContent = m.n;
  });
  if(cBar)   cBar.data.labels[medios.findIndex((m,i)=>document.getElementById('nm-'+i)?.value===m.n)] = '';
  recalc();
}

function updateCharts(tInv) {
  if (!cBar) return;

  cBar.data.labels = medios.map(m=>m.n);
  cBar.data.datasets[0].data = medios.map(m => parseFloat(m.reach.toFixed(2)));
  cBar.update('none');

  cDonut.data.labels = medios.map(m=>m.n);
  cDonut.data.datasets[0].data = medios.map(m => parseFloat(m.soi.toFixed(2)));
  cDonut.update('none');

  cIncr.data.labels = medios.map(m=>m.n);
  cIncr.data.datasets[0].data = medios.map(m => parseFloat(m.incr.toFixed(3)));
  cIncr.update('none');

  medios.forEach((m,i) => {
    if (!cLine.data.datasets[i]) return;
    cLine.data.datasets[i].label = m.n;
    cLine.data.datasets[i].data = TRP_PTS.map(t => parseFloat(calcReach(t,m.am,m.v).toFixed(2)));
  });
  const totalIdx = medios.length;
  if (cLine.data.datasets[totalIdx]) {
    cLine.data.datasets[totalIdx].data = TRP_PTS.map(t => {
      let f=1;
      medios.forEach(m => {
        const soi = tInv > 0 ? m.inv/tInv : 1/medios.length;
        f *= (1 - calcReach(t*soi, m.am, m.v)/100);
      });
      return parseFloat(((1-f)*100).toFixed(2));
    });
  }
  cLine.update('none');

  cSat.data.labels = medios.map(m=>m.n);
  cSat.data.datasets[0].data = medios.map(m => parseFloat(m.sat.toFixed(1)));
  cSat.update('none');

  medios.forEach((m,i) => {
    if (!cScatter.data.datasets[i]) return;
    cScatter.data.datasets[i].label = m.n;
    cScatter.data.datasets[i].data = m.trp > 0
      ? [{ x: parseFloat(m.trp.toFixed(1)), y: parseFloat(m.reach.toFixed(1)), r: 6 }]
      : [{ x:0, y:0, r:0 }];
  });
  cScatter.update('none');
}

// ══════════════════════════════════════════════════════════════
// EXPORT PDF
// ══════════════════════════════════════════════════════════════
function exportPDF() {
  const titulo = document.getElementById('exp-titulo').value || 'Reporte de Planeación de Medios';
  const fecha  = document.getElementById('exp-fecha').value || new Date().toLocaleDateString('es-MX');
  const { tInv, tTRP, tAlc, freq } = globalCalc;

  const rows = medios.map(m => `
    <tr>
      <td>${m.n}</td>
      <td>${fmtMXN(m.inv)}</td>
      <td>${m.soi.toFixed(1)}%</td>
      <td>$${m.cpr.toLocaleString()}</td>
      <td>${m.am}%</td>
      <td>${m.v}</td>
      <td>${m.trp.toFixed(1)}</td>
      <td>${m.reach.toFixed(2)}%</td>
      <td>+${m.incr.toFixed(2)}%</td>
      <td>${m.sat.toFixed(0)}%</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 30px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #888; margin-bottom: 20px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 20px; }
    .kpi { border: 1px solid #ddd; padding: 10px 14px; flex: 1; }
    .kl { font-size: 9px; text-transform: uppercase; color: #999; margin-bottom: 3px; }
    .kv { font-size: 18px; font-weight: bold; font-family: monospace; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th { background: #f0f0f0; text-align: right; padding: 5px 8px; border: 1px solid #ccc; font-size: 10px; }
    th:first-child { text-align: left; }
    td { padding: 4px 8px; border: 1px solid #eee; text-align: right; }
    td:first-child { text-align: left; }
    tfoot td { background: #eee; font-weight: bold; border-top: 2px solid #ccc; }
    @media print { body { margin: 15px; } }
  </style></head><body>
  <h1>${titulo}</h1>
  <div class="meta">Generado el ${fecha} &nbsp;|&nbsp; Budget Allocator — Planeador de Inversión Publicitaria</div>
  <div class="kpis">
    <div class="kpi"><div class="kl">Inversión Total</div><div class="kv">${fmtMXN(tInv)}</div></div>
    <div class="kpi"><div class="kl">TRP Total</div><div class="kv">${tTRP.toFixed(1)}</div></div>
    <div class="kpi"><div class="kl">Alcance Total</div><div class="kv">${tAlc.toFixed(1)}%</div></div>
    <div class="kpi"><div class="kl">Frecuencia Prom.</div><div class="kv">${freq > 0 ? freq.toFixed(2)+'x' : '—'}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Medio</th><th>Inversión</th><th>SOI %</th><th>CPR</th>
      <th>Alc. Máx</th><th>Velocidad</th><th>TRP</th><th>Alcance %</th>
      <th>Alc. Increm.</th><th>Saturación</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td>TOTAL</td><td>${fmtMXN(tInv)}</td><td>100%</td>
      <td>—</td><td>—</td><td>—</td>
      <td>${tTRP.toFixed(1)}</td><td>${tAlc.toFixed(1)}%</td>
      <td>${globalCalc.tIncr?.toFixed(1)??'—'}%</td><td>—</td>
    </tr></tfoot>
  </table>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  win.document.close();
}

function updateExportPreview() {
  const { tInv, tTRP, tAlc, freq } = globalCalc;
  const activos = medios.filter(m=>m.inv>0);
  document.getElementById('preview-data').innerHTML = `
    <strong>Medios con inversión:</strong> ${activos.length > 0 ? activos.map(m=>m.n).join(', ') : 'Ninguno'}<br>
    <strong>Inversión Total:</strong> ${fmtMXN(tInv)}<br>
    <strong>TRP Total:</strong> ${tTRP.toFixed(1)}<br>
    <strong>Alcance Total:</strong> ${tAlc.toFixed(1)}%<br>
    <strong>Frecuencia:</strong> ${freq > 0 ? freq.toFixed(2)+'x' : '—'}
  `;
  document.getElementById('exp-fecha').value = new Date().toLocaleDateString('es-MX');
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
function showTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => {
    const tabs = ['dashboard','campana','escenarios','exportar'];
    t.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'escenarios') renderScenarios();
  if (name === 'exportar')   updateExportPreview();
}

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
function fmtMXN(n) {
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'k';
  return '$' + Math.round(n);
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
buildTable();
initCharts();
recalc();