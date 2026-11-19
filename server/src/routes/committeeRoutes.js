import { Router } from 'express'
import { body } from 'express-validator'
import {
  listCommittees,
  getCommitteeOverview,
  getCommitteeHistory,
  createCommittee,
  updateCommittee,
  updateCommitteeMembers,
  deleteCommittee,
  escalateCommittee
} from '../controllers/committeeController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.use(verifyToken)

router.get('/', listCommittees)
router.get('/:id/overview', getCommitteeOverview)
router.get('/:id/meetings', getCommitteeHistory)

router.post(
  '/',
  requireRole('Admin'),
  [
    body('name').trim().notEmpty().withMessage('Committee name is required').isLength({ max: 160 }),
    body('type').trim().notEmpty().withMessage('Mandate/type is required').isLength({ max: 160 }),
    body('academicYear')
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('Academic year must look like 2026-27'),
    body('coordinatorIds').isArray({ min: 1 }).withMessage('At least one Coordinator must be assigned'),
    body('coordinatorIds.*').isMongoId(),
    body('memberIds').optional().isArray(),
    body('memberIds.*').optional().isMongoId()
  ],
  validate,
  createCommittee
)

router.patch(
  '/:id',
  requireRole('Admin'),
  [
    body('name').optional().trim().notEmpty().isLength({ max: 160 }),
    body('type').optional().trim().notEmpty().isLength({ max: 160 }),
    body('academicYear')
      .optional()
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('Academic year must look like 2026-27'),
    body('meetingsRequiredPerYear').optional().isInt({ min: 1, max: 52 }),
    body('meetingCadenceDays').optional().isInt({ min: 1, max: 366 })
  ],
  validate,
  updateCommittee
)

router.patch(
  '/:id/members',
  requireRole('Admin'),
  [
    body('coordinatorIds').optional().isArray(),
    body('coordinatorIds.*').optional().isMongoId(),
    body('memberIds').optional().isArray(),
    body('memberIds.*').optional().isMongoId()
  ],
  validate,
  updateCommitteeMembers
)

router.delete('/:id', requireRole('Admin'), deleteCommittee)

router.post('/:id/escalate', requireRole('Admin'), escalateCommittee)

export default router
