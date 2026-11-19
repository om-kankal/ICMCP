import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * A single mail message's content — analogous to the "envelope + body" of
 * an email. This is shared by every participant (sender + all recipients);
 * per-user things like read/starred/folder live in MailState instead, the
 * same way a real mail server keeps one message but a separate IMAP flag
 * set per mailbox it lands in.
 *
 * Threading: `threadId` groups a conversation (a mail + its replies) and is
 * set to the root mail's own _id the first time a thread is created, then
 * copied onto every reply. `replyToMail` points at the immediate parent so
 * a thread can also be rendered as a chain, not just a flat bag of mails.
 */
const attachmentSchema = new Schema(
  {
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 }
  },
  { _id: false }
)

const mailSchema = new Schema(
  {
    from: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    to: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    cc: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    bcc: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    subject: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '(no subject)'
    },
    body: {
      type: String,
      default: '',
      maxlength: 50000
    },
    attachments: [attachmentSchema],
    threadId: {
      type: Schema.Types.ObjectId,
      index: true
    },
    replyToMail: {
      type: Schema.Types.ObjectId,
      ref: 'Mail',
      default: null
    },
    isDraft: {
      type: Boolean,
      default: true
    },
    sentAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

mailSchema.index({ subject: 'text', body: 'text' })

export default mongoose.model('Mail', mailSchema)
