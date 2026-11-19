import { Router } from 'express'
import authRoutes from './authRoutes.js'
import committeeRoutes from './committeeRoutes.js'
import meetingRoutes from './meetingRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import documentRoutes from './documentRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import userRoutes from './userRoutes.js'
import settingsRoutes from './settingsRoutes.js'
import noticeRoutes from './noticeRoutes.js'
import newsRoutes from './newsRoutes.js'
import workAssignmentRoutes from './workAssignmentRoutes.js'
import mailRoutes from './mailRoutes.js'
import bulkImportRoutes from './bulkImportRoutes.js'

const router = Router()

router.get('/health', (req, res) => res.json({ success: true, message: 'ICMCP API is healthy' }))

router.use('/auth', authRoutes)
router.use('/committees', committeeRoutes)
router.use('/meetings', meetingRoutes)
router.use('/uploads', uploadRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/documents', documentRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)
router.use('/settings', settingsRoutes)
router.use('/notices', noticeRoutes)
router.use('/news', newsRoutes)
router.use('/work-assignments', workAssignmentRoutes)
router.use('/mail', mailRoutes)
router.use('/admin', bulkImportRoutes)

export default router
