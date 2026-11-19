import mongoose from 'mongoose'

const { Schema } = mongoose

// Represents a short-lived, single-use "presigned URL" grant, mimicking the
// S3 PutObject presign pattern: the client asks the API for permission to
// upload a specific object, the API hands back a scoped URL + key, and the
// client uploads the binary directly to that URL without routing the bytes
// through the main API's request/response cycle for metadata calls.
const uploadTicketSchema = new Schema(
  {
    storageKey: {
      type: String,
      required: true,
      unique: true
    },
    fileType: {
      type: String,
      enum: ['Agenda', 'MoM', 'Photo', 'Avatar', 'Logo', 'NoticeAttachment', 'NewsPhoto', 'WorkProof'],
      required: true
    },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    consumed: {
      type: Boolean,
      default: false
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

// MongoDB TTL index — expired, never-used tickets are automatically reaped.
uploadTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('UploadTicket', uploadTicketSchema)
