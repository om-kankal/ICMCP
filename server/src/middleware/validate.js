import { validationResult } from 'express-validator'
import { ApiError } from '../utils/apiError.js'

/**
 * Runs after a chain of express-validator checks. Collects any failures
 * into a single structured 422 response instead of throwing on the first
 * bad field, so the client can highlight every invalid input at once.
 */
export function validate(req, res, next) {
  const result = validationResult(req)
  if (result.isEmpty()) return next()

  const details = result.array().map((e) => ({ field: e.path, message: e.msg }))
  next(new ApiError(422, 'Validation failed', details))
}
