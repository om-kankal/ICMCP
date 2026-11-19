import bcrypt from 'bcryptjs'
import multer from 'multer'
import User from '../models/User.js'
import Committee from '../models/Committee.js'
import BulkImportBatch from '../models/BulkImportBatch.js'
import PasswordResetToken from '../models/PasswordResetToken.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { env } from '../config/env.js'
import {
  parseImportWorkbook,
  buildExportWorkbook,
  workbookToBuffer,
  currentAcademicYear,
  EMAIL_RE
} from '../utils/bulkImportExcel.js'
import { sendWelcomeAccountEmail, generateResetToken, hashResetToken } from '../utils/mailer.js'

// Excel files only (.xlsx/.xls). 15 MB mirrors the ceiling already used for
// meeting-document uploads elsewhere in the app (uploadController.js).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const okMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ].includes(file.mimetype)
    const okExt = /\.(xlsx|xls)$/i.test(file.originalname || '')
    if (!okMime && !okExt) return cb(ApiError.badRequest('Please upload an Excel (.xlsx) file'))
    cb(null, true)
  }
})
export const uploadMiddleware = upload.single('file')

/** GET /api/admin/academic-years — Admin only. Powers the year picker in the UI. */
export const listAcademicYears = asyncHandler(async (req, res) => {
  const years = await Committee.distinct('academicYear')
  const current = currentAcademicYear()
  const all = [...new Set([...years, current])].sort()
  res.status(200).json({ success: true, data: { years: all, current } })
})

function diffPersonAgainstUser({ name, mail, department, role, userByEmail, userByName, emailToRole, rowIssues }) {
  const normalizedMail = (mail || '').toLowerCase().trim()
  const normalizedName = (name || '').toLowerCase().trim()
  const existing = userByEmail.get(normalizedMail) || userByName.get(normalizedName)
  const effectiveMail = existing ? existing.email : normalizedMail

  const priorRole = emailToRole.get(effectiveMail)
  if (priorRole && priorRole !== role) {
    rowIssues.push(`${effectiveMail} appears as both ${priorRole} and ${role} elsewhere in this sheet — using first occurrence (${priorRole})`)
  } else {
    emailToRole.set(effectiveMail, role)
  }
  const effectiveRole = priorRole || role

  if (!existing) {
    return { name, mail: effectiveMail, department, role: effectiveRole, action: 'create' }
  }
  if (existing.role === 'Admin') {
    rowIssues.push(`${effectiveMail} is the Admin account — left untouched, not assigned as ${effectiveRole}`)
    return { name: existing.name, mail: existing.email, department, role: 'Admin', action: 'skip-admin', userId: existing._id }
  }

  const changes = []
  if (existing.name !== name) changes.push(`name: "${existing.name}" → "${name}"`)
  if (existing.role !== effectiveRole) changes.push(`role: "${existing.role}" → "${effectiveRole}"`)
  if (department && existing.department !== department) changes.push(`department: "${existing.department || ''}" → "${department}"`)
  if (existing.isActive === false) changes.push('reactivate')

  return {
    name: existing.name || name,
    mail: existing.email,
    department: department || existing.department,
    role: effectiveRole,
    action: changes.length ? 'update' : 'unchanged',
    changes,
    userId: existing._id
  }
}

/**
 * Diffs the parsed sheet (grouped by committee) against the DB. Runs off a
 * handful of batched $in queries — never one query per row — so this scales
 * the same way at 5 committees or 500.
 */
async function diffCommittees(rawCommittees, academicYear) {
  const errors = []
  const validCommittees = []

  for (const c of rawCommittees) {
    const rowErrors = []
    if (!c.committeeName) rowErrors.push('Missing committee name')
    if (!c.coordinatorName) rowErrors.push('Missing co-ordinator name')
    if (!c.coordinatorMail || !EMAIL_RE.test(c.coordinatorMail)) rowErrors.push('Missing or invalid co-ordinator mail')
    if (rowErrors.length) {
      errors.push({ excelRow: c.excelRow, committeeName: c.committeeName, errors: rowErrors })
      continue
    }
    validCommittees.push(c)
  }

  const coordinatorEmails = [...new Set(validCommittees.map((c) => (c.coordinatorMail || '').toLowerCase()))].filter(Boolean)
  const memberEmails = [
    ...new Set(validCommittees.flatMap((c) => c.members.filter((m) => m.mail).map((m) => (m.mail || '').toLowerCase())))
  ].filter(Boolean)
  const allEmails = [...new Set([...coordinatorEmails, ...memberEmails])]
  const allNames = [
    ...new Set(validCommittees.flatMap((c) => [c.coordinatorName, ...c.members.map((m) => m.name)].filter(Boolean)))
  ]
  const committeeNames = [...new Set(validCommittees.map((c) => c.committeeName))]

  const [existingUsers, existingCommittees] = await Promise.all([
    User.find({
      $or: [{ email: { $in: allEmails } }, { name: { $in: allNames } }]
    }).select('name email role department isActive'),
    Committee.find({ name: { $in: committeeNames }, academicYear }).select('name coordinatorRefs memberRefs isActive')
  ])
  const userByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]))
  const userByName = new Map(existingUsers.map((u) => [u.name.toLowerCase().trim(), u]))
  const committeeByName = new Map(existingCommittees.map((c) => [c.name, c]))

  const emailToRole = new Map()
  const analyzed = []

  for (const c of validCommittees) {
    const rowIssues = []

    const coordinator = diffPersonAgainstUser({
      name: c.coordinatorName,
      mail: c.coordinatorMail,
      department: '',
      role: 'Coordinator',
      userByEmail,
      userByName,
      emailToRole,
      rowIssues
    })

    const members = c.members.map((m) => {
      if (!m.mail || !EMAIL_RE.test(m.mail)) {
        rowIssues.push(`${m.name || 'A member'} has no valid mail — no account will be created for them`)
        return { name: m.name, mail: '', department: m.department, action: 'no-account', reason: 'No valid mail in sheet' }
      }
      return diffPersonAgainstUser({
        name: m.name,
        mail: m.mail,
        department: m.department,
        role: 'Member',
        userByEmail,
        userByName,
        emailToRole,
        rowIssues
      })
    })

    const existingCommittee = committeeByName.get(c.committeeName)
    let committeeAction = 'create'
    const committeeChanges = []
    if (existingCommittee) {
      const currentCoordinatorIds = (existingCommittee.coordinatorRefs || []).map(String)
      const currentMemberIds = (existingCommittee.memberRefs || []).map(String)
      if (currentCoordinatorIds.length !== 1 || coordinator.action === 'create') committeeChanges.push('co-ordinator')
      if (currentMemberIds.length !== members.filter((m) => m.mail).length) committeeChanges.push('member roster')
      if (existingCommittee.isActive === false) committeeChanges.push('reactivate')
      committeeAction = committeeChanges.length ? 'update' : 'unchanged'
    }

    analyzed.push({
      excelRow: c.excelRow,
      srNo: c.srNo,
      committeeName: c.committeeName,
      academicYear,
      coordinator,
      members,
      committee: { action: committeeAction, changes: committeeChanges },
      issues: rowIssues
    })
  }

  return { analyzed, errors }
}

function summarize(analyzed, errors) {
  const summary = {
    totalRows: analyzed.length + errors.length,
    errorRows: errors.length,
    committeesCreate: 0,
    committeesUpdate: 0,
    committeesUnchanged: 0,
    usersCreate: 0,
    usersUpdate: 0,
    usersUnchanged: 0,
    unlinkedMembers: 0
  }
  const seen = new Set()
  const cap = { create: 'Create', update: 'Update', unchanged: 'Unchanged' }

  for (const row of analyzed) {
    summary[`committees${cap[row.committee.action]}`] += 1
    for (const person of [row.coordinator, ...row.members]) {
      if (person.action === 'no-account') {
        summary.unlinkedMembers += 1
        continue
      }
      if (person.action === 'skip-admin') continue
      if (seen.has(person.mail)) continue
      seen.add(person.mail)
      if (person.action === 'create') summary.usersCreate += 1
      else if (person.action === 'update') summary.usersUpdate += 1
      else summary.usersUnchanged += 1
    }
  }
  return summary
}

/** POST /api/admin/bulk-import/analyze — Admin only. Parses + diffs, writes nothing. */
export const analyzeBulkImport = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded (expected form field "file")')

  const defaultDomain =
    (req.body.defaultDomain || '').trim().replace(/^@/, '') ||
    (env.smtpFrom || env.smtpUser || '').split('@')[1] ||
    (req.user.email || '').split('@')[1] ||
    'indiraicem.ac.in'

  let rawCommittees
  try {
    rawCommittees = await parseImportWorkbook(req.file.buffer, { defaultDomain })
  } catch (err) {
    throw ApiError.badRequest(err.message || 'Could not read this Excel file')
  }

  const academicYear = (req.body.academicYear || '').trim() || currentAcademicYear()
  if (!/^\d{4}-\d{2}$/.test(academicYear)) {
    throw ApiError.badRequest('Academic year must look like 2026-27')
  }

  const { analyzed, errors } = await diffCommittees(rawCommittees, academicYear)
  const summary = summarize(analyzed, errors)

  const batch = await BulkImportBatch.create({
    createdBy: req.user.id,
    fileName: req.file.originalname,
    rows: analyzed,
    summary: { ...summary, errors },
    expiresAt: new Date(Date.now() + env.bulkImportBatchTtlMs)
  })

  res.status(200).json({
    success: true,
    data: { batchId: batch._id, academicYear, rows: analyzed, errors, summary, defaultDomain }
  })
})

/**
 * GET /api/admin/bulk-import/export-draft?batchId=... — Admin only.
 * Regenerates the sheet from what /analyze parsed (including any blanks/
 * issues), in the same format the import expects, so the Admin can fix it
 * in Excel and re-upload via /analyze — the "download and edit" half of the
 * "review before creating" step (the other half is editing inline and
 * committing directly — see PATCH-free `rows` override on /commit below).
 */
export const exportDraftFromBatch = asyncHandler(async (req, res) => {
  const batch = await BulkImportBatch.findById(req.query.batchId)
  if (!batch) throw ApiError.notFound('This batch was not found or has expired — analyze the sheet again')

  const committeeRows = (batch.rows || []).map((row) => ({
    srNo: row.srNo,
    committeeName: row.committeeName,
    coordinatorName: row.coordinator?.name || '',
    coordinatorMail: row.coordinator?.mail || '',
    members: (row.members || []).map((m) => ({ name: m.name, mail: m.mail || '', department: m.department }))
  }))

  const workbook = buildExportWorkbook(committeeRows, [])
  const buffer = await workbookToBuffer(workbook)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="bulk-import-draft-${Date.now()}.xlsx"`)
  res.status(200).send(Buffer.from(buffer))
})

/**
 * POST /api/admin/bulk-import/commit — Admin only. Applies a previously
 * analyzed batch. An optional `rows` array in the body lets the Admin
 * commit an inline-edited version of what /analyze returned (the "edit in
 * the browser" option) without re-uploading a file — every row is still
 * re-validated here (email format, required fields) before anything is
 * written, exactly as strictly as the original analyze pass. Every write is
 * batched (insertMany/bulkWrite) rather than per-row awaits, so this scales
 * the same way at 5 committees or 500.
 */
export const commitBulkImport = asyncHandler(async (req, res) => {
  const { batchId } = req.body
  const batch = await BulkImportBatch.findById(batchId)
  if (!batch) throw ApiError.notFound('This import batch was not found or has expired — analyze the sheet again')
  if (batch.status === 'committed') throw ApiError.conflict('This batch has already been committed')

  const rows = sanitizeCommitRows(Array.isArray(req.body.rows) ? req.body.rows : batch.rows || [])

  // Re-resolve every person fresh against the DB by email — this is what
  // actually makes inline edits safe: sanitizeCommitRows strips whatever
  // action/userId /analyze originally computed, so if the Admin changed a
  // mail address in the review table it can't accidentally carry over a
  // stale userId that pointed at the *old* address. One batched lookup
  // covers every person in the whole sheet, same cost as during /analyze.
  const allEmails = [...new Set(rows.flatMap((r) => [r.coordinator, ...r.members].map((p) => p.mail).filter(Boolean)))]
  const existingByEmail = new Map(
    (await User.find({ email: { $in: allEmails } }).select('name email role department isActive')).map((u) => [
      u.email,
      u
    ])
  )
  const resolvedRoleByEmail = new Map()
  for (const row of rows) {
    row.coordinator = resolvePersonForCommit(row.coordinator, 'Coordinator', existingByEmail, resolvedRoleByEmail)
    row.members = row.members.map((m) => resolvePersonForCommit(m, 'Member', existingByEmail, resolvedRoleByEmail))
  }

  // ---- 1. Resolve every distinct person (coordinator + emailed members) ----
  const peopleByEmail = new Map()
  for (const row of rows) {
    for (const person of [row.coordinator, ...row.members]) {
      if (!person.mail || person.action === 'skip-admin' || person.action === 'no-account') continue
      if (!peopleByEmail.has(person.mail)) peopleByEmail.set(person.mail, person)
    }
  }
  const toCreate = [...peopleByEmail.values()].filter((p) => p.action === 'create')
  const toUpdate = [...peopleByEmail.values()].filter((p) => p.action === 'update')

  // The default password is identical for every newly-created account, so
  // it's hashed once (not once per user) and assigned straight to
  // passwordHash — bypassing the per-document bcrypt call the `password`
  // virtual would otherwise trigger for each of potentially hundreds of
  // rows across 50+ committees. Biggest cost saver in this flow at scale
  // (bcrypt at cost-factor 12 is deliberately slow).
  const defaultPasswordHash = await bcrypt.hash(env.bulkImportDefaultPassword, 12)

  let createdUsers = []
  if (toCreate.length) {
    try {
      createdUsers = await User.insertMany(
        toCreate.map((p) => ({
          name: p.name,
          email: p.mail,
          passwordHash: defaultPasswordHash,
          role: p.role,
          department: p.department || '',
          isActive: true
        })),
        { ordered: false }
      )
    } catch (err) {
      if (err.insertedDocs) createdUsers = err.insertedDocs
      else throw err
    }
    const createdByEmail = new Map(createdUsers.map((u) => [u.email, u]))
    for (const p of toCreate) {
      const created = createdByEmail.get(p.mail)
      if (created) {
        p.userId = created._id
      } else {
        const existing = await User.findOne({ email: p.mail }).select('_id')
        if (existing) p.userId = existing._id
      }
    }
  }

  if (toUpdate.length) {
    await User.bulkWrite(
      toUpdate.map((p) => ({
        updateOne: {
          filter: { _id: p.userId },
          update: { $set: { name: p.name, role: p.role, department: p.department || '', isActive: true } }
        }
      })),
      { ordered: false }
    )
  }

  // ---- 2. Create/update committees, now that every person has a real id ----
  const committeeOps = []
  const rosterByCommitteeName = new Map()

  for (const row of rows) {
    const coordinatorId = row.coordinator.userId || peopleByEmail.get(row.coordinator.mail)?.userId
    const memberIds = row.members
      .filter((m) => m.mail && m.action !== 'skip-admin')
      .map((m) => m.userId || peopleByEmail.get(m.mail)?.userId)
      .filter(Boolean)
    if (!coordinatorId) continue // e.g. coordinator email collided with the Admin account

    rosterByCommitteeName.set(row.committeeName, { coordinatorId, memberIds })

    committeeOps.push({
      updateOne: {
        filter: { name: row.committeeName, academicYear: row.academicYear },
        update: {
          $set: { name: row.committeeName, coordinatorRefs: [coordinatorId], memberRefs: memberIds, isActive: true },
          $setOnInsert: {
            type: 'General', // the sheet has no mandate/classification column — left generic, editable later
            academicYear: row.academicYear,
            meetingsRequiredPerYear: 4,
            meetingCadenceDays: 90
          }
        },
        upsert: true
      }
    })
  }
  if (committeeOps.length) await Committee.bulkWrite(committeeOps, { ordered: false })

  // ---- 3. Backfill User.committeeRefs on both sides of the relationship ----
  const committees = await Committee.find({
    $or: rows.map((r) => ({ name: r.committeeName, academicYear: r.academicYear }))
  }).select('_id name')

  const userRefOps = []
  for (const committee of committees) {
    const roster = rosterByCommitteeName.get(committee.name)
    if (!roster) continue
    for (const userId of [roster.coordinatorId, ...roster.memberIds]) {
      userRefOps.push({ updateOne: { filter: { _id: userId }, update: { $addToSet: { committeeRefs: committee._id } } } })
    }
  }
  if (userRefOps.length) await User.bulkWrite(userRefOps, { ordered: false })

  // ---- 4. Issue reset-password links + emails for every newly-created account ----
  let emailsSent = 0
  let emailsFailed = 0
  if (createdUsers.length) {
    const tokenDocs = createdUsers.map((u) => {
      const token = generateResetToken()
      return {
        userRef: u._id,
        tokenHash: hashResetToken(token),
        reason: 'bulk_import',
        expiresAt: new Date(Date.now() + env.resetTokenTtlMs),
        _plainToken: token
      }
    })
    await PasswordResetToken.insertMany(tokenDocs.map(({ _plainToken, ...d }) => d), { ordered: false })

    // Small concurrent batches — fast at 50+ committees' worth of people
    // without exceeding the SMTP pool size set in mailer.js.
    const CONCURRENCY = 5
    for (let i = 0; i < createdUsers.length; i += CONCURRENCY) {
      const chunk = createdUsers.slice(i, i + CONCURRENCY)
      const chunkTokens = tokenDocs.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        chunk.map((u, idx) => {
          const resetLink = `${env.clientUrl}/?resetToken=${encodeURIComponent(chunkTokens[idx]._plainToken)}`
          return sendWelcomeAccountEmail(u.email, u.name, resetLink)
        })
      )
      for (const res_ of results) {
        if (res_.status === 'fulfilled' && res_.value?.delivered !== false) emailsSent += 1
        else emailsFailed += 1
      }
    }
  }

  batch.status = 'committed'
  batch.committedAt = new Date()
  await batch.save()

  res.status(200).json({
    success: true,
    data: {
      committeesWritten: committeeOps.length,
      usersCreated: createdUsers.length,
      usersUpdated: toUpdate.length,
      emailsSent,
      emailsFailed
    }
  })
})

/**
 * Freshly determines create/update/unchanged/skip-admin for one person by
 * email lookup, ignoring whatever /analyze said — see the comment above the
 * lookup in commitBulkImport for why this matters for inline-edited rows.
 */
function resolvePersonForCommit(person, defaultRole, existingByEmail, resolvedRoleByEmail) {
  if (!person.mail) return { ...person, action: 'no-account' }

  const priorRole = resolvedRoleByEmail.get(person.mail)
  const role = priorRole || defaultRole
  resolvedRoleByEmail.set(person.mail, role)

  const existing = existingByEmail.get(person.mail)
  if (!existing) return { ...person, role, action: 'create' }
  if (existing.role === 'Admin') return { ...person, role: 'Admin', action: 'skip-admin', userId: existing._id }

  const changed =
    existing.name !== person.name ||
    existing.role !== role ||
    (person.department && existing.department !== person.department) ||
    existing.isActive === false
  return { ...person, role, action: changed ? 'update' : 'unchanged', userId: existing._id }
}

/**
 * Re-validates a (possibly inline-edited) rows array before commit —
 * strips whatever `action`/`userId` /analyze computed (resolvePersonForCommit
 * above recomputes both fresh, by email, right before they're used) and
 * only keeps/validates the fields a person actually typed: name, mail,
 * department. A row with a missing/invalid mail becomes 'no-account' so it
 * can't smuggle through as a fabricated "unchanged" against some other
 * user's id.
 */
function sanitizeCommitRows(rows) {
  return rows.map((row) => ({
    committeeName: String(row.committeeName || '').trim(),
    academicYear: String(row.academicYear || '').trim(),
    coordinator: sanitizePerson(row.coordinator),
    members: (row.members || []).map(sanitizePerson)
  }))
}

function sanitizePerson(person) {
  const mail = String(person?.mail || '').trim().toLowerCase()
  const name = String(person?.name || '').trim()
  const department = String(person?.department || '').trim()
  if (!mail || !EMAIL_RE.test(mail) || !name) {
    return { name, mail: '', department }
  }
  return { name, mail, department }
}

/** GET /api/admin/bulk-import/export — Admin only. Downloadable .xlsx, same shape as the import sheet. */
export const exportCommitteesExcel = asyncHandler(async (req, res) => {
  const { committeeIds, role, designation, academicYear } = req.query

  const filter = { isActive: true }
  if (academicYear) filter.academicYear = academicYear
  if (committeeIds) {
    const ids = String(committeeIds).split(',').filter(Boolean)
    if (ids.length) filter._id = { $in: ids }
  }

  const committees = await Committee.find(filter)
    .populate('coordinatorRefs', 'name email role department designation')
    .populate('memberRefs', 'name email role department designation')
    .sort({ name: 1 })
    .lean()

  const matchesFilter = (person) => {
    if (role && person.role !== role) return false
    if (designation && (person.designation || '').toLowerCase() !== String(designation).toLowerCase()) return false
    return true
  }

  const committeeRows = []
  const workloadByEmail = new Map()

  for (const committee of committees) {
    const coordinator = (committee.coordinatorRefs || [])[0]
    const members = (committee.memberRefs || []).filter(matchesFilter)
    if ((role || designation) && !members.length && !(coordinator && matchesFilter(coordinator))) continue

    committeeRows.push({
      srNo: committeeRows.length + 1,
      committeeName: committee.name,
      coordinatorName: coordinator ? coordinator.name : '',
      coordinatorMail: coordinator ? coordinator.email : '',
      members: members.map((m) => ({ name: m.name, mail: m.email, department: m.department || '' }))
    })

    if (coordinator) {
      const entry = workloadByEmail.get(coordinator.email) || {
        department: coordinator.department || '',
        name: coordinator.name,
        mail: coordinator.email,
        memberCount: 0,
        coordinatorCount: 0
      }
      entry.coordinatorCount += 1
      workloadByEmail.set(coordinator.email, entry)
    }
    for (const m of members) {
      const entry = workloadByEmail.get(m.email) || {
        department: m.department || '',
        name: m.name,
        mail: m.email,
        memberCount: 0,
        coordinatorCount: 0
      }
      entry.memberCount += 1
      workloadByEmail.set(m.email, entry)
    }
  }

  const workloadRows = [...workloadByEmail.values()].sort(
    (a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name)
  )

  const workbook = buildExportWorkbook(committeeRows, workloadRows)
  const buffer = await workbookToBuffer(workbook)

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="committees-export-${Date.now()}.xlsx"`)
  res.status(200).send(Buffer.from(buffer))
})
