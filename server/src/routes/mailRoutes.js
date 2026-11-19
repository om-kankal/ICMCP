import { Router } from 'express'
import { body, query, param } from 'express-validator'
import {
  listMail,
  getUnreadCount,
  searchContacts,
  getMailThread,
  createMail,
  updateDraft,
  sendDraft,
  updateMailState,
  permanentlyDeleteMail
} from '../controllers/mailController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Any signed-in role — Admin, Coordinator, or Member — can use Mail.
router.use(verifyToken, requireRole('Admin', 'Coordinator', 'Member'))

// SECURITY (defense-in-depth): the global 1MB JSON body-size limit bounds
// total request size, but not the *number* of elements in these
// array-typed fields specifically. `createMail`/`sendDraft` do an
// `insertMany` fan-out over every recipient (`fanOutSentStates`), so
// bounding array length keeps a single request from being able to trigger
// an oversized fan-out even within the 1MB cap (e.g. many short ObjectIds).
const MAX_RECIPIENTS = 200
const MAX_ATTACHMENTS = 20

const attachmentValidators = [
  body('attachments').optional().isArray({ max: MAX_ATTACHMENTS }),
  body('attachments.*.storageKey').optional().isString().notEmpty(),
  body('attachments.*.originalName').optional().isString().notEmpty(),
  body('attachments.*.mimeType').optional().isString().notEmpty(),
  body('attachments.*.sizeBytes').optional().isInt({ min: 0 })
]

router.get(
  '/',
  [
    query('folder').optional().isIn(['inbox', 'sent', 'draft', 'archive', 'trash', 'starred']),
    query('q').optional().isString().isLength({ max: 200 })
  ],
  validate,
  listMail
)

router.get('/unread-count', getUnreadCount)

router.get('/contacts', [query('q').optional().isString().isLength({ max: 120 })], validate, searchContacts)

router.get('/:id', [param('id').isMongoId()], validate, getMailThread)

router.post(
  '/',
  [
    body('to').optional().isArray({ max: MAX_RECIPIENTS }),
    body('to.*').optional().isMongoId(),
    body('cc').optional().isArray({ max: MAX_RECIPIENTS }),
    body('cc.*').optional().isMongoId(),
    body('bcc').optional().isArray({ max: MAX_RECIPIENTS }),
    body('bcc.*').optional().isMongoId(),
    body('subject').optional().isString().isLength({ max: 300 }),
    body('body').optional().isString().isLength({ max: 50000 }),
    body('isDraft').optional().isBoolean(),
    body('replyToMailId').optional({ checkFalsy: true }).isMongoId(),
    ...attachmentValidators
  ],
  validate,
  createMail
)

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('to').optional().isArray({ max: MAX_RECIPIENTS }),
    body('to.*').optional().isMongoId(),
    body('cc').optional().isArray({ max: MAX_RECIPIENTS }),
    body('cc.*').optional().isMongoId(),
    body('bcc').optional().isArray({ max: MAX_RECIPIENTS }),
    body('bcc.*').optional().isMongoId(),
    body('subject').optional().isString().isLength({ max: 300 }),
    body('body').optional().isString().isLength({ max: 50000 }),
    ...attachmentValidators
  ],
  validate,
  updateDraft
)

router.post('/:id/send', [param('id').isMongoId()], validate, sendDraft)

router.patch(
  '/:id/state',
  [
    param('id').isMongoId(),
    body('isRead').optional().isBoolean(),
    body('isStarred').optional().isBoolean(),
    body('folder').optional().isIn(['inbox', 'archive', 'trash', 'restore'])
  ],
  validate,
  updateMailState
)

router.delete('/:id', [param('id').isMongoId()], validate, permanentlyDeleteMail)

export default router
