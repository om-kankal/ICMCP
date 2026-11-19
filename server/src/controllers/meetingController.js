import mongoose from 'mongoose'
import Meeting from '../models/Meeting.js'
import Committee from '../models/Committee.js'
import Document from '../models/Document.js'
import UploadTicket from '../models/UploadTicket.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { isVisibleToUser } from '../utils/committeeAccess.js'

/** Notifies every user assigned to the committee, plus every Admin. */
async function notifyCommitteeAndAdmins(committee, { title, message, type, level = 'info', meetingId }) {
  const admins = await User.find({ role: 'Admin', isActive: true }).select('_id')
  const recipientIds = new Set([
    ...committee.coordinatorRefs.map((id) => id.toString()),
    ...committee.memberRefs.map((id) => id.toString()),
    ...admins.map((a) => a._id.toString())
  ])

  await Notification.insertMany(
    [...recipientIds].map((recipientRef) => ({
      recipientRef,
      committeeRef: committee._id,
      meetingRef: meetingId || null,
      type,
      title,
      message,
      level
    }))
  )
}

/**
 * POST /api/meetings/schedule — Admin or an assigned Coordinator.
 * Notifies every Coordinator/Member on the committee, plus every Admin.
 */
export const scheduleMeeting = asyncHandler(async (req, res) => {
  const { committeeRef, scheduledDate, venue, type, quarter, academicYear, agendaItems = [] } = req.body

  const committee = await Committee.findById(committeeRef)
  if (!committee) throw ApiError.notFound('Committee not found')
  if (req.user.role !== 'Admin' && !isVisibleToUser(committee, req.user)) {
    throw ApiError.forbidden('You are not assigned as a Coordinator for this committee')
  }

  const meeting = await Meeting.create({
    committeeRef,
    scheduledDate,
    venue,
    type,
    quarter,
    academicYear,
    agendaItems,
    scheduledBy: req.user.id
  })

  await notifyCommitteeAndAdmins(committee, {
    title: `New meeting scheduled: ${committee.name}`,
    message: `A ${type} meeting has been scheduled for ${new Date(scheduledDate).toDateString()}${venue ? ` at ${venue}` : ''}.`,
    type: 'meeting_scheduled',
    level: 'info',
    meetingId: meeting._id
  })

  res.status(201).json({ success: true, data: meeting })
})

/**
 * PATCH /api/meetings/:id/schedule-details — Admin or assigned Coordinator.
 * Edits a still-Scheduled meeting's venue/date/agenda — used by the
 * preview-and-edit flow before Notice/Agenda documents are regenerated.
 */
export const updateScheduleDetails = asyncHandler(async (req, res) => {
  const { scheduledDate, venue, type, agendaItems } = req.body
  const meeting = await Meeting.findById(req.params.id).populate('committeeRef')
  if (!meeting) throw ApiError.notFound('Meeting not found')
  if (meeting.status !== 'Scheduled') {
    throw ApiError.badRequest('Only a Scheduled meeting\'s details can be edited this way')
  }
  if (req.user.role !== 'Admin' && !isVisibleToUser(meeting.committeeRef, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }

  if (scheduledDate) meeting.scheduledDate = scheduledDate
  if (venue !== undefined) meeting.venue = venue
  if (type) meeting.type = type
  if (agendaItems) meeting.agendaItems = agendaItems
  await meeting.save()

  res.status(200).json({ success: true, data: meeting })
})

/**
 * PATCH /api/meetings/:id/conduct — Admin or an assigned Coordinator/Member.
 */
export const conductMeeting = asyncHandler(async (req, res) => {
  const {
    actualDate,
    membersPresent = [],
    membersAbsent = [],
    minutesText = '',
    actionTakenItems = [],
    files = []
  } = req.body

  const meeting = await Meeting.findById(req.params.id).populate('committeeRef')
  if (!meeting) throw ApiError.notFound('Meeting not found')
  if (meeting.status === 'Conducted') {
    throw ApiError.conflict('This meeting has already been conducted')
  }
  if (req.user.role !== 'Admin' && !isVisibleToUser(meeting.committeeRef, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }
  if (files.length === 0) {
    throw ApiError.badRequest('At least one supporting document is required to conduct a meeting')
  }

  let session = null
  let useTransaction = true
  try {
    session = await mongoose.startSession()
  } catch {
    useTransaction = false
  }

  const applyConduct = async (opts) => {
    const documentIds = []
    for (const file of files) {
      const ticketQuery = UploadTicket.findOne({ storageKey: file.storageKey })
      const ticket = opts.session ? await ticketQuery.session(opts.session) : await ticketQuery
      if (!ticket || !ticket.consumed) {
        throw ApiError.badRequest(
          `File "${file.originalName || file.storageKey}" was never uploaded via a valid presigned URL`
        )
      }
      const [doc] = await Document.create(
        [
          {
            meetingRef: meeting._id,
            fileType: file.fileType,
            originalName: file.originalName || ticket.originalName,
            cloudUrl: `/api/uploads/file/${encodeURIComponent(file.storageKey)}`,
            storageKey: file.storageKey,
            mimeType: file.mimeType || ticket.mimeType,
            uploadedBy: req.user.id
          }
        ],
        opts
      )
      documentIds.push(doc._id)
    }

    meeting.status = 'Conducted'
    meeting.actualDate = actualDate
    meeting.membersPresent = membersPresent
    meeting.membersAbsent = membersAbsent
    meeting.minutesText = minutesText
    meeting.actionTakenItems = actionTakenItems
    meeting.files = documentIds
    meeting.conductedBy = req.user.id
    await meeting.save(opts)
  }

  try {
    if (useTransaction) {
      await session.withTransaction(async () => {
        await applyConduct({ session })
      })
    } else {
      await applyConduct({})
    }
  } catch (err) {
    if (useTransaction && /Transaction numbers are only allowed/i.test(err.message)) {
      await applyConduct({})
    } else {
      throw err
    }
  } finally {
    if (session) session.endSession()
  }

  const populated = await Meeting.findById(meeting._id).populate('files')
  res.status(200).json({ success: true, data: populated })
})

/**
 * PATCH /api/meetings/:id/minutes-details — Admin or assigned
 * Coordinator/Member. Edits a Conducted meeting's minutes/action items
 * without re-uploading files — used by the preview-and-edit flow before the
 * Minutes of Meeting document is regenerated.
 */
export const updateMinutesDetails = asyncHandler(async (req, res) => {
  const { minutesText, actionTakenItems, membersPresent, membersAbsent } = req.body
  const meeting = await Meeting.findById(req.params.id).populate('committeeRef')
  if (!meeting) throw ApiError.notFound('Meeting not found')
  // Minutes can now be drafted before the meeting takes place (MoM Maker),
  // same as Agenda — the Conducted-only gate here previously blocked that.
  // Marking a meeting Conducted itself is unchanged: still only happens via
  // PATCH /:id/conduct (conductMeeting, used by the Conduct Meeting page).
  if (req.user.role !== 'Admin' && !isVisibleToUser(meeting.committeeRef, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }

  if (minutesText !== undefined) meeting.minutesText = minutesText
  if (actionTakenItems) meeting.actionTakenItems = actionTakenItems
  if (membersPresent) meeting.membersPresent = membersPresent
  if (membersAbsent) meeting.membersAbsent = membersAbsent
  await meeting.save()

  res.status(200).json({ success: true, data: meeting })
})

/**
 * GET /api/meetings?committeeRef=&status=&sort=asc|desc
 * Admins see every meeting; Coordinators/Members only meetings for
 * committees they're assigned to.
 */
export const listMeetings = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.committeeRef) filter.committeeRef = req.query.committeeRef
  if (req.query.status) filter.status = req.query.status

  if (req.user.role !== 'Admin') {
    const myCommittees = await Committee.find({
      $or: [{ coordinatorRefs: req.user.id }, { memberRefs: req.user.id }]
    }).select('_id')
    filter.committeeRef = { $in: myCommittees.map((c) => c._id) }
  }

  const sortDir = req.query.sort === 'asc' ? 1 : -1
  const sortField = filter.status === 'Conducted' ? 'actualDate' : 'scheduledDate'

  const meetings = await Meeting.find(filter)
    .populate('files')
    .populate('committeeRef', 'name')
    .populate('scheduledBy', 'name')
    .populate('conductedBy', 'name')
    .sort({ [sortField]: sortDir })
    .lean()

  res.status(200).json({ success: true, data: meetings })
})

/** GET /api/meetings/:id */
export const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id)
    .populate('files')
    .populate('committeeRef')
    .populate('scheduledBy', 'name')
    .populate('conductedBy', 'name')
  if (!meeting) throw ApiError.notFound('Meeting not found')
  if (req.user.role !== 'Admin' && !isVisibleToUser(meeting.committeeRef, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }
  res.status(200).json({ success: true, data: meeting })
})
