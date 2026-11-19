import Committee from '../models/Committee.js'
import Meeting from '../models/Meeting.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { computeCommitteeCompliance } from '../utils/compliance.js'
import { isVisibleToUser } from '../utils/committeeAccess.js'

const MEETING_COMPLIANCE_FIELDS = '_id committeeRef status actualDate scheduledDate academicYear type'

/**
 * GET /api/committees
 * Admins see every committee. Coordinators/Members only see committees
 * they've been assigned to.
 */
export const listCommittees = asyncHandler(async (req, res) => {
  const filter = { isActive: true }
  if (req.user.role !== 'Admin') {
    filter.$or = [{ coordinatorRefs: req.user.id }, { memberRefs: req.user.id }]
  }
  // Optional — the TopNav academic-year picker passes this so an Admin can
  // browse a past year's committees instead of only ever seeing the
  // current one; omitted, behavior is unchanged (every active committee).
  if (req.query.academicYear) {
    filter.academicYear = req.query.academicYear
  }

  const committees = await Committee.find(filter)
    .populate('coordinatorRefs', 'name email designation avatarUrl')
    .populate('memberRefs', 'name email designation avatarUrl')
    .sort({ name: 1 })
    .lean()

  const allMeetings = await Meeting.find({
    committeeRef: { $in: committees.map((c) => c._id) }
  })
    .select(MEETING_COMPLIANCE_FIELDS)
    .lean()

  const meetingsByCommittee = allMeetings.reduce((acc, m) => {
    const key = m.committeeRef.toString()
    ;(acc[key] ||= []).push(m)
    return acc
  }, {})

  const enriched = committees.map((committee) => {
    const compliance = computeCommitteeCompliance(
      committee,
      meetingsByCommittee[committee._id.toString()] || []
    )
    return {
      id: committee._id,
      name: committee.name,
      mandate: committee.type,
      academicYear: committee.academicYear,
      coordinators: committee.coordinatorRefs,
      members: committee.memberRefs,
      secretary: committee.coordinatorRefs?.[0]?.name || 'Unassigned',
      designation: committee.coordinatorRefs?.[0]?.designation || '',
      ...compliance
    }
  })

  res.status(200).json({ success: true, data: enriched })
})

/**
 * GET /api/committees/:id/overview
 * Full detail for the committee-detail page. Admins can view any committee;
 * Coordinators/Members only their own.
 */
export const getCommitteeOverview = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.id)
    .populate('coordinatorRefs', 'name email designation avatarUrl')
    .populate('memberRefs', 'name email designation avatarUrl')
  if (!committee) throw ApiError.notFound('Committee not found')
  if (!isVisibleToUser(committee, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }

  const meetings = await Meeting.find({ committeeRef: committee._id })
    .populate('files')
    .populate('scheduledBy', 'name')
    .populate('conductedBy', 'name')
    .sort({ scheduledDate: -1 })
    .lean()

  const compliance = computeCommitteeCompliance(committee, meetings)

  res.status(200).json({
    success: true,
    data: {
      ...committee.toObject(),
      ...compliance,
      scheduledMeetings: meetings.filter((m) => m.status === 'Scheduled'),
      conductedMeetings: meetings.filter((m) => m.status === 'Conducted')
    }
  })
})

/**
 * GET /api/committees/:id/meetings — flat meeting history.
 */
export const getCommitteeHistory = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.id)
  if (!committee) throw ApiError.notFound('Committee not found')
  if (!isVisibleToUser(committee, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }

  const meetings = await Meeting.find({ committeeRef: req.params.id })
    .populate('files')
    .populate('scheduledBy', 'name email')
    .populate('conductedBy', 'name email')
    .sort({ scheduledDate: -1 })
    .lean()

  res.status(200).json({ success: true, data: meetings })
})

/**
 * POST /api/committees — Admin only. coordinatorIds/memberIds must be real,
 * existing User accounts with the matching role.
 */
export const createCommittee = asyncHandler(async (req, res) => {
  const {
    name,
    type,
    department,
    academicYear,
    coordinatorIds = [],
    memberIds = [],
    meetingsRequiredPerYear,
    meetingCadenceDays
  } = req.body

  if (coordinatorIds.length === 0) {
    throw ApiError.badRequest('At least one Coordinator must be assigned')
  }

  const [coordinators, members] = await Promise.all([
    User.find({ _id: { $in: coordinatorIds }, role: 'Coordinator', isActive: true }),
    memberIds.length ? User.find({ _id: { $in: memberIds }, role: 'Member', isActive: true }) : []
  ])
  if (coordinators.length !== coordinatorIds.length) {
    throw ApiError.badRequest('One or more selected Coordinators are invalid')
  }
  if (members.length !== memberIds.length) {
    throw ApiError.badRequest('One or more selected Members are invalid')
  }

  const committee = await Committee.create({
    name,
    type,
    department: department || '',
    academicYear,
    coordinatorRefs: coordinatorIds,
    memberRefs: memberIds,
    meetingsRequiredPerYear: meetingsRequiredPerYear || 4,
    meetingCadenceDays: meetingCadenceDays || 90
  })

  await User.updateMany(
    { _id: { $in: [...coordinatorIds, ...memberIds] } },
    { $addToSet: { committeeRefs: committee._id } }
  )

  res.status(201).json({ success: true, data: committee })
})

/**
 * PATCH /api/committees/:id/members — Admin only. Re-assign the
 * coordinator/member roster after creation.
 */
export const updateCommitteeMembers = asyncHandler(async (req, res) => {
  const { coordinatorIds, memberIds } = req.body
  const committee = await Committee.findById(req.params.id)
  if (!committee) throw ApiError.notFound('Committee not found')

  if (coordinatorIds) {
    const coordinators = await User.find({ _id: { $in: coordinatorIds }, role: 'Coordinator', isActive: true })
    if (coordinators.length !== coordinatorIds.length) {
      throw ApiError.badRequest('One or more selected Coordinators are invalid')
    }
    committee.coordinatorRefs = coordinatorIds
  }
  if (memberIds) {
    const members = await User.find({ _id: { $in: memberIds }, role: 'Member', isActive: true })
    if (members.length !== memberIds.length) {
      throw ApiError.badRequest('One or more selected Members are invalid')
    }
    committee.memberRefs = memberIds
  }

  await committee.save()
  await User.updateMany(
    { _id: { $in: [...committee.coordinatorRefs, ...committee.memberRefs] } },
    { $addToSet: { committeeRefs: committee._id } }
  )

  res.status(200).json({ success: true, data: committee })
})

/**
 * PATCH /api/committees/:id — Admin only. Updates committee-level details
 * (name, type/mandate, academic year, cadence). Roster changes stay on the
 * dedicated /members endpoint above.
 */
export const updateCommittee = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.id)
  if (!committee) throw ApiError.notFound('Committee not found')

  const { name, type, department, academicYear, meetingsRequiredPerYear, meetingCadenceDays } = req.body
  if (name !== undefined) committee.name = name
  if (type !== undefined) committee.type = type
  if (department !== undefined) committee.department = department
  if (academicYear !== undefined) committee.academicYear = academicYear
  if (meetingsRequiredPerYear !== undefined) committee.meetingsRequiredPerYear = meetingsRequiredPerYear
  if (meetingCadenceDays !== undefined) committee.meetingCadenceDays = meetingCadenceDays

  await committee.save()
  res.status(200).json({ success: true, data: committee })
})

/**
 * DELETE /api/committees/:id — Admin only. Soft delete: keeps meeting/
 * document history intact but removes the committee from every list and
 * unlinks it from its members so it stops appearing on their dashboards.
 */
export const deleteCommittee = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.id)
  if (!committee) throw ApiError.notFound('Committee not found')

  committee.isActive = false
  await committee.save()

  await User.updateMany(
    { _id: { $in: [...committee.coordinatorRefs, ...committee.memberRefs] } },
    { $pull: { committeeRefs: committee._id } }
  )

  res.status(200).json({ success: true, message: 'Committee deleted' })
})

/**
 * POST /api/committees/:id/escalate — Admin only.
 */
export const escalateCommittee = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.id).populate('coordinatorRefs', 'name email')
  if (!committee) throw ApiError.notFound('Committee not found')

  const meetings = await Meeting.find({ committeeRef: committee._id }).select(MEETING_COMPLIANCE_FIELDS)
  const compliance = computeCommitteeCompliance(committee, meetings)

  if (compliance.status !== 'overdue') {
    throw ApiError.badRequest('Escalation is only available for overdue committees')
  }

  const recipients = committee.coordinatorRefs || []
  for (const coordinator of recipients) {
    await Notification.create({
      recipientRef: coordinator._id,
      committeeRef: committee._id,
      type: 'escalation',
      title: `Escalation: ${committee.name} is overdue`,
      message: 'An administrator has escalated this committee\'s compliance status. Please schedule and conduct a meeting as soon as possible.',
      level: 'overdue'
    })
  }

  const recipientLabel = recipients.map((c) => c.email).join(', ') || 'no coordinator assigned'
  console.log(`[escalation] ${committee.name} → ${recipientLabel} — overdue since ${compliance.nextDue.toISOString()}`)

  res.status(200).json({
    success: true,
    message: `Escalation notice sent to ${recipientLabel}`,
    data: { committeeId: committee._id, sentTo: recipientLabel, sentAt: new Date() }
  })
})
