import { Router } from 'express'
import { body } from 'express-validator'
import {
  scheduleMeeting,
  updateScheduleDetails,
  conductMeeting,
  updateMinutesDetails,
  listMeetings,
  getMeeting
} from '../controllers/meetingController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// SECURITY (defense-in-depth): bound array-typed field lengths so a
// single request can't submit an unbounded number of agenda/attendance/
// action items even within the global 1MB JSON body-size cap.
const MAX_LIST_ITEMS = 200
const MAX_FILES = 20

router.use(verifyToken)

router.get('/', listMeetings)
router.get('/:id', getMeeting)

router.post(
  '/schedule',
  requireRole('Admin', 'Coordinator'),
  [
    body('committeeRef').isMongoId().withMessage('A valid committeeRef is required'),
    body('scheduledDate').isISO8601().withMessage('scheduledDate must be a valid date'),
    body('venue').optional({ checkFalsy: true }).isString().trim().isLength({ max: 200 }),
    body('type').isIn(['Regular Quarterly', 'Ad-hoc / Special']),
    body('quarter').trim().notEmpty(),
    body('academicYear').matches(/^\d{4}-\d{2}$/),
    body('agendaItems').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('agendaItems.*').optional().isString().trim().notEmpty()
  ],
  validate,
  scheduleMeeting
)

router.patch(
  '/:id/schedule-details',
  requireRole('Admin', 'Coordinator'),
  [
    body('scheduledDate').optional().isISO8601(),
    body('venue').optional({ checkFalsy: true }).isString().trim().isLength({ max: 200 }),
    body('type').optional().isIn(['Regular Quarterly', 'Ad-hoc / Special']),
    body('agendaItems').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('agendaItems.*').optional().isString().trim().notEmpty()
  ],
  validate,
  updateScheduleDetails
)

router.patch(
  '/:id/conduct',
  requireRole('Admin', 'Coordinator', 'Member'),
  [
    body('actualDate').isISO8601().withMessage('actualDate must be a valid date'),
    body('membersPresent').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('membersAbsent').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('minutesText').optional().isString(),
    body('actionTakenItems').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('actionTakenItems.*.item').optional().isString().trim().notEmpty(),
    body('files').isArray({ min: 1, max: MAX_FILES }).withMessage('At least one supporting document is required'),
    body('files.*.fileType').isIn(['Agenda', 'MoM', 'Photo']),
    body('files.*.storageKey').isString().notEmpty()
  ],
  validate,
  conductMeeting
)

router.patch(
  '/:id/minutes-details',
  requireRole('Admin', 'Coordinator', 'Member'),
  [
    body('minutesText').optional().isString(),
    body('actionTakenItems').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('actionTakenItems.*.item').optional().isString().trim().notEmpty(),
    body('membersPresent').optional().isArray({ max: MAX_LIST_ITEMS }),
    body('membersAbsent').optional().isArray({ max: MAX_LIST_ITEMS })
  ],
  validate,
  updateMinutesDetails
)

export default router
