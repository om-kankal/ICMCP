import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * Holds the *result of analyzing* an uploaded committee/user Excel sheet
 * (see utils/bulkImportExcel.js) between the two-step admin flow:
 *   1. POST /api/admin/bulk-import/analyze  — parses the file, diffs every
 *      row against the DB, writes one of these, and returns it for the
 *      Admin to review (nothing is written to Committee/User yet).
 *   2. POST /api/admin/bulk-import/commit    — takes the batch id back and
 *      actually applies it.
 * Keeping the parsed rows server-side between the two calls means a 50+ row
 * sheet is only ever parsed once, and what gets committed is exactly what
 * the Admin reviewed (not a second, potentially different, re-upload).
 * TTL-expires after 30 minutes if never committed.
 */
const bulkImportBatchSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['analyzed', 'committed'],
      default: 'analyzed'
    },
    // Parsed + diffed rows, exactly as returned to the client by /analyze.
    // Stored as Mixed since its shape is internal to bulkImportExcel.js.
    rows: { type: Schema.Types.Mixed, default: [] },
    summary: { type: Schema.Types.Mixed, default: {} },
    committedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
)

export default mongoose.model('BulkImportBatch', bulkImportBatchSchema)
