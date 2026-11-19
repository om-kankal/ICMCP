import Notice from '../models/Notice.js'
import Committee from '../models/Committee.js'
import User from '../models/User.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { isVisibleToUser } from '../utils/committeeAccess.js'

/**
 * GET /api/notices
 * Admins see every notice. Coordinators/Members see general notices
 * (committeeRef: null) plus notices for committees they're assigned to.
 */
export const listNotices = asyncHandler(async (req, res) => {
  const filter = { isActive: true }

  if (req.user.role !== 'Admin') {
    const user = await User.findById(req.user.id).select('committeeRefs')
    filter.$or = [{ committeeRef: null }, { committeeRef: { $in: user.committeeRefs } }]
  }

  const notices = await Notice.find(filter)
    .populate('postedBy', 'name role designation')
    .populate('committeeRef', 'name')
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(200)
    .lean()

  res.status(200).json({ success: true, data: notices })
})

/** POST /api/notices — Admin or Coordinator. */
export const createNotice = asyncHandler(async (req, res) => {
  const { title, content, priority, committeeId, attachmentUrl, isPinned, expiresAt } = req.body

  if (committeeId) {
    const committee = await Committee.findById(committeeId)
    if (!committee) throw ApiError.badRequest('Committee not found')
    if (req.user.role !== 'Admin' && !isVisibleToUser(committee, req.user)) {
      throw ApiError.forbidden('You can only post notices for your own committees')
    }
  }

  const notice = await Notice.create({
    title,
    content,
    priority: priority || 'Normal',
    committeeRef: committeeId || null,
    postedBy: req.user.id,
    attachmentUrl: attachmentUrl || null,
    isPinned: !!isPinned,
    expiresAt: expiresAt || null
  })

  const populated = await notice.populate([
    { path: 'postedBy', select: 'name role designation' },
    { path: 'committeeRef', select: 'name' }
  ])

  res.status(201).json({ success: true, data: populated })
})

/** PATCH /api/notices/:id — Admin, or the Coordinator who posted it. */
export const updateNotice = asyncHandler(async (req, res) => {
  const notice = await Notice.findById(req.params.id)
  if (!notice) throw ApiError.notFound('Notice not found')
  if (req.user.role !== 'Admin' && notice.postedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only edit notices you posted')
  }

  const { title, content, priority, isPinned, expiresAt } = req.body
  if (title !== undefined) notice.title = title
  if (content !== undefined) notice.content = content
  if (priority !== undefined) notice.priority = priority
  if (isPinned !== undefined) notice.isPinned = isPinned
  if (expiresAt !== undefined) notice.expiresAt = expiresAt

  await notice.save()
  res.status(200).json({ success: true, data: notice })
})

/** DELETE /api/notices/:id — Admin, or the Coordinator who posted it (soft delete). */
export const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await Notice.findById(req.params.id)
  if (!notice) throw ApiError.notFound('Notice not found')
  if (req.user.role !== 'Admin' && notice.postedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only remove notices you posted')
  }

  notice.isActive = false
  await notice.save()
  res.status(200).json({ success: true, message: 'Notice removed' })
})
