import NewsEvent from '../models/NewsEvent.js'
import Committee from '../models/Committee.js'
import User from '../models/User.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { isVisibleToUser } from '../utils/committeeAccess.js'

/**
 * GET /api/news
 * Admins see every post. Coordinators/Members see institution-wide posts
 * (committeeRef: null) plus posts for committees they're assigned to.
 * Optional ?category=News|Event|Announcement filter.
 */
export const listNewsEvents = asyncHandler(async (req, res) => {
  const filter = { isActive: true }
  if (req.query.category) filter.category = req.query.category

  if (req.user.role !== 'Admin') {
    const user = await User.findById(req.user.id).select('committeeRefs')
    filter.$or = [{ committeeRef: null }, { committeeRef: { $in: user.committeeRefs } }]
  }

  const posts = await NewsEvent.find(filter)
    .populate('postedBy', 'name role designation')
    .populate('committeeRef', 'name')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  res.status(200).json({ success: true, data: posts })
})

/** POST /api/news — Admin or Coordinator. */
export const createNewsEvent = asyncHandler(async (req, res) => {
  const { category, title, content, eventDate, location, committeeId, photoUrl } = req.body

  if (category === 'Event' && !eventDate) {
    throw ApiError.badRequest('eventDate is required for an Event post')
  }

  if (committeeId) {
    const committee = await Committee.findById(committeeId)
    if (!committee) throw ApiError.badRequest('Committee not found')
    if (req.user.role !== 'Admin' && !isVisibleToUser(committee, req.user)) {
      throw ApiError.forbidden('You can only post for your own committees')
    }
  }

  const post = await NewsEvent.create({
    category,
    title,
    content,
    eventDate: eventDate || null,
    location: location || '',
    committeeRef: committeeId || null,
    postedBy: req.user.id,
    photoUrl: photoUrl || null
  })

  const populated = await post.populate([
    { path: 'postedBy', select: 'name role designation' },
    { path: 'committeeRef', select: 'name' }
  ])

  res.status(201).json({ success: true, data: populated })
})

/** PATCH /api/news/:id — Admin, or the Coordinator who posted it. */
export const updateNewsEvent = asyncHandler(async (req, res) => {
  const post = await NewsEvent.findById(req.params.id)
  if (!post) throw ApiError.notFound('Post not found')
  if (req.user.role !== 'Admin' && post.postedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only edit posts you created')
  }

  const { title, content, eventDate, location } = req.body
  if (title !== undefined) post.title = title
  if (content !== undefined) post.content = content
  if (eventDate !== undefined) post.eventDate = eventDate
  if (location !== undefined) post.location = location

  await post.save()
  res.status(200).json({ success: true, data: post })
})

/** DELETE /api/news/:id — Admin, or the Coordinator who posted it (soft delete). */
export const deleteNewsEvent = asyncHandler(async (req, res) => {
  const post = await NewsEvent.findById(req.params.id)
  if (!post) throw ApiError.notFound('Post not found')
  if (req.user.role !== 'Admin' && post.postedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('You can only remove posts you created')
  }

  post.isActive = false
  await post.save()
  res.status(200).json({ success: true, message: 'Post removed' })
})
