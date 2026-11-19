import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * A single piece of work a Coordinator assigns to one Member of their
 * committee. Deliberately narrow visibility (enforced in the controller,
 * not just the UI): the assigned Member sees only their own assignments,
 * the assigning Coordinator sees everything they've assigned, and Admin
 * has no visibility into this feature at all, per design.
 */
const workAssignmentSchema = new Schema(
  {
    committeeRef: { type: Schema.Types.ObjectId, ref: 'Committee', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 4000 },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    },
    // Proof of completion — optional, either or both may be filled in by
    // the assigned Member.
    proofText: { type: String, trim: true, maxlength: 4000, default: '' },
    proofImageUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

workAssignmentSchema.index({ assignedTo: 1, createdAt: -1 })
workAssignmentSchema.index({ assignedBy: 1, createdAt: -1 })

export default mongoose.model('WorkAssignment', workAssignmentSchema)
