import { Router } from 'express'
import { body, query } from 'express-validator'
import {
  uploadMiddleware,
  analyzeBulkImport,
  commitBulkImport,
  exportCommitteesExcel,
  exportDraftFromBatch,
  listAcademicYears
} from '../controllers/bulkImportController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.use(verifyToken, requireRole('Admin'))

router.get('/academic-years', listAcademicYears)

// Step 1: upload the sheet (+ which academic year it's for), get back a
// per-row analysis. Writes nothing yet.
router.post('/bulk-import/analyze', uploadMiddleware, analyzeBulkImport)

// Lets the Admin download what /analyze parsed, to fix in Excel and
// re-upload — the "download & edit" option alongside editing inline.
router.get(
  '/bulk-import/export-draft',
  [query('batchId').isMongoId()],
  validate,
  exportDraftFromBatch
)

// Step 2: apply a previously-analyzed batch (optionally with inline edits
// in body.rows — see commitBulkImport's sanitizeCommitRows).
router.post(
  '/bulk-import/commit',
  [body('batchId').isMongoId().withMessage('A valid batchId from /analyze is required')],
  validate,
  commitBulkImport
)

// Downloadable .xlsx export, same column shape as the import sheet.
router.get(
  '/bulk-import/export',
  [
    query('role').optional().isIn(['Coordinator', 'Member']),
    query('designation').optional().isString().trim().isLength({ max: 200 }),
    query('academicYear').optional().matches(/^\d{4}-\d{2}$/)
  ],
  validate,
  exportCommitteesExcel
)

export default router
