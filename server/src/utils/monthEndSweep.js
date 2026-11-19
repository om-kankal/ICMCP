import Committee from '../models/Committee.js'
import Meeting from '../models/Meeting.js'
import Notification from '../models/Notification.js'

function previousMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1) // exclusive
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  return { start, end, periodKey }
}

/**
 * For every active committee, checks whether it had ANY meeting — scheduled
 * OR conducted — with a date falling in the calendar month that just ended.
 * If neither exists, notifies that committee's assigned Coordinators/Members
 * only (not Admins, per product decision). Idempotent per committee+period
 * via Notification.periodKey, so running this multiple times in the same
 * month never double-notifies.
 */
export async function runMonthEndActivitySweep(referenceDate = new Date()) {
  const { start, end, periodKey } = previousMonthRange(referenceDate)

  const committees = await Committee.find({ isActive: true })
  if (committees.length === 0) return { checked: 0, notified: 0 }

  let notifiedCount = 0

  for (const committee of committees) {
    const hadActivity = await Meeting.exists({
      committeeRef: committee._id,
      $or: [
        { scheduledDate: { $gte: start, $lt: end } },
        { actualDate: { $gte: start, $lt: end } }
      ]
    })
    if (hadActivity) continue

    const recipientIds = new Set([
      ...committee.coordinatorRefs.map((id) => id.toString()),
      ...committee.memberRefs.map((id) => id.toString())
    ])
    if (recipientIds.size === 0) continue

    const monthLabel = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

    for (const recipientId of recipientIds) {
      const exists = await Notification.exists({
        recipientRef: recipientId,
        committeeRef: committee._id,
        type: 'monthly_no_activity',
        periodKey
      })
      if (exists) continue

      await Notification.create({
        recipientRef: recipientId,
        committeeRef: committee._id,
        type: 'monthly_no_activity',
        periodKey,
        title: `${committee.name} had no meeting activity in ${monthLabel}`,
        message: `No meeting was scheduled or conducted for this committee during ${monthLabel}. Please schedule and conduct one as soon as possible.`,
        level: 'overdue'
      })
      notifiedCount += 1
    }
  }

  return { checked: committees.length, notified: notifiedCount }
}

/** Runs once daily — cheap enough given it only does real work once a new month begins. */
export function startMonthEndSweepTimer(intervalMs = 24 * 60 * 60 * 1000) {
  runMonthEndActivitySweep().catch((err) => console.error('[notifications] month-end sweep failed:', err.message))
  return setInterval(() => {
    runMonthEndActivitySweep().catch((err) => console.error('[notifications] month-end sweep failed:', err.message))
  }, intervalMs)
}
