// ══════════════════════════════════════════════════════════════
// public/js/dashboard.js — Solo dashboard (sin autenticación)
// ══════════════════════════════════════════════════════════════

// ── ESTADO GLOBAL ─────────────────────────────────────────────
let medios = []              // se llena desde la API al seleccionar campaña
let scenarios = []           // escenarios cargados desde la API
let activeCampaign = null
let saveTimer = null
let allCampaigns = []

const COLORS = [
  '#2471A3','#1E8449','#48C9B0','#7D3C98','#CA6F1E',
  '#C0392B','#D4AC0D','#717D7E','#27AE60','#1A5276',
  '#117864','#F39C12'
]

// ── API HELPER (con redirección a login en 401) ───────────────
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
      // Token inválido o expirado → cerrar sesión y redirigir
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

// ── FÓRMULAS (igual que antes) ────────────────────────────────
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

// ── TABLA (igual que antes) ───────────────────────────────────
function buildTable() { /* igual, sin cambios */ }
function updateTable() { /* igual */ }
function scheduleSave(idx) { /* igual */ }
function addMedio() { alert("Función no disponible en esta versión") }
function removeMedio(i) { alert("Función no disponible en esta versión") }

// ── KPIs, CAMPAÑA, ESCENARIOS, GRÁFICAS, EXPORT (igual) ──────
// (todas las funciones desde updateKPIs hasta buildCurveLegend se mantienen idénticas)
// No las repito por brevedad, pero deben estar presentes.

// ── TABS (igual) ──────────────────────────────────────────────
function showTab(name) { /* igual */ }

// ── LOGOUT (simplificado) ─────────────────────────────────────
function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login.html'
}

// ── CAMPAÑAS (sin modales de auth) ────────────────────────────
async function loadCampaigns() {
  const data = await API.get('/campaigns')
  if (data) allCampaigns = data
}
function showCampaignSelector() { /* muestra el modal de campañas */ }
function hideCampaignSelector() { /* oculta modal */ }
function renderCampaignList() { /* igual */ }
async function createCampaign() { /* igual */ }
async function selectCampaign(id) { /* igual */ }
async function deleteCampaignFromList(id) { /* igual */ }

// ── INIT (sin autenticación, solo redirige si no hay token) ────
async function init() {
  initCharts()
  if (!API.token()) {
    window.location.href = '/login.html'
    return
  }
  const campaigns = await API.get('/campaigns')
  if (campaigns && campaigns.length !== undefined) {
    allCampaigns = campaigns
    if (campaigns.length > 0) await selectCampaign(campaigns[0].id)
    else showCampaignSelector()
    document.getElementById('logout-btn').style.display = 'inline-block'
    document.getElementById('select-campaign-btn').style.display = 'inline-block'
  } else {
    showCampaignSelector()
  }
}
init()