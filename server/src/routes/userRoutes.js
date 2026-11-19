import { Router } from 'express'
import { body, query } from 'express-validator'
import {
  listUsers,
  createUser,
  updateUser,
  updateUserCommittees,
  transferAdminRole,
  resetUserPassword,
  deleteUser
} from '../controllers/userController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.use(verifyToken, requireRole('Admin'))

router.get('/', [query('role').optional().isIn(['Admin', 'Coordinator', 'Member'])], validate, listUsers)

router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 120 })
      .matches(/^[A-Za-z ]+$/)
      .withMessage('Name can only contain letters and spaces'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail().isLength({ max: 254 }),
    body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role')
      .isIn(['Coordinator', 'Member'])
      .withMessage('New accounts can only be Coordinator or Member — use Transfer Admin to change who holds Admin'),
    body('designation').optional({ checkFalsy: true }).trim().isLength({ max: 200 })
  ],
  validate,
  createUser
)

router.patch(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 120 })
      .matches(/^[A-Za-z ]+$/)
      .withMessage('Name can only contain letters and spaces'),
    body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail().isLength({ max: 254 }),
    // Admin is not settable through this route — see POST /:id/transfer-admin.
    body('role').optional().isIn(['Coordinator', 'Member']),
    body('designation').optional({ checkFalsy: true }).trim().isLength({ max: 200 })
  ],
  validate,
  updateUser
)

router.patch(
  '/:id/committees',
  [body('committeeIds').isArray(), body('committeeIds.*').isMongoId()],
  validate,
  updateUserCommittees
)

router.post('/:id/transfer-admin', transferAdminRole)

router.patch(
  '/:id/reset-password',
  [
    body('newPassword')
      .isString()
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters')
  ],
  validate,
  resetUserPassword
)

router.delete('/:id', deleteUser)

// Kept for backwards compatibility with any existing client calls.
router.patch('/:id/deactivate', deleteUser)

export default router
