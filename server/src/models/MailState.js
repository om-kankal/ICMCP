import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * Per-(mail, user) mailbox state. Every participant in a mail — the sender
 * and every To/Cc/Bcc recipient — gets exactly one of these, which is what
 * lets the same physical message show up as "Sent" in the sender's mailbox
 * and "Inbox" in a recipient's, and lets one person archive/star/trash a
 * mail without affecting anyone else's copy of it (exactly how IMAP mailbox
 * flags work per-account against one message).
 */
const mailStateSchema = new Schema(
  {
    mail: {
      type: Schema.Types.ObjectId,
      ref: 'Mail',
      required: true,
      index: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // How this mail was addressed to this user — kept so the mail viewer
    // can label "To" vs "Cc" badges without re-deriving it from the Mail doc.
    participantRole: {
      type: String,
      enum: ['from', 'to', 'cc', 'bcc'],
      required: true
    },
    folder: {
      type: String,
      enum: ['inbox', 'sent', 'draft', 'archive', 'trash'],
      required: true,
      index: true
    },
    // Where this mail lived before it was moved to Trash, so "Restore" can
    // put it back where it came from instead of always defaulting to Inbox.
    previousFolder: {
      type: String,
      enum: ['inbox', 'sent', 'draft', 'archive', null],
      default: null
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isStarred: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

// One state row per (mail, user) — never duplicated.
mailStateSchema.index({ mail: 1, user: 1 }, { unique: true })
// Powers "unread count in Inbox" and general folder listing quickly.
mailStateSchema.index({ user: 1, folder: 1, createdAt: -1 })

export default mongoose.model('MailState', mailStateSchema)
