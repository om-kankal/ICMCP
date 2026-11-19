import { Router } from 'express'
import { body } from 'express-validator'
import {
  listWorkAssignments,
  createWorkAssignment,
  updateWorkAssignment,
  updateWorkAssignmentStatus,
  deleteWorkAssignment
} from '../controllers/workAssignmentController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Deliberately no 'Admin' here — Work Assign has no Admin visibility by
// design. An Admin token hitting any of these routes gets a 403, same as
// any other role this feature isn't meant for.
router.use(verifyToken, requireRole('Coordinator', 'Member'))

router.get('/', listWorkAssignments)

router.post(
  '/',
  requireRole('Coordinator'),
  [
    body('committeeId').isMongoId().withMessage('A valid committee is required'),
    body('assignedTo').isMongoId().withMessage('A valid member is required'),
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 4000 }),
    body('dueDate').optional({ checkFalsy: true }).isISO8601()
  ],
  validate,
  createWorkAssignment
)

router.patch(
  '/:id',
  requireRole('Coordinator'),
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().trim().notEmpty().isLength({ max: 4000 }),
    body('dueDate').optional({ checkFalsy: true }).isISO8601()
  ],
  validate,
  updateWorkAssignment
)

router.patch(
  '/:id/status',
  requireRole('Member'),
  [
    body('status').optional().isIn(['Pending', 'In Progress', 'Completed']),
    body('proofText').optional().isString().isLength({ max: 4000 }),
    body('proofImageUrl').optional({ checkFalsy: true }).isString()
  ],
  validate,
  updateWorkAssignmentStatus
)

router.delete('/:id', requireRole('Coordinator'), deleteWorkAssignment)

export default router
