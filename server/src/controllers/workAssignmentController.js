import WorkAssignment from '../models/WorkAssignment.js'
import Committee from '../models/Committee.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

/**
 * GET /api/work-assignments
 * Coordinators see every assignment they've created. Members see only
 * assignments made to them — never another member's, even in the same
 * committee. There is no "see everything" mode: this route is not
 * reachable by Admin at all (blocked at the router level).
 */
export const listWorkAssignments = asyncHandler(async (req, res) => {
  const filter =
    req.user.role === 'Coordinator'
      ? { assignedBy: req.user.id, isActive: true }
      : { assignedTo: req.user.id, isActive: true }

  const assignments = await WorkAssignment.find(filter)
    .populate('committeeRef', 'name')
    .populate('assignedTo', 'name designation avatarUrl')
    .populate('assignedBy', 'name designation')
    .sort({ createdAt: -1 })
    .lean()

  res.status(200).json({ success: true, data: assignments })
})

/** POST /api/work-assignments — Coordinator only. Must target a member of one of their own committees. */
export const createWorkAssignment = asyncHandler(async (req, res) => {
  const { committeeId, assignedTo, title, description, dueDate } = req.body

  const committee = await Committee.findOne({ _id: committeeId, isActive: true })
  if (!committee) throw ApiError.badRequest('Committee not found')

  const isOwnCommittee = committee.coordinatorRefs.some((id) => id.toString() === req.user.id)
  if (!isOwnCommittee) throw ApiError.forbidden('You can only assign work within committees you coordinate')

  const isMember = committee.memberRefs.some((id) => id.toString() === assignedTo)
  if (!isMember) throw ApiError.badRequest('That person is not a Member of this committee')

  const assignment = await WorkAssignment.create({
    committeeRef: committee._id,
    assignedTo,
    assignedBy: req.user.id,
    title,
    description,
    dueDate: dueDate || null
  })

  const populated = await assignment.populate([
    { path: 'committeeRef', select: 'name' },
    { path: 'assignedTo', select: 'name designation avatarUrl' },
    { path: 'assignedBy', select: 'name designation' }
  ])

  res.status(201).json({ success: true, data: populated })
})

/** PATCH /api/work-assignments/:id — Coordinator only, and only the one who created it (edits title/description/dueDate). */
export const updateWorkAssignment = asyncHandler(async (req, res) => {
  const assignment = await WorkAssignment.findById(req.params.id)
  if (!assignment) throw ApiError.notFound('Work assignment not found')
  if (assignment.assignedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only edit work you assigned')
  }

  const { title, description, dueDate } = req.body
  if (title !== undefined) assignment.title = title
  if (description !== undefined) assignment.description = description
  if (dueDate !== undefined) assignment.dueDate = dueDate || null

  await assignment.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, data: assignment })
})

/**
 * PATCH /api/work-assignments/:id/status — the assigned Member only.
 * Updates status and/or the optional proof (text and/or image).
 */
export const updateWorkAssignmentStatus = asyncHandler(async (req, res) => {
  const assignment = await WorkAssignment.findById(req.params.id)
  if (!assignment) throw ApiError.notFound('Work assignment not found')
  if (assignment.assignedTo.toString() !== req.user.id) {
    throw ApiError.forbidden('This work item was not assigned to you')
  }

  const { status, proofText, proofImageUrl } = req.body
  if (status !== undefined) assignment.status = status
  if (proofText !== undefined) assignment.proofText = proofText
  if (proofImageUrl !== undefined) assignment.proofImageUrl = proofImageUrl

  await assignment.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, data: assignment })
})

/** DELETE /api/work-assignments/:id — Coordinator only, and only the one who created it (soft delete). */
export const deleteWorkAssignment = asyncHandler(async (req, res) => {
  const assignment = await WorkAssignment.findById(req.params.id)
  if (!assignment) throw ApiError.notFound('Work assignment not found')
  if (assignment.assignedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only remove work you assigned')
  }

  assignment.isActive = false
  await assignment.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, message: 'Work assignment removed' })
})
