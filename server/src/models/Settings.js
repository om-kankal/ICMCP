import mongoose from 'mongoose'

const { Schema } = mongoose

// Singleton document (there is only ever one Settings row — enforced by
// always querying/upserting with the same fixed _id below).
const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'singleton' },
    collegeLogoUrl: { type: String, default: null },
    collegeLogoStorageKey: { type: String, default: null },
    // Admin-editable overrides — fall back to env.institutionName/env.institutionTagline
    // (see settingsController.getSettings) when not set. collegeName intentionally
    // supports multiple lines (e.g. a long formal name split across lines).
    collegeName: { type: String, default: null, maxlength: 400 },
    tosUrl: { type: String, default: null, maxlength: 500 },
    privacyUrl: { type: String, default: null, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
)

settingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findById('singleton')
  if (!doc) {
    doc = await this.create({ _id: 'singleton' })
  }
  return doc
}

export default mongoose.model('Settings', settingsSchema)
