import { Router } from 'express'
import {
  generateNotice,
  generateAgenda,
  generateMinutes,
  generateCommitteeReport,
  generateNewsDocument
} from '../controllers/documentGenController.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

router.use(verifyToken)

router.get('/:meetingId/notice', generateNotice)
router.get('/:meetingId/agenda', generateAgenda)
router.get('/:meetingId/mom', generateMinutes)
router.get('/committee/:committeeId/report', generateCommitteeReport)
router.get('/news/:id', generateNewsDocument)

export default router
