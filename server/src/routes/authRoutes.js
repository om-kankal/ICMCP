import { Router } from 'express'
import { body } from 'express-validator'
import {
  login,
  refresh,
  logout,
  me,
  updateProfile,
  requestEmailChangeOtp,
  confirmEmailChangeOtp,
  requestPasswordChangeOtp,
  confirmPasswordChangeOtp,
  updatePreferences,
  confirmAvatar,
  checkResetToken,
  applyResetToken
} from '../controllers/authController.js'
import { validate } from '../middleware/validate.js'
import { verifyToken } from '../middleware/auth.js'
import { loginLimiter, refreshLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validate,
  login
)

router.post('/refresh', refreshLimiter, refresh)
router.post('/logout', refreshLimiter, logout)
router.get('/me', verifyToken, me)

// Name / designation only — email changes go through the OTP flow below.
router.patch(
  '/profile',
  verifyToken,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 120 }),
    body('designation').optional({ checkFalsy: true }).trim().isLength({ max: 200 })
  ],
  validate,
  updateProfile
)

// Email change — two-step OTP verification, free (Gmail SMTP), no third party.
router.post(
  '/email/request-otp',
  verifyToken,
  loginLimiter,
  [
    body('newEmail').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('currentPassword').isString().notEmpty()
  ],
  validate,
  requestEmailChangeOtp
)
router.post(
  '/email/verify-otp',
  verifyToken,
  loginLimiter,
  [body('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code')],
  validate,
  confirmEmailChangeOtp
)

// Password change — two-step OTP verification.
router.post(
  '/password/request-otp',
  verifyToken,
  loginLimiter,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  validate,
  requestPasswordChangeOtp
)
router.post(
  '/password/verify-otp',
  verifyToken,
  loginLimiter,
  [body('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code')],
  validate,
  confirmPasswordChangeOtp
)

router.patch(
  '/preferences',
  verifyToken,
  [body('theme').isIn(['light', 'dark', 'system'])],
  validate,
  updatePreferences
)

router.patch(
  '/avatar',
  verifyToken,
  [body('storageKey').isString().notEmpty()],
  validate,
  confirmAvatar
)

// Public — consumes a password-reset link emailed to a bulk-imported user
// (see bulkImportController.js) or one an Admin issued via /users/:id/reset-password.
router.get('/reset-password/:token', loginLimiter, checkResetToken)
router.post(
  '/reset-password',
  loginLimiter,
  [
    body('token').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  validate,
  applyResetToken
)

export default router
