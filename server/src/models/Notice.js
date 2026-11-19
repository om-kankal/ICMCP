import mongoose from 'mongoose'

const { Schema } = mongoose

const noticeSchema = new Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    content: { type: String, required: [true, 'Content is required'], trim: true },
    priority: {
      type: String,
      enum: ['Normal', 'Important', 'Urgent'],
      default: 'Normal'
    },
    // Null committeeRef = a general/institution-wide notice visible to everyone.
    // A set committeeRef scopes visibility to that committee's coordinators/members.
    committeeRef: { type: Schema.Types.ObjectId, ref: 'Committee', default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attachmentUrl: { type: String, default: null },
    isPinned: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

noticeSchema.index({ committeeRef: 1, createdAt: -1 })

export default mongoose.model('Notice', noticeSchema)
