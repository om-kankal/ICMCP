import { env } from '../config/env.js'

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'
  let details = err.details || null

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 422
    message = 'Validation failed'
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyPattern || {}).join(', ') || 'field'
    message = `A record with this ${field} already exists`
  }

  // Malformed ObjectId
  if (err.name === 'CastError') {
    statusCode = 400
    message = `Invalid value for ${err.path}`
  }

  // Multer (bulk-import Excel upload — see bulkImportController.js)
  if (err.name === 'MulterError') {
    statusCode = 400
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 15 MB limit' : err.message
  }

  if (statusCode >= 500) {
    console.error('[error]', err)
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
    ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {})
  })
}
