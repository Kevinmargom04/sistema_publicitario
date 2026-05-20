import express from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import {
  getCampaigns,
  createCampaign,
  getCampaignById,
  updateMedium,
} from '../controllers/campaignController.js'

const router = express.Router()

router.use(authMiddleware) // todas las rutas requieren autenticación

router.get('/', getCampaigns)
router.post('/', createCampaign)
router.get('/:id', getCampaignById)
router.put('/media/:mediumId', updateMedium)

export default router