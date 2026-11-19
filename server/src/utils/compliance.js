const DUE_SOON_WINDOW_DAYS = 14

/**
 * Derives a committee's live compliance snapshot from its meeting history.
 * Only 'Conducted' meetings count toward compliance — a merely 'Scheduled'
 * meeting doesn't satisfy the statutory requirement until it's actually held.
 *
 * @param {import('../models/Committee.js').default} committee
 * @param {Array} meetingsForCommittee — all meetings (any status) for this committee
 */
export function computeCommitteeCompliance(committee, meetingsForCommittee) {
  const now = new Date()
  const conducted = meetingsForCommittee.filter((m) => m.status === 'Conducted')
  const scheduled = meetingsForCommittee.filter((m) => m.status === 'Scheduled')

  const sortedConducted = [...conducted].sort(
    (a, b) => new Date(b.actualDate) - new Date(a.actualDate)
  )
  const lastMeeting = sortedConducted[0]?.actualDate ?? null

  const cadenceDays = committee.meetingCadenceDays || 90
  const nextDue = lastMeeting
    ? new Date(new Date(lastMeeting).getTime() + cadenceDays * 24 * 60 * 60 * 1000)
    : new Date(committee.createdAt)

  const meetingsHeld = conducted.filter((m) => m.academicYear === committee.academicYear).length
  const meetingsRequired = committee.meetingsRequiredPerYear || 4
  const progress = Math.min(100, Math.round((meetingsHeld / meetingsRequired) * 100))

  let status
  const msUntilDue = nextDue.getTime() - now.getTime()
  if (msUntilDue < 0) {
    status = 'overdue'
  } else if (msUntilDue <= DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    status = 'due'
  } else {
    status = 'compliant'
  }

  const upcomingScheduled = scheduled
    .filter((m) => new Date(m.scheduledDate) >= now)
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
    .map((m) => ({ id: m._id, scheduledDate: m.scheduledDate, type: m.type }))

  const overdueScheduled = scheduled
    .filter((m) => new Date(m.scheduledDate) < now)
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
    .map((m) => ({ id: m._id, scheduledDate: m.scheduledDate, type: m.type }))

  return {
    lastMeeting,
    nextDue,
    progress,
    status,
    meetingsHeld,
    meetingsRequired,
    conductedCount: conducted.length,
    upcomingScheduled,
    overdueScheduled
  }
}

export function tallyStatuses(complianceList) {
  return complianceList.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    },
    { compliant: 0, due: 0, overdue: 0 }
  )
}
