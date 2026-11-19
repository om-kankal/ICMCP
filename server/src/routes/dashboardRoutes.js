import { Router } from 'express'
import { getDashboardMetrics, getUpdatesFeed } from '../controllers/dashboardController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/metrics', verifyToken, requireRole('Admin'), getDashboardMetrics)
router.get('/feed', verifyToken, getUpdatesFeed)

export default router
