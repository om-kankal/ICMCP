import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * A single-use, short-lived token backing the "set your password" link
 * emailed to a user. Used two places: (1) accounts created in bulk from the
 * admin's Excel sheet (see bulkImportController.js), which start on the
 * fixed default password and must set their own before real use, and
 * (2) an Admin's ordinary per-user "reset password" action, which now also
 * emails a link instead of (or alongside) setting a temporary password
 * directly. Only the token's hash is stored, mirroring how OTPs are stored
 * hashed in PendingVerification — a leaked DB row can't be replayed as a
 * live reset link.
 */
const passwordResetTokenSchema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, select: false },
    reason: {
      type: String,
      enum: ['bulk_import', 'admin_reset'],
      default: 'admin_reset'
    },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
)

export default mongoose.model('PasswordResetToken', passwordResetTokenSchema)
