import { Router } from 'express'
import { body } from 'express-validator'
import {
  listNewsEvents,
  createNewsEvent,
  updateNewsEvent,
  deleteNewsEvent
} from '../controllers/newsEventController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.use(verifyToken)

router.get('/', listNewsEvents)

router.post(
  '/',
  requireRole('Admin', 'Coordinator'),
  [
    body('category').isIn(['News', 'Event', 'Announcement']),
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('eventDate').optional({ checkFalsy: true }).isISO8601(),
    body('location').optional().isString().trim().isLength({ max: 200 }),
    body('committeeId').optional({ checkFalsy: true }).isMongoId(),
    body('photoUrl').optional({ checkFalsy: true }).isString()
  ],
  validate,
  createNewsEvent
)

router.patch(
  '/:id',
  requireRole('Admin', 'Coordinator'),
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('content').optional().trim().notEmpty(),
    body('eventDate').optional({ checkFalsy: true }).isISO8601(),
    body('location').optional().isString().trim().isLength({ max: 200 })
  ],
  validate,
  updateNewsEvent
)

router.delete('/:id', requireRole('Admin', 'Coordinator'), deleteNewsEvent)

export default router
