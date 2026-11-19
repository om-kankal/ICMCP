import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['Admin', 'Coordinator', 'Member'],
      default: 'Member',
      required: true
    },
    designation: {
      type: String,
      trim: true,
      default: ''
    },
    // Home department (FE, Mech, Comp, MCA, ... — kept as free text since
    // the institute's own department codes aren't consistently formatted
    // across sheets, e.g. "AIDS/IT" vs "AIDS", "Civil" vs "CIVIL"; this
    // module never normalizes that spelling on its own). Populated by the
    // bulk-import Excel (see bulkImportController.js), editable elsewhere.
    department: {
      type: String,
      trim: true,
      default: ''
    },
    avatarUrl: {
      type: String,
      default: null
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
      }
    },
    committeeRefs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Committee'
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
)

// Virtual, write-only field: set `password` and it gets hashed into passwordHash.
userSchema
  .virtual('password')
  .set(function setPassword(plain) {
    this._password = plain
  })
  .get(function getPassword() {
    return this._password
  })

userSchema.pre('validate', async function hashPassword(next) {
  if (!this._password) return next()
  const salt = await bcrypt.genSalt(12)
  this.passwordHash = await bcrypt.hash(this._password, salt)
  next()
})

// SCALE: bulk import (see bulkImportController.js) and committee rosters at
// 50+ committees both filter/sort active users by role very often — this
// keeps those queries index-backed instead of scanning every user.
userSchema.index({ isActive: 1, role: 1 })

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash)
}

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    designation: this.designation,
    avatarUrl: this.avatarUrl,
    preferences: this.preferences,
    committeeRefs: this.committeeRefs
  }
}

export default mongoose.model('User', userSchema)
