import mongoose from 'mongoose'

const { Schema } = mongoose

const newsEventSchema = new Schema(
  {
    category: {
      type: String,
      enum: ['News', 'Event', 'Announcement'],
      required: [true, 'Category is required']
    },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    content: { type: String, required: [true, 'Content is required'], trim: true },
    // Only meaningful for category: 'Event' — when it's happening.
    eventDate: { type: Date, default: null },
    location: { type: String, trim: true, default: '' },
    // Null committeeRef = visible to every user (institution-wide).
    committeeRef: { type: Schema.Types.ObjectId, ref: 'Committee', default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    photoUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

newsEventSchema.index({ committeeRef: 1, createdAt: -1 })
newsEventSchema.index({ category: 1, createdAt: -1 })

export default mongoose.model('NewsEvent', newsEventSchema)
