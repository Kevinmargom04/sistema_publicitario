import prisma from '../utils/prisma.js'

// Obtener todas las campañas del usuario autenticado
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

// Crear una nueva campaña (con sus medios por defecto desde MediumCatalog)
export const createCampaign = async (req, res) => {
  try {
    const { name, client, budgetTarget, period, target, objectives } = req.body

    // 1. Crear la campaña
    const campaign = await prisma.campaign.create({
      data: {
        name,
        client,
        budgetTarget,
        period,
        target,
        objectives,
        userId: req.userId,
      },
    })

    // 2. Obtener todos los medios del catálogo
    const catalogs = await prisma.mediumCatalog.findMany()

    // 3. Crear un CampaignMedium por cada medio del catálogo
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

    // 4. Devolver la campaña con sus medios
    const campaignWithMedia = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { media: { include: { mediumCatalog: true } } },
    })

    res.status(201).json(campaignWithMedia)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear campaña' })
  }
}

// Obtener una campaña específica con sus medios
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params
    const campaign = await prisma.campaign.findFirst({
      where: { id: parseInt(id), userId: req.userId },
      include: { media: { include: { mediumCatalog: true }, orderBy: { orderIndex: 'asc' } } },
    })
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' })
    }
    res.json(campaign)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener campaña' })
  }
}

// Actualizar inversión o parámetros de un CampaignMedium
export const updateMedium = async (req, res) => {
  try {
    const { mediumId } = req.params
    const { investment, cpr, am, v, customName } = req.body

    // Verificar que el medio pertenece a una campaña del usuario
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
        cpr: cpr !== undefined ? cpr : undefined,
        am: am !== undefined ? am : undefined,
        v: v !== undefined ? v : undefined,
        customName,
      },
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar medio' })
  }
}