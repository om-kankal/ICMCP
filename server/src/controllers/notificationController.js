import Notification from '../models/Notification.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { runOverdueMeetingSweep } from '../utils/notificationSweep.js'
import { runMonthEndActivitySweep } from '../utils/monthEndSweep.js'

/** GET /api/notifications — runs a fresh overdue sweep first so results are current. */
export const listNotifications = asyncHandler(async (req, res) => {
  await runOverdueMeetingSweep()

  const notifications = await Notification.find({ recipientRef: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  const unreadCount = await Notification.countDocuments({ recipientRef: req.user.id, isRead: false })

  res.status(200).json({ success: true, data: { notifications, unreadCount } })
})

/** PATCH /api/notifications/:id/read */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientRef: req.user.id },
    { isRead: true },
    { new: true }
  )
  if (!notification) throw ApiError.notFound('Notification not found')
  res.status(200).json({ success: true, data: notification })
})

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipientRef: req.user.id, isRead: false }, { isRead: true })
  res.status(200).json({ success: true, message: 'All notifications marked as read' })
})

/**
 * POST /api/notifications/run-month-end-check — Admin only, manual trigger.
 * The automatic sweep only does real work once a new calendar month begins,
 * so this lets an Admin verify the feature (or re-run it) without waiting.
 */
export const triggerMonthEndCheck = asyncHandler(async (req, res) => {
  const result = await runMonthEndActivitySweep()
  res.status(200).json({ success: true, data: result })
})
