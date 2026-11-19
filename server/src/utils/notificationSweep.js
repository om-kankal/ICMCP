import Meeting from '../models/Meeting.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'

/**
 * Finds every 'Scheduled' meeting whose scheduledDate has passed without
 * being conducted, and creates an 'overdue_meeting' notification for the
 * committee's assigned Coordinators/Members plus every Admin, unless one
 * already exists for that meeting — so re-running this doesn't spam
 * duplicates. Called on a timer from server.js and once synchronously
 * whenever a client asks for notifications, so it's never more than a few
 * minutes stale.
 */
export async function runOverdueMeetingSweep() {
  const now = new Date()
  const overdueMeetings = await Meeting.find({
    status: 'Scheduled',
    scheduledDate: { $lt: now }
  })
    .populate('committeeRef', 'name coordinatorRefs memberRefs')
    .populate('scheduledBy', 'name')

  if (overdueMeetings.length === 0) return { created: 0 }

  const admins = await User.find({ role: 'Admin', isActive: true }).select('_id')

  let created = 0
  for (const meeting of overdueMeetings) {
    const daysOverdue = Math.floor((now - meeting.scheduledDate) / (24 * 60 * 60 * 1000))
    const committeeName = meeting.committeeRef?.name || 'A committee'
    const title = `${committeeName} meeting is overdue`
    const message = `The meeting scheduled for ${meeting.scheduledDate.toDateString()} has not been conducted (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue). Please conduct it and log the minutes.`

    const recipientIds = new Set(admins.map((a) => a._id.toString()))
    if (meeting.scheduledBy) recipientIds.add(meeting.scheduledBy._id.toString())
    if (meeting.committeeRef) {
      meeting.committeeRef.coordinatorRefs?.forEach((id) => recipientIds.add(id.toString()))
      meeting.committeeRef.memberRefs?.forEach((id) => recipientIds.add(id.toString()))
    }

    for (const recipientId of recipientIds) {
      const exists = await Notification.exists({
        recipientRef: recipientId,
        meetingRef: meeting._id,
        type: 'overdue_meeting'
      })
      if (exists) continue

      await Notification.create({
        recipientRef: recipientId,
        committeeRef: meeting.committeeRef?._id,
        meetingRef: meeting._id,
        type: 'overdue_meeting',
        title,
        message,
        level: 'overdue'
      })
      created += 1
    }
  }

  return { created }
}

/** Kicks off the periodic sweep; safe to call once at server startup. */
export function startOverdueSweepTimer(intervalMs = 5 * 60 * 1000) {
  runOverdueMeetingSweep().catch((err) => console.error('[notifications] sweep failed:', err.message))
  return setInterval(() => {
    runOverdueMeetingSweep().catch((err) => console.error('[notifications] sweep failed:', err.message))
  }, intervalMs)
}
