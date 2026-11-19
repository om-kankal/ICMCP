import path from 'path'
import { fileURLToPath } from 'url'
import { Paragraph, TextRun } from 'docx'
import Meeting from '../models/Meeting.js'
import Committee from '../models/Committee.js'
import Document from '../models/Document.js'
import Settings from '../models/Settings.js'
import NewsEvent from '../models/NewsEvent.js'
import User from '../models/User.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { env } from '../config/env.js'
import { isVisibleToUser } from '../utils/committeeAccess.js'
import {
  letterhead,
  fieldLine,
  sectionHeading,
  bulletList,
  simpleTable,
  imageParagraph,
  buildDocxBuffer,
  sendDocx,
  formatDate
} from '../utils/docxBuilder.js'
import { computeCommitteeCompliance } from '../utils/compliance.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', env.uploadDir)

async function loadMeetingWithCommittee(meetingId, user) {
  const meeting = await Meeting.findById(meetingId)
    .populate({ path: 'committeeRef', populate: ['coordinatorRefs', 'memberRefs'] })
    .populate('files')
  if (!meeting) throw ApiError.notFound('Meeting not found')
  if (user.role !== 'Admin' && !isVisibleToUser(meeting.committeeRef, user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }
  return meeting
}

/** Absolute filesystem path to the uploaded college logo, and the (possibly
 * multi-line, Admin-editable) institution name — or the env fallback name
 * if the Admin hasn't set one. */
async function getBrandingInfo() {
  const settings = await Settings.getSingleton()
  return {
    logoPath: settings.collegeLogoStorageKey ? path.join(UPLOAD_ROOT, settings.collegeLogoStorageKey) : null,
    institutionName: settings.collegeName || env.institutionName
  }
}

/** Builds the ['Name', 'Designation', 'Role'] rows shared by Agenda and Report docs. */
function rosterRows(committee) {
  const coordinatorRows = (committee.coordinatorRefs || []).map((u) => [u.name, u.designation || '—', 'Coordinator'])
  const memberRows = (committee.memberRefs || []).map((u) => [u.name, u.designation || '—', 'Member'])
  return [...coordinatorRows, ...memberRows]
}

/** GET /api/documents/:meetingId/notice */
export const generateNotice = asyncHandler(async (req, res) => {
  const meeting = await loadMeetingWithCommittee(req.params.meetingId, req.user)
  const committee = meeting.committeeRef
  const { logoPath, institutionName } = await getBrandingInfo()

  const body = [
    ...letterhead('Notice / Circular', logoPath, institutionName),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `All members of the ${committee.name} are hereby notified that a meeting of the committee will be held as per the details below. Members are requested to make themselves available.`
        })
      ]
    }),
    fieldLine('Committee', committee.name),
    fieldLine('Mandate', committee.type),
    fieldLine('Meeting Type', meeting.type),
    fieldLine('Date', formatDate(meeting.scheduledDate)),
    fieldLine('Venue', meeting.venue),
    fieldLine('Academic Year', meeting.academicYear),
    sectionHeading('Agenda'),
    ...bulletList(meeting.agendaItems)
  ]

  const buffer = await buildDocxBuffer(body)
  sendDocx(res, `Notice_${committee.shortName || committee.name}_${meeting.quarter}.docx`, buffer)
})

/** GET /api/documents/:meetingId/agenda */
export const generateAgenda = asyncHandler(async (req, res) => {
  const meeting = await loadMeetingWithCommittee(req.params.meetingId, req.user)
  const committee = meeting.committeeRef
  const { logoPath, institutionName } = await getBrandingInfo()

  const body = [
    ...letterhead('Meeting Agenda', logoPath, institutionName),
    fieldLine('Committee', committee.name),
    fieldLine('Mandate', committee.type),
    fieldLine('Meeting Type', meeting.type),
    fieldLine('Date', formatDate(meeting.scheduledDate)),
    fieldLine('Venue', meeting.venue),
    fieldLine('Quarter', meeting.quarter),
    sectionHeading('Items for Discussion'),
    ...bulletList(meeting.agendaItems),
    sectionHeading('Committee Roster'),
    simpleTable(
      ['Name', 'Designation', 'Role'],
      rosterRows(committee),
      [40, 40, 20]
    )
  ]

  const buffer = await buildDocxBuffer(body)
  sendDocx(res, `Agenda_${committee.shortName || committee.name}_${meeting.quarter}.docx`, buffer)
})

/** GET /api/documents/:meetingId/mom — Minutes of Meeting, Action Taken Report, and photo annexure */
export const generateMinutes = asyncHandler(async (req, res) => {
  const meeting = await loadMeetingWithCommittee(req.params.meetingId, req.user)
  const committee = meeting.committeeRef
  const { logoPath, institutionName } = await getBrandingInfo()

  // Minutes can now be generated before the meeting takes place too (MoM
  // Maker, same as Agenda) — fields like actualDate/attendance simply
  // render blank/"—" until the meeting is actually conducted via the
  // unchanged Conduct Meeting flow.

  const photos = (meeting.files || []).filter((f) => f.fileType === 'Photo')

  const body = [
    ...letterhead('Minutes of Meeting', logoPath, institutionName),
    fieldLine('Committee', committee.name),
    fieldLine('Meeting Type', meeting.type),
    fieldLine('Date Held', formatDate(meeting.actualDate)),
    fieldLine('Venue', meeting.venue),
    fieldLine('Quarter', meeting.quarter),

    sectionHeading('Attendance'),
    simpleTable(
      ['Present', 'Absent'],
      Array.from({ length: Math.max(meeting.membersPresent.length, meeting.membersAbsent.length, 1) }).map(
        (_, i) => [meeting.membersPresent[i] || '', meeting.membersAbsent[i] || '']
      ),
      [50, 50]
    ),

    sectionHeading('Agenda Reviewed'),
    ...bulletList(meeting.agendaItems),

    sectionHeading('Proceedings / Minutes'),
    new Paragraph({ children: [new TextRun({ text: meeting.minutesText || 'No minutes recorded.' })] }),

    sectionHeading('Action Taken Report'),
    simpleTable(
      ['Action Item', 'Responsible', 'Status'],
      meeting.actionTakenItems.length
        ? meeting.actionTakenItems.map((a) => [a.item, a.responsible, a.status])
        : [['—', '—', '—']],
      [50, 30, 20]
    ),

    sectionHeading('Photographic Evidence (Annexure)'),
    ...(photos.length
      ? photos.flatMap((p) => imageParagraph(path.join(UPLOAD_ROOT, p.storageKey), p.originalName, p.mimeType))
      : [new Paragraph({ children: [new TextRun({ text: 'No photographs attached.', italics: true })] })])
  ]

  const buffer = await buildDocxBuffer(body)
  sendDocx(res, `MoM_${committee.shortName || committee.name}_${meeting.quarter}.docx`, buffer)
})

/** GET /api/documents/committee/:committeeId/report?academicYear=2026-27 */
export const generateCommitteeReport = asyncHandler(async (req, res) => {
  const committee = await Committee.findById(req.params.committeeId)
    .populate('coordinatorRefs')
    .populate('memberRefs')
  if (!committee) throw ApiError.notFound('Committee not found')
  if (req.user.role !== 'Admin' && !isVisibleToUser(committee, req.user)) {
    throw ApiError.forbidden('You are not assigned to this committee')
  }

  const academicYear = req.query.academicYear || committee.academicYear
  const meetings = await Meeting.find({ committeeRef: committee._id, academicYear }).sort({ scheduledDate: 1 })
  const compliance = computeCommitteeCompliance(committee, meetings)

  const conducted = meetings.filter((m) => m.status === 'Conducted')
  const scheduled = meetings.filter((m) => m.status === 'Scheduled')
  const { logoPath, institutionName } = await getBrandingInfo()

  const body = [
    ...letterhead(`Annual Compliance Report — ${academicYear}`, logoPath, institutionName),
    fieldLine('Committee', committee.name),
    fieldLine('Mandate / Type', committee.type),
    fieldLine('Academic Year', academicYear),
    fieldLine('Required Meetings / Year', String(committee.meetingsRequiredPerYear)),
    fieldLine('Meetings Conducted', String(conducted.length)),
    fieldLine('Compliance Status', compliance.status.toUpperCase()),

    sectionHeading('Meeting Log'),
    simpleTable(
      ['Date', 'Type', 'Status', 'Quarter'],
      meetings.length
        ? meetings.map((m) => [
            formatDate(m.actualDate || m.scheduledDate),
            m.type,
            m.status,
            m.quarter
          ])
        : [['—', '—', '—', '—']],
      [30, 25, 20, 25]
    ),

    sectionHeading('Committee Roster'),
    simpleTable(
      ['Name', 'Designation', 'Role'],
      rosterRows(committee),
      [40, 40, 20]
    ),

    sectionHeading('Statutory Compliance Note'),
    new Paragraph({
      children: [
        new TextRun({
          text: `Per NAAC/UGC/NBA quality-assurance norms, this committee is required to convene at least ${committee.meetingsRequiredPerYear} time(s) during the academic year, with agenda, minutes, and action-taken reports documented and retrievable. ${conducted.length} of ${committee.meetingsRequiredPerYear} required meetings have been conducted and evidenced in this system for ${academicYear}, with ${scheduled.length} meeting(s) currently scheduled but not yet held.`
        })
      ]
    })
  ]

  const buffer = await buildDocxBuffer(body)
  sendDocx(res, `ComplianceReport_${committee.shortName || committee.name}_${academicYear}.docx`, buffer)
})

// Committee.js doesn't define shortName; fall back gracefully everywhere above
// via `committee.shortName || committee.name` since it's always undefined —
// kept for forward-compatibility if a shortName field is added later.

/** GET /api/documents/news/:id — a News/Event/Announcement post, formatted like a Notice. */
export const generateNewsDocument = asyncHandler(async (req, res) => {
  const post = await NewsEvent.findOne({ _id: req.params.id, isActive: true })
    .populate('postedBy', 'name designation')
    .populate('committeeRef', 'name')
  if (!post) throw ApiError.notFound('Post not found')

  if (req.user.role !== 'Admin' && post.committeeRef) {
    const me = await User.findById(req.user.id).select('committeeRefs')
    const allowed = (me.committeeRefs || []).some((id) => id.toString() === post.committeeRef._id.toString())
    if (!allowed) throw ApiError.forbidden('You do not have access to this post')
  }

  const { logoPath, institutionName } = await getBrandingInfo()

  const body = [
    ...letterhead(post.category, logoPath, institutionName),
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: post.title, bold: true, size: 26 })]
    }),
    fieldLine('Category', post.category),
    fieldLine('Audience', post.committeeRef?.name || 'Institution-wide'),
    ...(post.category === 'Event'
      ? [
          fieldLine('Event Date', formatDate(post.eventDate)),
          ...(post.location ? [fieldLine('Location', post.location)] : [])
        ]
      : []),
    fieldLine('Posted By', post.postedBy?.name || 'Unknown'),
    fieldLine('Posted On', formatDate(post.createdAt)),
    sectionHeading('Details'),
    new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: post.content })] })
  ]

  const buffer = await buildDocxBuffer(body)
  sendDocx(res, `${post.category}_${post.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.docx`, buffer)
})
