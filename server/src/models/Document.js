import mongoose from 'mongoose'

const { Schema } = mongoose

const documentSchema = new Schema(
  {
    meetingRef: {
      type: Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true,
      index: true
    },
    fileType: {
      type: String,
      enum: ['Agenda', 'MoM', 'Photo'],
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    cloudUrl: {
      type: String,
      required: true
    },
    // Storage key within the mock S3-compatible bucket (used to validate the
    // presigned-URL upload actually completed before the document is attached
    // to a meeting).
    storageKey: {
      type: String,
      required: true,
      unique: true
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream'
    },
    sizeBytes: {
      type: Number,
      default: 0
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

export default mongoose.model('Document', documentSchema)
