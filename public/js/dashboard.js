// ── ESTADO GLOBAL ─────────────────────────────────────────────
let medios = []
let scenarios = []
let activeCampaign = null
let saveTimer = null
let allCampaigns = []

const COLORS = [
  '#2471A3','#1E8449','#48C9B0','#7D3C98','#CA6F1E',
  '#C0392B','#D4AC0D','#717D7E','#27AE60','#1A5276',
  '#117864','#F39C12'
]

// ── API HELPER (redirige a login si 401) ──────────────────────
const API = {
  base: '/api',
  token() { return localStorage.getItem('token') },
  headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token()}`
    }
  },
  async request(method, path, body) {
    const options = { method, headers: this.headers() }
    if (body) options.body = JSON.stringify(body)
    const res = await fetch(this.base + path, options)
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login.html'
      return null
    }
    return res.ok ? res.json() : null
  },
  get(path) { return this.request('GET', path) },
  post(path, body) { return this.request('POST', path, body) },
  put(path, body) { return this.request('PUT', path, body) },
  delete(path) { return this.request('DELETE', path) }
}

// ── FÓRMULAS (VBA exacto) ────────────────────────────────────
function calcReach(trp, am, v) {
  if (!trp || trp <= 0 || !am || !v) return 0
  const ex = Math.exp(trp / v)
  return am * (ex - 1) / (ex + 1)
}
function calcTotalReach(reaches) {
  let p = 1
  reaches.forEach(r => { p *= (1 - r / 100) })
  return (1 - p) * 100
}
function calcIncrementalReach(reaches) {
  const total = calcTotalReach(reaches)
  return reaches.map((_, i) => total - calcTotalReach(reaches.filter((_, j) => j !== i)))
}
function calcSaturation(reach, am) {
  return am > 0 ? (reach / am) * 100 : 0
}
function calcCurvaTotal(trp, alcMax, v) {
  if (!alcMax || alcMax <= 0) return 0
  const ex = Math.exp(trp / v)
  return alcMax * (ex - 1) / (ex + 1)
}
function ajustarVelocidad(trpTotal, alcMax) {
  if (!trpTotal || !alcMax) return 200
  let v = 200
  while (calcCurvaTotal(trpTotal, alcMax, v) < alcMax && v > 10) v -= 10
  return v
}

// ── MOTOR DE CÁLCULO ──────────────────────────────────────────
let globalCalc = { tInv:0, tTRP:0, tAlc:0, freq:0, tIncr:0, activos:0 }

function recalc() {
  const tInv = medios.reduce((s, m) => s + (m.inv || 0), 0)

  medios.forEach(m => {
    m.trp   = m.cpr > 0 && m.inv > 0 ? m.inv / m.cpr : 0
    m.soi   = tInv > 0 ? (m.inv / tInv) * 100 : 0
    m.reach = calcReach(m.trp, m.am, m.v)
    m.sat   = calcSaturation(m.reach, m.am)
  })

  const reaches = medios.map(m => m.reach)
  const increms = calcIncrementalReach(reaches)
  medios.forEach((m, i) => { m.incr = increms[i] })

  const tTRP  = medios.reduce((s, m) => s + m.trp, 0)
  const tAlc  = calcTotalReach(reaches)
  const freq  = tAlc > 0.01 ? tTRP / tAlc : 0
  const tIncr = increms.reduce((s, v) => s + v, 0)
  const activos = medios.filter(m => m.inv > 0).length

  globalCalc = { tInv, tTRP, tAlc, freq, tIncr, activos }

  updateTable()
  updateKPIs()
  updateCampaignTab()
  updateCharts()
  updateExportPreview()
}

// ── TABLA ─────────────────────────────────────────────────────
function buildTable() {
  const tbody = document.getElementById('tabla-body')
  tbody.innerHTML = ''
  medios.forEach((m, i) => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td style="padding:3px 9px;min-width:110px">
        <div style="display:flex;align-items:center">
          <span class="dot" style="background:${COLORS[i % COLORS.length]}"></span>
          <input class="ci-text" id="nm-${i}" value="${esc(m.n)}"
            oninput="medios[${i}].n=this.value; refreshLabels(); scheduleSave(${i})">
        </div>
       </td>
       <td><input type="number" class="ci" id="inv-${i}" value="${m.inv}" min="0" step="100000"
          oninput="medios[${i}].inv=+this.value||0; recalc(); scheduleSave(${i})"></td>
      <td class="calc" id="soi-${i}">0.0%</td>
      <td><input type="number" class="ci" id="cpr-${i}" value="${m.cpr}" min="1" step="500"
          oninput="medios[${i}].cpr=+this.value||1; recalc(); scheduleSave(${i})"></td>
      <td><input type="number" class="ci" id="am-${i}" value="${m.am}" min="0" max="100" step="0.5"
          oninput="medios[${i}].am=+this.value||0; recalc(); scheduleSave(${i})"></td>
      <td><input type="number" class="ci" id="vel-${i}" value="${m.v}" min="1" step="10"
          oninput="medios[${i}].v=+this.value||1; recalc(); scheduleSave(${i})"></td>
      <td class="calc" id="trp-${i}">0.0</td>
      <td class="calc" id="alc-${i}">0.0%</td>
      <td class="pos" id="incr-${i}" style="font-size:11px">0.0%</td>
      <td style="padding:4px 9px;min-width:90px">
        <div class="bar-wrap"><div class="bar-fill" id="satbar-${i}" style="width:0%;background:${COLORS[i%COLORS.length]}"></div></div>
        <span class="calc" id="satpct-${i}" style="font-size:11px">0%</span>
      </td>
      <td style="text-align:center;padding:2px 5px">
        <button class="btn btn-danger" style="padding:2px 6px;font-size:10px" onclick="removeMedio(${i})">×</button>
      </td>`
    tbody.appendChild(tr)
  })
}

function updateTable() {
  medios.forEach((m, i) => {
    const el = id => document.getElementById(id + '-' + i)
    if (el('soi'))    el('soi').textContent    = m.soi.toFixed(1) + '%'
    if (el('trp'))    el('trp').textContent    = m.trp.toFixed(1)
    if (el('alc'))    el('alc').textContent    = m.reach.toFixed(1) + '%'
    if (el('incr'))   el('incr').textContent   = '+' + m.incr.toFixed(2) + '%'
    if (el('satpct')) el('satpct').textContent = m.sat.toFixed(0) + '%'
    if (el('satbar')) el('satbar').style.width = Math.min(m.sat, 100).toFixed(1) + '%'
  })
  const { tInv, tTRP, tAlc, tIncr } = globalCalc
  document.getElementById('tot-inv').textContent  = fmtMXN(tInv)
  document.getElementById('tot-trp').textContent  = tTRP.toFixed(1)
  document.getElementById('tot-alc').textContent  = tAlc.toFixed(1) + '%'
  document.getElementById('tot-incr').textContent = tIncr.toFixed(1) + '%'
}

function scheduleSave(idx) {
  if (!activeCampaign || !medios[idx]?.id) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const m = medios[idx]
    await API.put(`/campaigns/media/${m.id}`, {
      investment: m.inv, cpr: m.cpr, am: m.am, v: m.v, customName: m.n
    })
  }, 800)
}

async function addMedio() {
  if (!activeCampaign) {
    alert("Selecciona una campaña primero")
    return
  }
  const name = prompt("Nombre del nuevo medio:", "Nuevo medio")
  if (!name) return

  const newMedium = await API.post(`/campaigns/${activeCampaign.id}/media`, {
    name: name,
    cpr: 25000,
    am: 50,
    v: 200,
  })
  if (newMedium && newMedium.id) {
    // Agregar al array local
    medios.push({
      id: newMedium.id,
      n: newMedium.customName,
      inv: newMedium.investment,
      cpr: newMedium.cpr,
      am: newMedium.am,
      v: newMedium.v,
    })
    buildTable()
    rebuildLineChart()
    recalc()
  } else {
    alert("Error al agregar medio")
  }
}

async function removeMedio(index) {
  if (!activeCampaign) {
    alert("Selecciona una campaña primero")
    return
  }
  const medio = medios[index]
  if (!medio || !medio.id) return

  if (!confirm(`¿Eliminar el medio "${medio.n}"?`)) return

  const result = await API.delete(`/campaigns/media/${medio.id}`)
  if (result) {
    medios.splice(index, 1)
    buildTable()
    rebuildLineChart()
    recalc()
  } else {
    alert("Error al eliminar medio")
  }
}

// ── KPIs ──────────────────────────────────────────────────────
function updateKPIs() {
  const { tInv, tTRP, tAlc, freq, activos } = globalCalc
  document.getElementById('k-inv').textContent     = fmtMXN(tInv)
  document.getElementById('k-trp').textContent     = tTRP.toFixed(1)
  document.getElementById('k-alc').textContent     = tAlc.toFixed(1) + '%'
  document.getElementById('k-frec').textContent    = freq > 0 ? freq.toFixed(2) + 'x' : '—'
  document.getElementById('k-activos').textContent = activos
  document.getElementById('k-total-medios').textContent = medios.length
}

// ── CAMPAÑA ───────────────────────────────────────────────────
function updateCampaignInfo() {
  const name = document.getElementById('camp-nombre').value
  document.getElementById('topbar-campaign').textContent = name ? '— ' + name : '— Sin campaña activa'
}
function updateCampaignTab() {
  const { tInv, tTRP, tAlc, freq } = globalCalc
  document.getElementById('cs-inv').textContent  = fmtMXN(tInv)
  document.getElementById('cs-trp').textContent  = tTRP.toFixed(1)
  document.getElementById('cs-alc').textContent  = tAlc.toFixed(1) + '%'
  document.getElementById('cs-frec').textContent = freq > 0 ? freq.toFixed(2) + 'x' : '—'
}
async function saveCampaignInfo() {
  if (!activeCampaign) return
  await API.put(`/campaigns/${activeCampaign.id}`, {
    name: document.getElementById('camp-nombre').value,
    client: document.getElementById('camp-cliente').value,
    budgetTarget: +document.getElementById('camp-budget').value || null,
    period: document.getElementById('camp-periodo').value,
    target: document.getElementById('camp-target').value,
    objectives: document.getElementById('camp-objetivos').value,
  })
  updateCampaignInfo()
}

// ── ESCENARIOS (con API) ──────────────────────────────────────
async function loadScenariosList() {
  if (!activeCampaign) return
  const data = await API.get(`/campaigns/${activeCampaign.id}/scenarios`)
  if (data) scenarios = data
  renderScenarios()
}
async function saveScenario() {
  if (!activeCampaign) { alert("Selecciona una campaña primero"); return }
  const name = prompt("Nombre del escenario:", "Escenario " + (scenarios.length + 1))
  if (!name) return
  const data = await API.post(`/campaigns/${activeCampaign.id}/scenarios`, { name })
  if (data) {
    scenarios.unshift(data)
    renderScenarios()
  } else alert("Error al guardar escenario")
}
async function loadScenario(scId) {
  if (!activeCampaign) return
  const data = await API.post(`/campaigns/${activeCampaign.id}/scenarios/${scId}/load`)
  if (data && data.media) {
    medios = data.media.map(m => ({
      id: m.id, n: m.customName || m.mediumCatalog.name, inv: m.investment,
      cpr: m.cpr, am: m.am, v: m.v
    }))
    buildTable(); rebuildLineChart(); recalc()
    showTab('dashboard')
  } else alert("Error al cargar escenario")
}
async function deleteScenario(scId) {
  if (!activeCampaign || !confirm("¿Eliminar escenario?")) return
  await API.delete(`/campaigns/${activeCampaign.id}/scenarios/${scId}`)
  scenarios = scenarios.filter(s => s.id !== scId)
  renderScenarios()
}
function renderScenarios() {
  const list = document.getElementById('scenario-list')
  if (!scenarios.length) {
    list.innerHTML = '<div class="empty-state">No hay escenarios guardados.<br>Configura una simulación y guárdala.</div>'
  } else {
    list.innerHTML = scenarios.map(sc => {
      const kpis = sc.snapshot?.kpis || {}
      return `
        <div class="scenario-card">
          <div>
            <strong style="font-size:13px">${esc(sc.name)}</strong>
            <div class="scenario-meta">
              ${new Date(sc.createdAt).toLocaleDateString('es-MX')}
              ${kpis.totalInvestment ? ' · Inv: ' + fmtMXN(kpis.totalInvestment) : ''}
              ${kpis.totalReach !== undefined ? ' · Alc: ' + (+kpis.totalReach).toFixed(1) + '%' : ''}
              ${kpis.totalTRP !== undefined ? ' · TRP: ' + (+kpis.totalTRP).toFixed(1) : ''}
            </div>
          </div>
          <div class="sc-actions">
            <button class="btn btn-primary" onclick="loadScenario(${sc.id})">Cargar</button>
            <button class="btn btn-danger" onclick="deleteScenario(${sc.id})">Eliminar</button>
          </div>
        </div>`
    }).join('')
  }

  const ca = document.getElementById('compare-area')
  if (scenarios.length < 2) {
    ca.innerHTML = '<div class="empty-state">Guarda al menos 2 escenarios para comparar.</div>'
    return
  }
  const cols = scenarios.map(sc => `<th style="min-width:110px">${esc(sc.name)}</th>`).join('')
  const row  = (label, fn) =>
    `<tr><td style="text-align:left;font-weight:bold;background:#f5f5f5">${label}</td>${scenarios.map(sc => `<td class="calc">${fn(sc)}</td>`).join('')}</tr>`
  ca.innerHTML = `
    <div class="compare-box">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th style="text-align:left;min-width:140px">Métrica</th>${cols}</tr></thead>
        <tbody>
          ${row('Inversión Total',   sc => fmtMXN(sc.snapshot?.kpis?.totalInvestment || 0))}
          ${row('TRP Total',         sc => (+(sc.snapshot?.kpis?.totalTRP || 0)).toFixed(1))}
          ${row('Alcance Total',     sc => (+(sc.snapshot?.kpis?.totalReach || 0)).toFixed(2) + '%')}
          ${row('Frecuencia Prom.',  sc => { let f = sc.snapshot?.kpis?.frequency || 0; return f > 0 ? (+f).toFixed(2) + 'x' : '—' })}
          ${row('Medios Activos',    sc => sc.snapshot?.kpis?.activeMedia ?? '—')}
          ${row('Alc. Incremental',  sc => { let v = sc.snapshot?.kpis?.totalIncrementalReach; return v !== undefined ? (+v).toFixed(2) + '%' : '—' })}
        </tbody>
      </table>
    </div>`
}

// ── GRÁFICAS ──────────────────────────────────────────────────
let cBar, cDonut, cIncr, cLine, cSat, cScatter
const TRP_PTS  = Array.from({ length: 61 }, (_, i) => i * 10)
const GRID_CLR = 'rgba(0,0,0,0.06)'
const TICK     = { color: '#999', font: { size: 10 } }
const LBL_CLR  = '#999'

function initCharts() {
  cBar = new Chart(document.getElementById('cBar'), {
    type: 'bar',
    data: { labels: medios.map(m=>m.n), datasets: [{ label:'Alcance %', data: medios.map(()=>0), backgroundColor: COLORS, borderRadius: 3, borderSkipped: false }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>' Alcance: '+c.raw.toFixed(2)+'%'}} },
      scales: { x:{ticks:{...TICK,maxRotation:40},grid:{display:false}}, y:{ticks:{...TICK,callback:v=>v+'%'},grid:{color:GRID_CLR},min:0,max:100} }
    }
  })
  cDonut = new Chart(document.getElementById('cDonut'), {
    type: 'doughnut',
    data: { labels: medios.map(m=>m.n), datasets: [{ data: medios.map(()=>0), backgroundColor: COLORS, borderWidth:1, borderColor:'#fff' }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>' '+c.label+': '+c.raw.toFixed(1)+'%'}} }
    }
  })
  buildDonutLegend()
  cIncr = new Chart(document.getElementById('cIncr'), {
    type: 'bar',
    data: { labels: medios.map(m=>m.n), datasets: [{ label:'Alc. incremental %', data: medios.map(()=>0), backgroundColor: COLORS, borderRadius:3, borderSkipped:false }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>' +'+c.raw.toFixed(3)+'%'}} },
      scales: { x:{ticks:{...TICK,maxRotation:40},grid:{display:false}}, y:{ticks:{...TICK,callback:v=>v+'%'},grid:{color:GRID_CLR},min:0} }
    }
  })
  rebuildLineChart()
  cSat = new Chart(document.getElementById('cSat'), {
    type: 'bar',
    data: { labels: medios.map(m=>m.n), datasets: [{ label:'Saturación %', data: medios.map(()=>0), backgroundColor:COLORS.map(c=>c+'99'), borderColor:COLORS, borderWidth:1, borderRadius:3, borderSkipped:false }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>' Saturación: '+c.raw.toFixed(1)+'%'}} },
      scales: { x:{ticks:{...TICK,maxRotation:40},grid:{display:false}}, y:{ticks:{...TICK,callback:v=>v+'%'},grid:{color:GRID_CLR},min:0,max:100} }
    }
  })
  cScatter = new Chart(document.getElementById('cScatter'), {
    type: 'bubble',
    data: { datasets: medios.map((m,i)=>({ label:m.n, data:[{x:0,y:0,r:0}], backgroundColor:COLORS[i]+'cc', borderColor:COLORS[i] })) },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:c=>`${c.dataset.label}: TRP=${c.raw.x.toFixed(1)}, Alc=${c.raw.y.toFixed(1)}%`}} },
      scales: {
        x:{title:{display:true,text:'TRP invertido',font:{size:10},color:LBL_CLR},ticks:TICK,grid:{color:GRID_CLR}},
        y:{title:{display:true,text:'Alcance (%)',font:{size:10},color:LBL_CLR},ticks:{...TICK,callback:v=>v+'%'},grid:{color:GRID_CLR},min:0,max:100}
      }
    }
  })
}

function rebuildLineChart() {
  if (cLine) { cLine.destroy(); cLine = null }
  const { tTRP, tAlc } = globalCalc
  const vAdj = ajustarVelocidad(tTRP, tAlc)
  const datasets = medios.map((m, i) => ({
    label: m.n,
    data: TRP_PTS.map(t => +calcReach(t, m.am, m.v).toFixed(2)),
    borderColor: COLORS[i % COLORS.length], backgroundColor: 'transparent',
    borderWidth: 1.5, pointRadius: 0, tension: 0.3
  }))
  datasets.push({
    label: 'TOTAL',
    data: TRP_PTS.map(t => +calcCurvaTotal(t, tAlc, vAdj).toFixed(2)),
    borderColor: '#111', backgroundColor: 'transparent',
    borderWidth: 2.5, pointRadius: 0, tension: 0.3, borderDash: [5, 3]
  })
  cLine = new Chart(document.getElementById('cLine'), {
    type: 'line',
    data: { labels: TRP_PTS, datasets },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ mode:'index', intersect:false, callbacks:{
        title:c=>'TRP: '+c[0].label, label:c=>' '+c.dataset.label+': '+c.raw.toFixed(1)+'%'
      }}},
      scales: {
        x:{title:{display:true,text:'TRP',font:{size:10},color:LBL_CLR},ticks:{...TICK,autoSkip:true,maxTicksLimit:10},grid:{display:false}},
        y:{title:{display:true,text:'Alcance (%)',font:{size:10},color:LBL_CLR},ticks:{...TICK,callback:v=>v+'%'},grid:{color:GRID_CLR},min:0,max:100}
      },
      interaction:{mode:'nearest',axis:'x',intersect:false}
    }
  })
  buildCurveLegend()
}

function updateCharts() {
  if (!cBar) return
  const labels = medios.map(m => m.n)

  cBar.data.labels = labels; cBar.data.datasets[0].data = medios.map(m => +m.reach.toFixed(2)); cBar.update('none')
  cDonut.data.labels = labels; cDonut.data.datasets[0].data = medios.map(m => +m.soi.toFixed(2)); cDonut.update('none')
  cIncr.data.labels = labels; cIncr.data.datasets[0].data = medios.map(m => +m.incr.toFixed(3)); cIncr.update('none')
  cSat.data.labels = labels; cSat.data.datasets[0].data = medios.map(m => +m.sat.toFixed(1)); cSat.update('none')

  if (cLine) {
    const { tTRP, tAlc } = globalCalc
    const vAdj = ajustarVelocidad(tTRP, tAlc)
    medios.forEach((m, i) => {
      if (!cLine.data.datasets[i]) return
      cLine.data.datasets[i].label = m.n
      cLine.data.datasets[i].data  = TRP_PTS.map(t => +calcReach(t, m.am, m.v).toFixed(2))
    })
    const ti = medios.length
    if (cLine.data.datasets[ti]) {
      cLine.data.datasets[ti].data = TRP_PTS.map(t => +calcCurvaTotal(t, tAlc, vAdj).toFixed(2))
    }
    cLine.update('none')
  }

  if (cScatter) {
    medios.forEach((m, i) => {
      if (!cScatter.data.datasets[i]) return
      cScatter.data.datasets[i].label = m.n
      cScatter.data.datasets[i].data  = m.trp > 0 ? [{ x:+m.trp.toFixed(1), y:+m.reach.toFixed(1), r:6 }] : [{ x:0,y:0,r:0 }]
    })
    cScatter.update('none')
  }
}

function refreshChartLabels() {
  if (cBar)   cBar.data.labels   = medios.map(m => m.n)
  if (cDonut) cDonut.data.labels = medios.map(m => m.n)
  if (cIncr)  cIncr.data.labels  = medios.map(m => m.n)
  if (cSat)   cSat.data.labels   = medios.map(m => m.n)
  buildDonutLegend(); buildCurveLegend(); recalc()
}
function refreshLabels() { refreshChartLabels() }

function buildDonutLegend() {
  const el = document.getElementById('donut-legend')
  el.innerHTML = ''
  medios.forEach((m, i) => {
    const item = document.createElement('div')
    item.className = 'legend-item'
    item.innerHTML = `<span class="dot" style="background:${COLORS[i%COLORS.length]}"></span><span>${esc(m.n)}</span>`
    el.appendChild(item)
  })
}

function buildCurveLegend() {
  const el = document.getElementById('curve-legend')
  el.innerHTML = ''
  ;[...medios.map((m,i)=>({n:m.n,c:COLORS[i%COLORS.length]})),{n:'TOTAL',c:'#111'}].forEach((item,i)=>{
    const isTotal = i === medios.length
    const span = document.createElement('span')
    span.className = 'legend-item'
    span.innerHTML = `<span class="legend-line" style="background:${item.c};${isTotal?'border-bottom:2px dashed #111;background:transparent':''}"></span>${esc(item.n)}`
    span.onclick = () => {
      if (!cLine) return
      const ds = cLine.data.datasets[i]
      if (!ds) return
      ds.hidden = !ds.hidden
      span.style.opacity = ds.hidden ? '0.3' : '1'
      cLine.update()
    }
    el.appendChild(span)
  })
}

// ── EXPORTR PDF ────────────────────────────────────────────────
function exportPDF() {
  const titulo = document.getElementById('exp-titulo').value || 'Reporte de Planeación de Medios'
  const fecha  = document.getElementById('exp-fecha').value  || new Date().toLocaleDateString('es-MX')
  const { tInv, tTRP, tAlc, freq, tIncr } = globalCalc
  const rows = medios.map(m => `
    <tr>
      <td>${esc(m.n)}</td>
      <td>${fmtMXN(m.inv)}</td>
      <td>${m.soi.toFixed(1)}%</td>
      <td>$${m.cpr.toLocaleString()}</td>
      <td>${m.am}%</td>
      <td>${m.v}</td>
      <td>${m.trp.toFixed(1)}</td>
      <td>${m.reach.toFixed(2)}%</td>
      <td>+${m.incr.toFixed(2)}%</td>
      <td>${m.sat.toFixed(0)}%</td>
      </tr>`).join('')
  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:30px}
    h1{font-size:18px;margin-bottom:4px}.meta{font-size:11px;color:#888;margin-bottom:20px}
    .kpis{display:flex;gap:16px;margin-bottom:20px}.kpi{border:1px solid #ddd;padding:10px 14px;flex:1}
    .kl{font-size:9px;text-transform:uppercase;color:#999;margin-bottom:3px}.kv{font-size:18px;font-weight:bold;font-family:monospace}
    table{border-collapse:collapse;width:100%;font-size:11px}th{background:#f0f0f0;text-align:right;padding:5px 8px;border:1px solid #ccc;font-size:10px}
    th:first-child{text-align:left}td{padding:4px 8px;border:1px solid #eee;text-align:right}td:first-child{text-align:left}
    tfoot td{background:#eee;font-weight:bold;border-top:2px solid #ccc}@media print{body{margin:15px}}</style>
    </head><body>
    <h1>${titulo}</h1><div class="meta">Generado el ${fecha} | Budget Allocator</div>
    <div class="kpis">
      <div class="kpi"><div class="kl">Inversión Total</div><div class="kv">${fmtMXN(tInv)}</div></div>
      <div class="kpi"><div class="kl">TRP Total</div><div class="kv">${tTRP.toFixed(1)}</div></div>
      <div class="kpi"><div class="kl">Alcance Total</div><div class="kv">${tAlc.toFixed(1)}%</div></div>
      <div class="kpi"><div class="kl">Frecuencia Prom.</div><div class="kv">${freq>0?freq.toFixed(2)+'x':'—'}</div></div>
    </div>
    <table><thead><tr><th>Medio</th><th>Inversión</th><th>SOI %</th><th>CPR</th>
    <th>Alc. Máx</th><th>Velocidad</th><th>TRP</th><th>Alcance %</th><th>Alc. Increm.</th><th>Saturación</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>TOTAL</td><td>${fmtMXN(tInv)}</td><td>100%</td><td>—</td><td>—</td><td>—</td>
    <td>${tTRP.toFixed(1)}</td><td>${tAlc.toFixed(1)}%</td><td>${tIncr.toFixed(1)}%</td><td>—</td></tr></tfoot>
    </table><script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}

function updateExportPreview() {
  const { tInv, tTRP, tAlc, freq } = globalCalc
  const activos = medios.filter(m => m.inv > 0)
  document.getElementById('preview-data').innerHTML = `
    <strong>Medios con inversión:</strong> ${activos.length ? activos.map(m=>esc(m.n)).join(', ') : 'Ninguno'}<br>
    <strong>Inversión Total:</strong> ${fmtMXN(tInv)}<br>
    <strong>TRP Total:</strong> ${tTRP.toFixed(1)}<br>
    <strong>Alcance Total:</strong> ${tAlc.toFixed(1)}%<br>
    <strong>Frecuencia:</strong> ${freq > 0 ? freq.toFixed(2)+'x' : '—'}`
  document.getElementById('exp-fecha').value = new Date().toLocaleDateString('es-MX')
}

// ── TABS ──────────────────────────────────────────────────────
function showTab(name) {
  const tabs = ['dashboard','campana','escenarios','exportar']
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', tabs[i]===name))
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  document.getElementById('tab-'+name).classList.add('active')
  if (name === 'escenarios') renderScenarios()
  if (name === 'exportar')   updateExportPreview()
}

// ── GESTIÓN DE CAMPAÑAS ───────────────────────────────────────
function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login.html'
}

async function loadCampaigns() {
  const data = await API.get('/campaigns')
  if (data) allCampaigns = data
}

function showCampaignSelector() {
  document.getElementById('campaign-modal').style.display = 'flex'
  renderCampaignList()
}
function hideCampaignSelector() {
  document.getElementById('campaign-modal').style.display = 'none'
}
function renderCampaignList() {
  const el = document.getElementById('campaign-list')
  if (!allCampaigns.length) {
    el.innerHTML = '<div class="empty-state">No hay campañas. Crea una nueva.</div>'
    return
  }
  el.innerHTML = allCampaigns.map(c => `
    <div class="scenario-card" style="cursor:pointer" onclick="selectCampaign(${c.id})">
      <div><strong style="font-size:13px">${esc(c.name)}</strong>
      <div class="scenario-meta">${c.client || ''} ${c.period ? '· ' + c.period : ''}</div></div>
      <button class="btn btn-danger" style="font-size:10px;padding:2px 8px" onclick="event.stopPropagation();deleteCampaignFromList(${c.id})">Eliminar</button>
    </div>`).join('')
}
async function createCampaign() {
  const name = document.getElementById('new-campaign-name').value.trim()
  if (!name) { alert('Escribe un nombre'); return }
  const data = await API.post('/campaigns', { name })
  if (!data) { alert('Error al crear campaña'); return }
  allCampaigns.unshift(data)
  document.getElementById('new-campaign-name').value = ''
  await selectCampaign(data.id)
}
async function selectCampaign(id) {
  const data = await API.get(`/campaigns/${id}`)
  if (!data) { alert('Error al cargar campaña'); return }
  activeCampaign = data
  medios = data.media.map(m => ({
    id: m.id,
    n: m.customName || m.mediumCatalog.name,
    inv: m.investment,
    cpr: m.cpr,
    am: m.am,
    v: m.v
  }))
  document.getElementById('topbar-campaign').textContent = '— ' + data.name
  document.getElementById('camp-nombre').value   = data.name || ''
  document.getElementById('camp-cliente').value  = data.client || ''
  document.getElementById('camp-budget').value   = data.budgetTarget || ''
  document.getElementById('camp-periodo').value  = data.period || ''
  document.getElementById('camp-target').value   = data.target || ''
  document.getElementById('camp-objetivos').value = data.objectives || ''
  buildTable()
  rebuildLineChart()
  recalc()
  hideCampaignSelector()
  await loadScenariosList()
}
async function deleteCampaignFromList(id) {
  if (!confirm('¿Eliminar campaña y todos sus datos?')) return
  await API.delete(`/campaigns/${id}`)
  allCampaigns = allCampaigns.filter(c => c.id !== id)
  if (activeCampaign?.id === id) {
    activeCampaign = null
    medios = []
    document.getElementById('topbar-campaign').textContent = '— Sin campaña activa'
    buildTable()
    recalc()
  }
  renderCampaignList()
}

// ── UTILS ─────────────────────────────────────────────────────
function fmtMXN(n) {
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'k'
  return '$' + Math.round(n)
}
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  initCharts()
  if (!API.token()) {
    window.location.href = '/login.html'
    return
  }
  await loadCampaigns()
  if (allCampaigns.length > 0) {
    await selectCampaign(allCampaigns[0].id)
  } else {
    showCampaignSelector()
  }
  document.getElementById('logout-btn').style.display = 'inline-block'
  document.getElementById('select-campaign-btn').style.display = 'inline-block'
}
init()