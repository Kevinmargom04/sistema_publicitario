// ─────────────────────────────────────────────────────────────────────────────
// Motor de cálculo — replica exacta de la lógica VBA del Budget Allocator.
// Fuente: Módulo C (Sub Alcance), Módulo1 (Sub Curva), Módulo3 (Sub CurvaTotal)
//
// FÓRMULA PRINCIPAL (extraída del VBA línea a línea):
//   VBA: ((-AM/100) + ((AM/100) - (-AM/100)) / (1 + Exp(-(TRP) * 1/V))) * 100
//   Simplificado: AM * tanh(TRP / V)
//   donde tanh(x) = (e^x - 1) / (e^x + 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alcance de un medio individual.
 * Fórmula VBA (Módulo C, col 8):
 *   ((-AM/100) + ((AM/100)-(-AM/100)) / (1 + Exp(-TRP * 1/V))) * 100
 * Equivale a: AM * tanh(TRP / V)
 *
 * @param {number} trp  - TRP del medio (inversión / CPR)
 * @param {number} am   - Alcance máximo del medio (%)
 * @param {number} v    - Velocidad del medio
 * @returns {number} Alcance en %
 */
export function calcReach(trp, am, v) {
  if (!trp || trp <= 0 || !am || !v) return 0
  const x = trp / v
  const ex = Math.exp(x)
  return am * (ex - 1) / (ex + 1) // am * tanh(TRP/V)
}

/**
 * Alcance total del mix de medios.
 * Fórmula VBA (Módulo C): AlcanceUno = (1 - Producto) * 100
 * donde Producto = ∏(1 - Alcance_i / 100)
 *
 * @param {number[]} reaches - Array de alcances individuales (%)
 * @returns {number} Alcance total en %
 */
export function calcTotalReach(reaches) {
  let product = 1
  reaches.forEach(r => { product *= (1 - r / 100) })
  return (1 - product) * 100
}

/**
 * Alcance incremental de cada medio.
 * Δ_i = AlcTotal(todos) - AlcTotal(todos excepto i)
 * Indica la aportación única de cada medio al mix.
 *
 * @param {number[]} reaches - Array de alcances individuales (%)
 * @returns {number[]} Array de alcances incrementales (%)
 */
export function calcIncrementalReach(reaches) {
  const total = calcTotalReach(reaches)
  return reaches.map((_, i) => {
    const without = reaches.filter((_, j) => j !== i)
    return total - calcTotalReach(without)
  })
}

/**
 * Saturación de un medio: qué % de su techo máximo se está usando.
 * Sat_i = (reach_i / am_i) * 100
 *
 * @param {number} reach - Alcance actual del medio (%)
 * @param {number} am    - Alcance máximo del medio (%)
 * @returns {number} Saturación en %
 */
export function calcSaturation(reach, am) {
  if (!am || am === 0) return 0
  return (reach / am) * 100
}

/**
 * Curva de alcance total (Módulo3 - Sub CurvaTotal).
 * Usa el AlcanceMax del mix y ajusta la velocidad hasta que la curva
 * pase por el punto real (TRP_total, Alcance_total).
 *
 * Fórmula VBA:
 *   AlcanceMax * tanh(TRP_curva / Velocidad)
 * Velocidad comienza en 200 y se reduce de 10 en 10 hasta ajustarse.
 *
 * @param {number} trp        - Punto del eje X de la curva
 * @param {number} alcanceMax - Alcance total real del mix (%)
 * @param {number} velocidad  - Velocidad ajustada (default 200)
 * @returns {number} Valor de la curva en ese punto TRP (%)
 */
export function calcCurvaTotal(trp, alcanceMax, velocidad = 200) {
  if (!alcanceMax || alcanceMax <= 0) return 0
  const x = trp / velocidad
  const ex = Math.exp(x)
  return alcanceMax * (ex - 1) / (ex + 1)
}

/**
 * Ajusta la velocidad de la curva total para que pase por el punto real.
 * Replica el Do While del VBA (Módulo3):
 *   Do While NewAlcance < AlcanceMax → Velocidad -= 10 → recalcula
 *
 * @param {number} trpTotal   - TRP total del mix actual
 * @param {number} alcanceMax - Alcance total real del mix (%)
 * @returns {number} Velocidad ajustada
 */
export function ajustarVelocidadCurva(trpTotal, alcanceMax) {
  if (!trpTotal || !alcanceMax) return 200
  let velocidad = 200
  let newAlcance = calcCurvaTotal(trpTotal, alcanceMax, velocidad)
  while (newAlcance < alcanceMax && velocidad > 10) {
    velocidad -= 10
    newAlcance = calcCurvaTotal(trpTotal, alcanceMax, velocidad)
  }
  return velocidad
}

/**
 * Puntos de la curva por medio (Módulo1 - Sub Curva).
 * Para cada TRP en el eje X, calcula el alcance del medio.
 *
 * @param {Object} medio  - { am, v }
 * @param {number[]} trps - Array de valores TRP (eje X)
 * @returns {number[]} Array de alcances (%)
 */
export function calcCurvaPorMedio(medio, trps) {
  return trps.map(t => parseFloat(calcReach(t, medio.am, medio.v).toFixed(4)))
}

/**
 * Motor principal de cálculo.
 * Recibe el array de medios con su inversión y parámetros,
 * devuelve todos los KPIs y datos para gráficas.
 *
 * @param {Array} medios - [{ name, investment, cpr, am, v }]
 * @returns {Object} Resultado completo del cálculo
 */
export function calcularCampana(medios) {
  const tInv = medios.reduce((s, m) => s + (m.investment || 0), 0)

  // Calcular TRP, SOI, Alcance, Saturación por medio
  const mediosCalc = medios.map(m => {
    const trp   = m.cpr > 0 && m.investment > 0 ? m.investment / m.cpr : 0
    const soi   = tInv > 0 ? (m.investment / tInv) * 100 : 0
    const reach = calcReach(trp, m.am, m.v)
    const sat   = calcSaturation(reach, m.am)
    return { ...m, trp, soi, reach, sat }
  })

  const reaches = mediosCalc.map(m => m.reach)
  const increms = calcIncrementalReach(reaches)
  mediosCalc.forEach((m, i) => { m.incrementalReach = increms[i] })

  // KPIs globales
  const tTRP  = mediosCalc.reduce((s, m) => s + m.trp, 0)
  const tAlc  = calcTotalReach(reaches)
  const freq  = tAlc > 0.01 ? tTRP / tAlc : 0
  const tIncr = increms.reduce((s, v) => s + v, 0)

  // Curva total ajustada (Módulo3)
  const velocidadAjustada = ajustarVelocidadCurva(tTRP, tAlc)

  // Puntos para gráfica de curva total (TRP 0–1000, paso 10)
  const trpAxis = Array.from({ length: 101 }, (_, i) => i * 10)
  const curvaTotalPts = trpAxis.map(t => ({
    trp: t,
    alcance: parseFloat(calcCurvaTotal(t, tAlc, velocidadAjustada).toFixed(4))
  }))

  // Puntos para curva por medio (mismo eje)
  const curvasPorMedio = mediosCalc.map(m => ({
    name: m.customName || m.name,
    color: m.color || null,
    puntos: trpAxis.map(t => ({
      trp: t,
      alcance: parseFloat(calcReach(t, m.am, m.v).toFixed(4))
    }))
  }))

  return {
    // KPIs
    totalInvestment: tInv,
    totalTRP: parseFloat(tTRP.toFixed(2)),
    totalReach: parseFloat(tAlc.toFixed(4)),
    frequency: parseFloat(freq.toFixed(4)),
    totalIncrementalReach: parseFloat(tIncr.toFixed(4)),
    activeMedia: mediosCalc.filter(m => m.investment > 0).length,

    // Detalle por medio
    media: mediosCalc.map(m => ({
      id: m.id,
      name: m.customName || m.name,
      investment: m.investment,
      soi: parseFloat(m.soi.toFixed(2)),
      cpr: m.cpr,
      am: m.am,
      v: m.v,
      trp: parseFloat(m.trp.toFixed(2)),
      reach: parseFloat(m.reach.toFixed(4)),
      incrementalReach: parseFloat(m.incrementalReach.toFixed(4)),
      saturation: parseFloat(m.sat.toFixed(2)),
    })),

    // Datos para gráficas
    charts: {
      curvaTotal: curvaTotalPts,
      curvasPorMedio,
      velocidadAjustada,
    }
  }
}