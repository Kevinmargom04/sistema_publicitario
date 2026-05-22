// src/routes/campaigns.js
import express from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import {
  getCampaigns,
  createCampaign,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  updateMedium,
  calculateCampaign,
  saveScenario,
  getScenarios,
  deleteScenario,
  loadScenario,
} from '../controllers/campaignController.js'

const router = express.Router()

router.use(authMiddleware) // todas las rutas requieren auth

// ── Campañas ──────────────────────────────────────────────────
router.get('/',     getCampaigns)
router.post('/',    createCampaign)
router.get('/:id',  getCampaignById)
router.put('/:id',  updateCampaign)
router.delete('/:id', deleteCampaign)

// ── Medios ────────────────────────────────────────────────────
router.put('/media/:mediumId', updateMedium)

// ── Motor de cálculo ──────────────────────────────────────────
router.post('/:id/calculate', calculateCampaign)

// ── Escenarios ────────────────────────────────────────────────
router.get('/:id/scenarios',              getScenarios)
router.post('/:id/scenarios',             saveScenario)
router.delete('/:id/scenarios/:scId',     deleteScenario)
router.post('/:id/scenarios/:scId/load',  loadScenario)

export default router