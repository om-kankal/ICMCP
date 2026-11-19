import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * A short-lived, single-use record created when a user requests to change
 * their email or password. The actual change is only applied once the OTP
 * emailed to them is confirmed via /verify-otp — see authController.
 */
const pendingVerificationSchema = new Schema(
  {
    userRef: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: {
      type: String,
      enum: ['email_change', 'password_change'],
      required: true
    },
    otpHash: { type: String, required: true, select: false },
    // email_change: the new email address to switch to once verified.
    // password_change: the already-hashed new password to apply once verified.
    newEmail: { type: String, default: null },
    newPasswordHash: { type: String, default: null, select: false },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
)

export default mongoose.model('PendingVerification', pendingVerificationSchema)
