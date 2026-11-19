import { Router } from 'express'
import { body } from 'express-validator'
import { getSettings, updateInstitutionalSettings, updateCollegeLogo } from '../controllers/settingsController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Public and read-only: institution name/tagline, logo URL, and legal-doc
// links are branding info, not sensitive data — the Login page (pre-auth)
// needs this too. Every write below stays behind verifyToken + Admin-only.
router.get('/', getSettings)

router.patch(
  '/',
  verifyToken,
  requireRole('Admin'),
  [
    // Multi-line institution name — validated on total length, not line count.
    body('collegeName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 400 }),
    body('tosUrl')
      .optional({ checkFalsy: true })
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('Terms of Service must be a valid http(s) URL')
      .isLength({ max: 500 }),
    body('privacyUrl')
      .optional({ checkFalsy: true })
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('Privacy Policy must be a valid http(s) URL')
      .isLength({ max: 500 })
  ],
  validate,
  updateInstitutionalSettings
)

router.patch(
  '/logo',
  verifyToken,
  requireRole('Admin'),
  [body('storageKey').isString().trim().notEmpty()],
  validate,
  updateCollegeLogo
)

export default router
