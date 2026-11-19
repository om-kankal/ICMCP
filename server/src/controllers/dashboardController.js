import Committee from '../models/Committee.js'
import Meeting from '../models/Meeting.js'
import Notice from '../models/Notice.js'
import NewsEvent from '../models/NewsEvent.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { computeCommitteeCompliance, tallyStatuses } from '../utils/compliance.js'

/**
 * GET /api/dashboard/metrics
 *
 * Computes, from live data:
 *  - totalCommittees, overallCompliance, pendingMeetings, overdueEscalations
 *  - statusDistribution — {compliant, due, overdue} counts, for the donut chart
 *  - quarterly — conducted-meeting counts per quarter, for the bar chart
 *  - totalScheduled / totalConducted — raw meeting-lifecycle counts across
 *    every committee, for the admin's at-a-glance activity summary
 */
export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const committees = await Committee.find({ isActive: true }).lean()
  const meetings = await Meeting.find({
    committeeRef: { $in: committees.map((c) => c._id) }
  })
    .select('committeeRef status actualDate scheduledDate academicYear quarter')
    .lean()

  const meetingsByCommittee = meetings.reduce((acc, m) => {
    const key = m.committeeRef.toString()
    ;(acc[key] ||= []).push(m)
    return acc
  }, {})

  const complianceList = committees.map((committee) =>
    computeCommitteeCompliance(committee, meetingsByCommittee[committee._id.toString()] || [])
  )

  const distribution = tallyStatuses(complianceList)

  const overallCompliance = complianceList.length
    ? Math.round(
        (complianceList.reduce((sum, c) => sum + c.progress, 0) / complianceList.length) * 10
      ) / 10
    : 0

  const pendingMeetings = complianceList.filter((c) => c.status !== 'compliant').length
  const overdueEscalations = distribution.overdue

  const totalScheduled = meetings.filter((m) => m.status === 'Scheduled').length
  const totalConducted = meetings.filter((m) => m.status === 'Conducted').length

  // Quarter-wise breakdown of *conducted* meetings only — a merely scheduled
  // meeting hasn't happened yet, so it shouldn't count toward "how compliant
  // were we when this quarter closed."
  const quarterlyMap = new Map()
  for (const m of meetings) {
    if (m.status !== 'Conducted') continue
    if (!quarterlyMap.has(m.quarter)) {
      quarterlyMap.set(m.quarter, { quarter: m.quarter, meetingsLogged: 0 })
    }
    quarterlyMap.get(m.quarter).meetingsLogged += 1
  }
  const quarterly = [...quarterlyMap.values()].sort((a, b) => a.quarter.localeCompare(b.quarter))

  res.status(200).json({
    success: true,
    data: {
      totalCommittees: committees.length,
      overallCompliance,
      pendingMeetings,
      overdueEscalations,
      totalScheduled,
      totalConducted,
      statusDistribution: distribution,
      quarterly
    }
  })
})

/**
 * GET /api/dashboard/feed
 *
 * The "current news & updates" panel shown on every user's dashboard:
 * scheduled meetings, notices, and news/events/announcements, merged into
 * one reverse-chronological feed. Admins see everything; Coordinators/
 * Members only see items for committees they belong to plus institution-
 * wide (committeeRef: null) posts.
 */
export const getUpdatesFeed = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'Admin'
  let committeeIds = []
  if (!isAdmin) {
    const me = await User.findById(req.user.id).select('committeeRefs')
    committeeIds = me.committeeRefs
  }
  const visibilityFilter = isAdmin ? {} : { $or: [{ committeeRef: null }, { committeeRef: { $in: committeeIds } }] }

  const [meetings, notices, newsEvents] = await Promise.all([
    Meeting.find({
      status: 'Scheduled',
      ...(isAdmin ? {} : { committeeRef: { $in: committeeIds } })
    })
      .populate('committeeRef', 'name')
      .sort({ scheduledDate: 1 })
      .limit(10)
      .lean(),
    Notice.find({ isActive: true, ...visibilityFilter })
      .populate('postedBy', 'name')
      .populate('committeeRef', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    NewsEvent.find({ isActive: true, ...visibilityFilter })
      .populate('postedBy', 'name')
      .populate('committeeRef', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
  ])

  const feed = [
    ...meetings.map((m) => ({
      id: m._id,
      kind: 'meeting',
      title: `${m.committeeRef?.name || 'Committee'} meeting scheduled`,
      detail: m.venue ? `${m.type} · ${m.venue}` : m.type,
      committeeName: m.committeeRef?.name || null,
      date: m.scheduledDate,
      sortDate: m.scheduledDate
    })),
    ...notices.map((n) => ({
      id: n._id,
      kind: 'notice',
      title: n.title,
      detail: n.content,
      priority: n.priority,
      committeeName: n.committeeRef?.name || null,
      postedBy: n.postedBy?.name || null,
      date: n.createdAt,
      sortDate: n.createdAt
    })),
    ...newsEvents.map((post) => ({
      id: post._id,
      kind: post.category.toLowerCase(), // 'news' | 'event' | 'announcement'
      title: post.title,
      detail: post.content,
      committeeName: post.committeeRef?.name || null,
      postedBy: post.postedBy?.name || null,
      eventDate: post.eventDate,
      location: post.location,
      date: post.createdAt,
      sortDate: post.eventDate || post.createdAt
    }))
  ].sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))

  res.status(200).json({ success: true, data: feed.slice(0, 20) })
})
