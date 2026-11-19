import { Router } from 'express'
import { body } from 'express-validator'
import express from 'express'
import {
  createPresignedUpload,
  receiveMockUpload,
  serveUploadedFile
} from '../controllers/uploadController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.post(
  '/presign',
  verifyToken,
  requireRole('Admin', 'Coordinator', 'Member'),
  [
    body('fileType').isIn([
      'Agenda',
      'MoM',
      'Photo',
      'Avatar',
      'Logo',
      'NoticeAttachment',
      'NewsPhoto',
      'WorkProof',
      'MailAttachment'
    ]),
    body('fileName').isString().trim().notEmpty(),
    body('mimeType').isString().trim().notEmpty()
  ],
  validate,
  createPresignedUpload
)

// Mock "bucket" endpoints. In production these calls would go straight to
// S3 and never touch this API process; they're implemented here purely so
// the whole presigned-URL flow is runnable without external cloud creds.
router.put('/mock/:key', verifyToken, express.raw({ limit: '15mb', type: '*/*' }), receiveMockUpload)

// Deliberately NOT behind verifyToken: this mirrors how a real S3 presigned
// GET URL works — the browser renders it directly in <img src>, which can't
// attach an Authorization header. Security comes from storageKey being an
// unguessable UUID-bearing path, the same trust model a signed query string
// would provide.
router.get('/file/:key', serveUploadedFile)

export default router
