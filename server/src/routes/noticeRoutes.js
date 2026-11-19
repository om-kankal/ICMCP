import { Router } from 'express'
import { body } from 'express-validator'
import { listNotices, createNotice, updateNotice, deleteNotice } from '../controllers/noticeController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.use(verifyToken)

router.get('/', listNotices)

router.post(
  '/',
  requireRole('Admin', 'Coordinator'),
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('priority').optional().isIn(['Normal', 'Important', 'Urgent']),
    body('committeeId').optional({ checkFalsy: true }).isMongoId(),
    body('attachmentUrl').optional({ checkFalsy: true }).isString(),
    body('isPinned').optional().isBoolean(),
    body('expiresAt').optional({ checkFalsy: true }).isISO8601()
  ],
  validate,
  createNotice
)

router.patch(
  '/:id',
  requireRole('Admin', 'Coordinator'),
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('content').optional().trim().notEmpty(),
    body('priority').optional().isIn(['Normal', 'Important', 'Urgent']),
    body('isPinned').optional().isBoolean(),
    body('expiresAt').optional({ checkFalsy: true }).isISO8601()
  ],
  validate,
  updateNotice
)

router.delete('/:id', requireRole('Admin', 'Coordinator'), deleteNotice)

export default router
