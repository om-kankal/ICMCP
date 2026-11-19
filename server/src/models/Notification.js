import mongoose from 'mongoose'

const { Schema } = mongoose

const notificationSchema = new Schema(
  {
    recipientRef: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    committeeRef: {
      type: Schema.Types.ObjectId,
      ref: 'Committee',
      default: null
    },
    meetingRef: {
      type: Schema.Types.ObjectId,
      ref: 'Meeting',
      default: null
    },
    type: {
      type: String,
      enum: ['overdue_meeting', 'escalation', 'meeting_scheduled', 'monthly_no_activity', 'new_mail', 'general'],
      default: 'general'
    },
    // For period-based sweeps (e.g. "no activity this month"), a stable key
    // like "2026-07" lets us check "did we already notify for this period?"
    // without re-parsing message text.
    periodKey: {
      type: String,
      default: null
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ['compliant', 'due', 'overdue', 'info'],
      default: 'due'
    },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
)

// Prevents the overdue-check sweep from spamming the same recipient with a
// duplicate notification for the same meeting every time it runs.
notificationSchema.index({ recipientRef: 1, meetingRef: 1, type: 1 })
// Prevents the monthly sweep from re-notifying for a period already covered.
notificationSchema.index({ recipientRef: 1, committeeRef: 1, type: 1, periodKey: 1 })

export default mongoose.model('Notification', notificationSchema)
