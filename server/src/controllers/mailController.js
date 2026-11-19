import mongoose from 'mongoose'
import Mail from '../models/Mail.js'
import MailState from '../models/MailState.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendUserMail } from '../utils/mailer.js'

const USER_SUMMARY_FIELDS = 'name email role designation avatarUrl'

/** Populates the sender/recipients on a Mail doc with the same lean field set everywhere. */
function populateMail(query) {
  return query
    .populate('from', USER_SUMMARY_FIELDS)
    .populate('to', USER_SUMMARY_FIELDS)
    .populate('cc', USER_SUMMARY_FIELDS)
    .populate('bcc', USER_SUMMARY_FIELDS)
}

/**
 * Resolves a list of recipient user IDs, guaranteeing every one exists and
 * is active. Mirrors the defensive DB lookups elsewhere in the app (e.g.
 * committeeController checking a committee exists before referencing it)
 * rather than trusting client-supplied ObjectIds blindly.
 */
async function resolveRecipients(ids = []) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))]
  if (uniqueIds.length === 0) return []
  const users = await User.find({ _id: { $in: uniqueIds }, isActive: true }).select('_id')
  if (users.length !== uniqueIds.length) {
    throw ApiError.badRequest('One or more recipients could not be found')
  }
  return uniqueIds
}

/**
 * Creates the MailState rows for every participant of a just-sent mail:
 * 'sent' (already read) for the sender, 'inbox' (unread) for every
 * to/cc/bcc recipient. Also fires a `new_mail` Notification per recipient,
 * reusing the same Notification model the rest of the app polls for its
 * bell icon, so a new mail shows up there too.
 */
async function fanOutSentStates(mail, senderName) {
  const stateDocs = [
    {
      mail: mail._id,
      user: mail.from,
      participantRole: 'from',
      folder: 'sent',
      isRead: true
    }
  ]

  const recipientGroups = [
    { ids: mail.to, role: 'to' },
    { ids: mail.cc, role: 'cc' },
    { ids: mail.bcc, role: 'bcc' }
  ]

  for (const group of recipientGroups) {
    for (const userId of group.ids) {
      stateDocs.push({
        mail: mail._id,
        user: userId,
        participantRole: group.role,
        folder: 'inbox',
        isRead: false
      })
    }
  }

  await MailState.insertMany(stateDocs, { ordered: false })

  const recipientIds = [...mail.to, ...mail.cc, ...mail.bcc].map((id) => id.toString())
  const uniqueRecipientIds = [...new Set(recipientIds)]
  if (uniqueRecipientIds.length > 0) {
    await Notification.insertMany(
      uniqueRecipientIds.map((recipientId) => ({
        recipientRef: recipientId,
        type: 'new_mail',
        title: `New mail from ${senderName}`,
        message: mail.subject || '(no subject)',
        level: 'info'
      }))
    )
  }
}

/**
 * Dispatches the mail to participants' real email accounts (e.g. Outlook) via SMTP relay.
 */
async function relayMailToOutlook(mail, sender) {
  try {
    const [toUsers, ccUsers, bccUsers] = await Promise.all([
      User.find({ _id: { $in: mail.to } }).select('email'),
      User.find({ _id: { $in: mail.cc } }).select('email'),
      User.find({ _id: { $in: mail.bcc } }).select('email')
    ])
    const toEmails = toUsers.map((u) => u.email).filter(Boolean)
    const ccEmails = ccUsers.map((u) => u.email).filter(Boolean)
    const bccEmails = bccUsers.map((u) => u.email).filter(Boolean)

    await sendUserMail({
      fromUser: sender,
      toEmails,
      ccEmails,
      bccEmails,
      subject: mail.subject,
      body: mail.body
    })
  } catch (err) {
    console.error('[mail:outlook-relay-failed]', err.message)
  }
}

/**
 * GET /api/mail?folder=inbox&q=search+term
 * Any authenticated user's own mailbox. `folder` is one of
 * inbox|sent|draft|archive|trash|starred (starred is virtual: it pulls
 * every starred mail regardless of folder, excluding Trash).
 */
export const listMail = asyncHandler(async (req, res) => {
  const { folder = 'inbox', q } = req.query

  const stateFilter = { user: req.user.id }
  if (folder === 'starred') {
    stateFilter.isStarred = true
    stateFilter.folder = { $ne: 'trash' }
  } else {
    stateFilter.folder = folder
  }

  if (q && q.trim()) {
    const term = q.trim()
    const regex = new RegExp(escapeRegex(term), 'i')

    const matchingUsers = await User.find({
      $or: [{ name: regex }, { email: regex }]
    }).select('_id')
    const matchingUserIds = matchingUsers.map((u) => u._id)

    const matchingMails = await Mail.find({
      $or: [
        { subject: regex },
        { body: regex },
        { from: { $in: matchingUserIds } },
        { to: { $in: matchingUserIds } },
        { cc: { $in: matchingUserIds } },
        { bcc: { $in: matchingUserIds } }
      ]
    }).select('_id')

    stateFilter.mail = { $in: matchingMails.map((m) => m._id) }
  }

  const states = await MailState.find(stateFilter).sort({ createdAt: -1 }).limit(200).lean()

  const mailIds = states.map((s) => s.mail)
  const mails = await populateMail(Mail.find({ _id: { $in: mailIds } })).lean()
  const mailById = new Map(mails.map((m) => [m._id.toString(), m]))

  const items = states
    .map((state) => {
      const mail = mailById.get(state.mail.toString())
      if (!mail) return null
      return {
        stateId: state._id,
        folder: state.folder,
        isRead: state.isRead,
        isStarred: state.isStarred,
        participantRole: state.participantRole,
        mail
      }
    })
    .filter(Boolean)

  res.status(200).json({ success: true, data: items })
})

/** GET /api/mail/unread-count — powers the Mail badge in the sidebar/topnav. */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await MailState.countDocuments({ user: req.user.id, folder: 'inbox', isRead: false })
  res.status(200).json({ success: true, data: { count } })
})

/**
 * GET /api/mail/contacts?q=
 * Lightweight directory search open to every authenticated role (not just
 * Admin, unlike GET /api/users) so anyone can find anyone to mail. Returns
 * only the fields a recipient picker needs.
 */
export const searchContacts = asyncHandler(async (req, res) => {
  const { q = '' } = req.query
  const term = q.trim()

  const filter = { isActive: true, _id: { $ne: req.user.id } }
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i')
    filter.$or = [{ name: regex }, { email: regex }]
  }

  const users = await User.find(filter).select(USER_SUMMARY_FIELDS).sort({ name: 1 }).limit(25)
  res.status(200).json({ success: true, data: users })
})

/**
 * GET /api/mail/:id — full thread view. Requires the requester to have a
 * MailState on the specific mail requested (i.e. they were a participant),
 * then returns every mail sharing that thread they're also a participant
 * on, oldest first. Marks the requested mail read for this user.
 */
export const getMailThread = asyncHandler(async (req, res) => {
  const requestedState = await MailState.findOne({ mail: req.params.id, user: req.user.id })
  if (!requestedState) throw ApiError.notFound('Mail not found')

  const requestedMail = await Mail.findById(req.params.id)
  if (!requestedMail) throw ApiError.notFound('Mail not found')

  if (!requestedState.isRead) {
    requestedState.isRead = true
    await requestedState.save()
  }

  const threadId = requestedMail.threadId || requestedMail._id

  const myStates = await MailState.find({ user: req.user.id }).select('mail folder isRead isStarred participantRole')
  const myStateByMailId = new Map(myStates.map((s) => [s.mail.toString(), s]))

  const threadMails = await populateMail(Mail.find({ threadId, isDraft: false }).sort({ sentAt: 1, createdAt: 1 }))

  const thread = threadMails
    .filter((m) => myStateByMailId.has(m._id.toString()))
    .map((m) => {
      const state = myStateByMailId.get(m._id.toString())
      return {
        mail: m,
        stateId: state._id,
        folder: state.folder,
        isRead: state.isRead,
        isStarred: state.isStarred,
        participantRole: state.participantRole
      }
    })

  res.status(200).json({ success: true, data: thread })
})

/**
 * POST /api/mail — compose a new mail, a reply, a forward, or a draft.
 * Body: { to[], cc[], bcc[], subject, body, attachments[], isDraft,
 *         replyToMailId }
 */
export const createMail = asyncHandler(async (req, res) => {
  const { to = [], cc = [], bcc = [], subject, body, attachments = [], isDraft = false, replyToMailId } = req.body

  if (!isDraft && to.length === 0 && cc.length === 0 && bcc.length === 0) {
    throw ApiError.badRequest('A mail needs at least one recipient to be sent')
  }

  const toIds = await resolveRecipients(to)
  const ccIds = await resolveRecipients(cc)
  const bccIds = await resolveRecipients(bcc)

  let threadId
  let replyToMail = null
  if (replyToMailId) {
    if (!mongoose.isValidObjectId(replyToMailId)) throw ApiError.badRequest('Invalid replyToMailId')
    const parentState = await MailState.findOne({ mail: replyToMailId, user: req.user.id })
    if (!parentState) throw ApiError.forbidden('You can only reply to mail in your own mailbox')
    const parentMail = await Mail.findById(replyToMailId)
    if (!parentMail) throw ApiError.notFound('Original mail not found')
    threadId = parentMail.threadId || parentMail._id
    replyToMail = parentMail._id
  }

  const mail = new Mail({
    from: req.user.id,
    to: toIds,
    cc: ccIds,
    bcc: bccIds,
    subject: subject?.trim() || '(no subject)',
    body: body || '',
    attachments,
    isDraft: !!isDraft,
    sentAt: isDraft ? null : new Date(),
    replyToMail,
    threadId
  })
  await mail.save()

  if (!threadId) {
    mail.threadId = mail._id
    await mail.save()
  }

  if (isDraft) {
    await MailState.create({
      mail: mail._id,
      user: req.user.id,
      participantRole: 'from',
      folder: 'draft',
      isRead: true
    })
  } else {
    await fanOutSentStates(mail, req.user.name)
    // Relay copy via SMTP so it appears in the recipients' real Outlook inboxes
    await relayMailToOutlook(mail, req.user)
  }

  const populated = await populateMail(Mail.findById(mail._id))
  res.status(201).json({ success: true, data: populated })
})

/**
 * PATCH /api/mail/:id — edits the content of a mail the requester owns AND
 * is still a draft. Sending a draft goes through POST /api/mail/:id/send
 * instead, since that's a state transition with side effects (fan-out +
 * notifications), not a content edit.
 */
export const updateDraft = asyncHandler(async (req, res) => {
  const mail = await Mail.findById(req.params.id)
  if (!mail) throw ApiError.notFound('Mail not found')
  if (mail.from.toString() !== req.user.id) throw ApiError.forbidden('You can only edit your own drafts')
  if (!mail.isDraft) throw ApiError.badRequest('This mail has already been sent and can no longer be edited')

  const { to, cc, bcc, subject, body, attachments } = req.body
  if (to !== undefined) mail.to = await resolveRecipients(to)
  if (cc !== undefined) mail.cc = await resolveRecipients(cc)
  if (bcc !== undefined) mail.bcc = await resolveRecipients(bcc)
  if (subject !== undefined) mail.subject = subject.trim() || '(no subject)'
  if (body !== undefined) mail.body = body
  if (attachments !== undefined) mail.attachments = attachments

  await mail.save()
  const populated = await populateMail(Mail.findById(mail._id))
  res.status(200).json({ success: true, data: populated })
})

/** POST /api/mail/:id/send — sends a previously saved draft. */
export const sendDraft = asyncHandler(async (req, res) => {
  const mail = await Mail.findById(req.params.id)
  if (!mail) throw ApiError.notFound('Mail not found')
  if (mail.from.toString() !== req.user.id) throw ApiError.forbidden('You can only send your own drafts')
  if (!mail.isDraft) throw ApiError.conflict('This mail has already been sent')
  if (mail.to.length === 0 && mail.cc.length === 0 && mail.bcc.length === 0) {
    throw ApiError.badRequest('Add at least one recipient before sending')
  }

  mail.isDraft = false
  mail.sentAt = new Date()
  await mail.save()

  await MailState.deleteOne({ mail: mail._id, user: req.user.id })
  await fanOutSentStates(mail, req.user.name)
  // Relay copy via SMTP so it appears in the recipients' real Outlook inboxes
  await relayMailToOutlook(mail, req.user)

  const populated = await populateMail(Mail.findById(mail._id))
  res.status(200).json({ success: true, data: populated })
})

const VALID_FOLDERS_FOR_STATE = ['inbox', 'archive', 'trash']

/**
 * PATCH /api/mail/:id/state — toggles this user's own view of a mail:
 * isRead, isStarred, and/or moving between inbox/archive/trash (and
 * restoring out of trash). Never touches the underlying Mail content.
 */
export const updateMailState = asyncHandler(async (req, res) => {
  const state = await MailState.findOne({ mail: req.params.id, user: req.user.id })
  if (!state) throw ApiError.notFound('Mail not found in your mailbox')

  const { isRead, isStarred, folder } = req.body

  if (isRead !== undefined) state.isRead = !!isRead
  if (isStarred !== undefined) state.isStarred = !!isStarred

  if (folder !== undefined) {
    if (folder === 'trash') {
      if (state.folder !== 'trash') {
        state.previousFolder = state.folder === 'draft' ? null : state.folder
        state.folder = 'trash'
      }
    } else if (folder === 'restore') {
      state.folder = state.previousFolder || (state.participantRole === 'from' && state.folder === 'trash' ? 'sent' : 'inbox')
      state.previousFolder = null
    } else if (VALID_FOLDERS_FOR_STATE.includes(folder)) {
      state.folder = folder
    } else {
      throw ApiError.badRequest(`Unsupported folder transition: ${folder}`)
    }
  }

  await state.save()
  res.status(200).json({ success: true, data: state })
})

/**
 * DELETE /api/mail/:id — permanently removes this mail from the
 * requester's own mailbox. Only allowed once it's already in Trash, so a
 * permanent delete is always a deliberate two-step action, same as Gmail.
 * The underlying Mail document is left alone as long as any other
 * participant's MailState still references it.
 */
export const permanentlyDeleteMail = asyncHandler(async (req, res) => {
  const state = await MailState.findOne({ mail: req.params.id, user: req.user.id })
  if (!state) throw ApiError.notFound('Mail not found in your mailbox')
  if (state.folder !== 'trash') {
    throw ApiError.badRequest('Move this mail to Trash before deleting it permanently')
  }

  await MailState.deleteOne({ _id: state._id })

  const remaining = await MailState.countDocuments({ mail: req.params.id })
  if (remaining === 0) {
    await Mail.deleteOne({ _id: req.params.id })
  }

  res.status(200).json({ success: true, message: 'Mail permanently deleted' })
})

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
