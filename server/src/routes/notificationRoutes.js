import { Router } from 'express'
import {
  listNotifications,
  markNotificationRead,
  markAllRead,
  triggerMonthEndCheck
} from '../controllers/notificationController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(verifyToken)

router.get('/', listNotifications)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markNotificationRead)
router.post('/run-month-end-check', requireRole('Admin'), triggerMonthEndCheck)

export default router
