// src/controllers/campaignController.js
import prisma from '../utils/prisma.js'
import { calcularCampana } from '../services/calculationService.js'

// ── GET /api/campaigns ────────────────────────────────────────────────────────
export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.userId },
      include: { media: true },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(campaigns)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener campañas' })
  }
}

// ── POST /api/campaigns ───────────────────────────────────────────────────────
export const createCampaign = async (req, res) => {
  try {
    const { name, client, budgetTarget, period, target, objectives } = req.body

    const campaign = await prisma.campaign.create({
      data: { name, client, budgetTarget, period, target, objectives, userId: req.userId },
    })

    const catalogs = await prisma.mediumCatalog.findMany({ orderBy: { id: 'asc' } })

    await prisma.campaignMedium.createMany({
      data: catalogs.map((cat, idx) => ({
        campaignId: campaign.id,
        mediumCatalogId: cat.id,
        cpr: cat.defaultCPR,
        am: cat.defaultAM,
        v: cat.defaultV,
        investment: 0,
        orderIndex: idx,
      })),
    })

    const campaignWithMedia = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { media: { include: { mediumCatalog: true }, orderBy: { orderIndex: 'asc' } } },
    })

    res.status(201).json(campaignWithMedia)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear campaña' })
  }
}

// ── GET /api/campaigns/:id ────────────────────────────────────────────────────
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params
    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
      include: {
        media: { include: { mediumCatalog: true }, orderBy: { orderIndex: 'asc' } },
        scenarios: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })
    res.json(campaign)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener campaña' })
  }
}

// ── PUT /api/campaigns/:id ────────────────────────────────────────────────────
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params
    const { name, client, budgetTarget, period, target, objectives } = req.body

    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    const updated = await prisma.campaign.update({
      where: { id: parseInt(id) },
      data: { name, client, budgetTarget, period, target, objectives },
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar campaña' })
  }
}

// ── DELETE /api/campaigns/:id ─────────────────────────────────────────────────
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params
    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    // Borrar en cascada manualmente (Prisma no hace cascade delete por defecto sin onDelete)
    await prisma.scenario.deleteMany({ where: { campaignId: parseInt(id) } })
    await prisma.campaignMedium.deleteMany({ where: { campaignId: parseInt(id) } })
    await prisma.campaign.delete({ where: { id: parseInt(id) } })

    res.json({ message: 'Campaña eliminada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar campaña' })
  }
}

// ── PUT /api/campaigns/media/:mediumId ────────────────────────────────────────
export const updateMedium = async (req, res) => {
  try {
    const { mediumId } = req.params
    const { investment, cpr, am, v, customName } = req.body

    const medium = await prisma.campaignMedium.findUnique({
      where: { id: parseInt(mediumId) },
      include: { campaign: true },
    })
    if (!medium || medium.campaign.userId !== req.userId) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const updated = await prisma.campaignMedium.update({
      where: { id: parseInt(mediumId) },
      data: {
        investment: investment !== undefined ? investment : undefined,
        cpr:        cpr        !== undefined ? cpr        : undefined,
        am:         am         !== undefined ? am         : undefined,
        v:          v          !== undefined ? v          : undefined,
        customName: customName !== undefined ? customName : undefined,
      },
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar medio' })
  }
}

// ── POST /api/campaigns/:id/calculate ────────────────────────────────────────
// Corre el motor de cálculo con los datos actuales de la campaña
export const calculateCampaign = async (req, res) => {
  try {
    const { id } = req.params

    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
      include: {
        media: {
          include: { mediumCatalog: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    // Mapear medios al formato que espera calculationService
    const mediosInput = campaign.media.map(m => ({
      id: m.id,
      name: m.mediumCatalog.name,
      customName: m.customName,
      investment: m.investment,
      cpr: m.cpr,
      am: m.am,
      v: m.v,
    }))

    const resultado = calcularCampana(mediosInput)
    res.json(resultado)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el cálculo' })
  }
}

// ── POST /api/campaigns/:id/scenarios ────────────────────────────────────────
// Guarda un escenario (snapshot del estado actual)
export const saveScenario = async (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body

    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
      include: {
        media: { include: { mediumCatalog: true }, orderBy: { orderIndex: 'asc' } },
      },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    // Calcular KPIs actuales para guardar en el snapshot
    const mediosInput = campaign.media.map(m => ({
      id: m.id,
      name: m.mediumCatalog.name,
      customName: m.customName,
      investment: m.investment,
      cpr: m.cpr,
      am: m.am,
      v: m.v,
    }))
    const kpis = calcularCampana(mediosInput)

    const scenario = await prisma.scenario.create({
      data: {
        name: name || `Escenario ${new Date().toLocaleDateString('es-MX')}`,
        campaignId: parseInt(id),
        snapshot: {
          media: mediosInput,
          kpis: {
            totalInvestment: kpis.totalInvestment,
            totalTRP: kpis.totalTRP,
            totalReach: kpis.totalReach,
            frequency: kpis.frequency,
            totalIncrementalReach: kpis.totalIncrementalReach,
            activeMedia: kpis.activeMedia,
          },
        },
      },
    })

    res.status(201).json(scenario)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al guardar escenario' })
  }
}

// ── GET /api/campaigns/:id/scenarios ─────────────────────────────────────────
export const getScenarios = async (req, res) => {
  try {
    const { id } = req.params
    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    const scenarios = await prisma.scenario.findMany({
      where: { campaignId: parseInt(id) },
      orderBy: { createdAt: 'desc' },
    })
    res.json(scenarios)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener escenarios' })
  }
}

// ── DELETE /api/campaigns/:id/scenarios/:scId ─────────────────────────────────
export const deleteScenario = async (req, res) => {
  try {
    const { id, scId } = req.params
    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    await prisma.scenario.delete({ where: { id: parseInt(scId) } })
    res.json({ message: 'Escenario eliminado' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar escenario' })
  }
}

// ── POST /api/campaigns/:id/scenarios/:scId/load ──────────────────────────────
// Carga un escenario — restaura las inversiones guardadas en el snapshot
export const loadScenario = async (req, res) => {
  try {
    const { id, scId } = req.params

    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' })

    const scenario = await prisma.scenario.findFirst({
      where: { id: parseInt(scId), campaignId: parseInt(id) },
    })
    if (!scenario) return res.status(404).json({ error: 'Escenario no encontrado' })

    const { media } = scenario.snapshot

    // Restaurar inversiones y parámetros de cada medio
    await Promise.all(
      media.map(m =>
        prisma.campaignMedium.update({
          where: { id: m.id },
          data: { investment: m.investment, cpr: m.cpr, am: m.am, v: m.v, customName: m.customName },
        })
      )
    )

    // Devolver la campaña actualizada
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: parseInt(id) },
      include: {
        media: { include: { mediumCatalog: true }, orderBy: { orderIndex: 'asc' } },
      },
    })

    res.json(updatedCampaign)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al cargar escenario' })
  }
}