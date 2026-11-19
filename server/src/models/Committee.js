import mongoose from 'mongoose'

const { Schema } = mongoose

const committeeSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Committee name is required'],
      trim: true,
      maxlength: 160
    },
    // "type" per spec — the statutory mandate / classification (e.g. NAAC, UGC, POSH)
    type: {
      type: String,
      required: [true, 'Committee mandate/type is required'],
      trim: true,
      maxlength: 160
    },
    // Optional overview/primary department. Left blank by the bulk-import
    // flow when a committee draws members from multiple departments (the
    // normal case for institute-level committees) — per-person department
    // is what's tracked and shown instead (see User.department and the
    // workload table in utils/bulkImportExcel.js). Still here and editable
    // for committees where a single department genuinely fits.
    department: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
      index: true
    },
    academicYear: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Academic year must look like 2026-27']
    },

    // Real accounts, assigned by an Admin from existing Coordinator/Member
    // users (not free text) — this is what makes notification targeting and
    // per-user meeting visibility possible.
    coordinatorRefs: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    memberRefs: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Names typed into the bulk-import sheet's "Members" cell that had no
    // matching email in that cell, so no login account could be created for
    // them (a User account needs a unique email). Kept as plain text so the
    // roster the sheet described isn't silently dropped, and shown back on
    // export/analysis so the Admin can see who still needs a real account.
    unlinkedMembers: [{ type: String, trim: true, maxlength: 160 }],

    // Statutory cadence used to compute compliance (defaults to quarterly)
    meetingsRequiredPerYear: {
      type: Number,
      default: 4,
      min: 1
    },
    meetingCadenceDays: {
      type: Number,
      default: 90,
      min: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
)

committeeSchema.index({ name: 1, academicYear: 1 }, { unique: true })

// SCALE: with 50+ committees running concurrently, listCommittees() and the
// visibility checks in committeeAccess.js filter by these fields on every
// request — indexes keep those lookups fast as the collection grows instead
// of degrading into collection scans.
committeeSchema.index({ isActive: 1, name: 1 })
committeeSchema.index({ coordinatorRefs: 1 })
committeeSchema.index({ memberRefs: 1 })

/** Every real account with visibility into this committee — used for notification fan-out. */
committeeSchema.methods.allAssignedUserIds = function allAssignedUserIds() {
  const idOf = (entry) => (entry._id ? entry._id : entry).toString()
  const ids = new Set([...this.coordinatorRefs, ...this.memberRefs].map(idOf))
  return [...ids]
}

export default mongoose.model('Committee', committeeSchema)
