import mongoose from 'mongoose'

const { Schema } = mongoose

const actionTakenItemSchema = new Schema(
  {
    item: { type: String, required: true, trim: true },
    responsible: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    }
  },
  { _id: false }
)

const meetingSchema = new Schema(
  {
    committeeRef: {
      type: Schema.Types.ObjectId,
      ref: 'Committee',
      required: true,
      index: true
    },
    quarter: {
      type: String,
      required: true,
      trim: true // e.g. "Q1 2026-27"
    },
    semester: {
      type: String,
      enum: ['Odd', 'Even'],
      default: null
    },
    academicYear: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Academic year must look like 2026-27']
    },

    // --- Lifecycle -----------------------------------------------------
    // A meeting starts life as 'Scheduled' (created by a Coordinator/Admin
    // with just a date, venue, and agenda) and transitions to 'Conducted'
    // once someone actually holds it and logs minutes + evidence.
    status: {
      type: String,
      enum: ['Scheduled', 'Conducted', 'Cancelled'],
      default: 'Scheduled'
    },
    type: {
      type: String,
      enum: ['Regular Quarterly', 'Ad-hoc / Special'],
      default: 'Regular Quarterly'
    },
    venue: { type: String, trim: true, default: '' },

    scheduledDate: {
      type: Date,
      required: true
    },
    actualDate: {
      type: Date,
      default: null
    },

    // --- Content used to generate Notice / Agenda documents ------------
    agendaItems: [{ type: String, trim: true }],

    // --- Content used to generate Minutes of Meeting / Action Taken ----
    membersPresent: [{ type: String, trim: true }],
    membersAbsent: [{ type: String, trim: true }],
    minutesText: { type: String, trim: true, default: '' },
    actionTakenItems: [actionTakenItemSchema],

    files: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Document'
      }
    ],

    scheduledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    conductedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
)

meetingSchema.index({ committeeRef: 1, scheduledDate: -1 })

export default mongoose.model('Meeting', meetingSchema)
