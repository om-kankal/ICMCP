import User from '../models/User.js'
import Committee from '../models/Committee.js'
import { ApiError } from '../utils/apiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// Every user.save() below passes { validateModifiedOnly: true }. Without
// it, Mongoose re-validates every path on the document — including ones
// this request never touched — so a user whose `role` was set to a legacy
// value no longer in the schema enum (e.g. an old "Secretary" role from
// before the Admin/Coordinator/Member model) would fail ANY save, even an
// unrelated one like deleting them. Scoping validation to modified paths
// only fixes that without silently accepting new bad data anywhere else.

/** GET /api/users — Admin only. Powers the User Management page and roster pickers. */
export const listUsers = asyncHandler(async (req, res) => {
  const filter = { isActive: true }
  if (req.query.role) filter.role = req.query.role

  const users = await User.find(filter)
    .select('name email role designation committeeRefs createdAt')
    .sort({ name: 1 })
  res.status(200).json({ success: true, data: users })
})

/** POST /api/users — Admin only. Creates a Coordinator or Member account. */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, designation } = req.body

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) throw ApiError.conflict('A user with this email already exists')

  const user = new User({ name, email, role, designation })
  user.password = password
  await user.save({ validateModifiedOnly: true })

  res.status(201).json({ success: true, data: user.toSafeJSON() })
})

/** PATCH /api/users/:id — Admin only. Updates name, designation, role, or email. */
export const updateUser = asyncHandler(async (req, res) => {
  const { name, designation, role, email } = req.body
  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')

  if (email !== undefined && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) throw ApiError.conflict('A user with this email already exists')
    user.email = email.toLowerCase()
  }
  if (name !== undefined) user.name = name
  if (designation !== undefined) user.designation = designation

  // Admin is deliberately not settable here — see transferAdminRole below,
  // which swaps the current Admin and a target user atomically so the
  // single-Admin invariant can never leave the account with zero Admins
  // mid-transfer (every request re-checks role from the DB live, so a
  // plain two-step "demote yourself, then promote them" would lock the
  // Admin out of User Management after step one, before they could
  // complete step two).
  if (role !== undefined && role !== user.role) {
    if (user._id.toString() === req.user.id) {
      throw ApiError.badRequest('You cannot change your own role here — use Transfer Admin instead')
    }
    if (user.role === 'Admin') {
      throw ApiError.badRequest('Use Transfer Admin to change who holds the Admin role')
    }
    // A role change invalidates any existing committee-roster entries (a
    // former Coordinator's committees had them in coordinatorRefs, which
    // no longer makes sense once they're a Member, and vice versa) — clear
    // them out everywhere so the Admin re-assigns committees deliberately
    // via PATCH /:id/committees under the new role.
    if (user.committeeRefs?.length) {
      await Committee.updateMany(
        { _id: { $in: user.committeeRefs } },
        { $pull: { coordinatorRefs: user._id, memberRefs: user._id } }
      )
    }
    user.committeeRefs = []
    user.role = role
  }

  await user.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, data: user.toSafeJSON() })
})

/** PATCH /api/users/:id/reset-password — Admin only. Sets a new password on the user's behalf. */
export const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body
  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')

  user.password = newPassword // virtual → re-hashed by the pre-validate hook
  await user.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, message: 'Password reset' })
})

/** DELETE /api/users/:id — Admin only. Soft-delete (keeps history intact). */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')
  if (user._id.toString() === req.user.id) {
    throw ApiError.badRequest('You cannot delete your own account')
  }
  user.isActive = false
  await user.save({ validateModifiedOnly: true })
  res.status(200).json({ success: true, message: 'User deleted' })
})

/**
 * PATCH /api/users/:id/committees — Admin only. Sets exactly which
 * committees a Coordinator or Member belongs to, from the User Management
 * page (an alternative entry point to the same roster editing already
 * available per-committee on the Committee Registry page). Keeps
 * Committee.coordinatorRefs/memberRefs and User.committeeRefs in sync in
 * both directions.
 */
export const updateUserCommittees = asyncHandler(async (req, res) => {
  const { committeeIds = [] } = req.body
  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')
  if (user.role === 'Admin') {
    throw ApiError.badRequest('Admin accounts are not assigned to committee rosters')
  }

  const uniqueIds = [...new Set(committeeIds.map(String))]
  const committees = await Committee.find({ _id: { $in: uniqueIds }, isActive: true })
  if (committees.length !== uniqueIds.length) {
    throw ApiError.badRequest('One or more selected committees are invalid')
  }

  const refField = user.role === 'Coordinator' ? 'coordinatorRefs' : 'memberRefs'
  const previousIds = (user.committeeRefs || []).map((id) => id.toString())
  const toRemove = previousIds.filter((id) => !uniqueIds.includes(id))
  const toAdd = uniqueIds.filter((id) => !previousIds.includes(id))

  if (toRemove.length) {
    await Committee.updateMany({ _id: { $in: toRemove } }, { $pull: { [refField]: user._id } })
  }
  if (toAdd.length) {
    await Committee.updateMany({ _id: { $in: toAdd } }, { $addToSet: { [refField]: user._id } })
  }

  user.committeeRefs = uniqueIds
  await user.save({ validateModifiedOnly: true })

  res.status(200).json({ success: true, data: user.toSafeJSON() })
})

/**
 * POST /api/users/:id/transfer-admin — Admin only. The only way to change
 * who holds the Admin role: swaps it atomically in one request (target
 * becomes Admin, the calling Admin becomes Coordinator) rather than two
 * separate steps. A two-step "demote yourself, then promote them" flow
 * can't work here — role is re-checked from the DB on every request, so
 * the instant the current Admin demoted themselves they'd lose access to
 * User Management before completing step two, leaving zero Admins with no
 * in-app way to recover. This endpoint keeps the transfer a single
 * deliberate, explicitly-confirmed action without that gap.
 */
export const transferAdminRole = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id)
  if (!target) throw ApiError.notFound('User not found')
  if (target._id.toString() === req.user.id) {
    throw ApiError.badRequest('You are already the Admin')
  }
  if (target.role === 'Admin') throw ApiError.badRequest('This user is already the Admin')
  if (!target.isActive) throw ApiError.badRequest('Cannot promote a deleted account')

  const currentAdmin = await User.findById(req.user.id)
  if (!currentAdmin) throw ApiError.notFound('Your account could not be found')

  // The target's existing committee roster entries (if any) no longer make
  // sense once they're Admin — same cleanup as an ordinary role change.
  if (target.committeeRefs?.length) {
    await Committee.updateMany(
      { _id: { $in: target.committeeRefs } },
      { $pull: { coordinatorRefs: target._id, memberRefs: target._id } }
    )
  }
  target.committeeRefs = []
  target.role = 'Admin'
  await target.save({ validateModifiedOnly: true })

  currentAdmin.role = 'Coordinator'
  await currentAdmin.save({ validateModifiedOnly: true })

  res.status(200).json({
    success: true,
    message: `${target.name} is now the Admin. Your account has been changed to Coordinator.`
  })
})
