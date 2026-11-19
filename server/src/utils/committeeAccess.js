/**
 * True if the requesting user can see/act on this committee: Admins see
 * everything. Works whether coordinatorRefs/memberRefs are raw ObjectIds
 * or already-populated User documents (population changes what .toString()
 * returns, so we normalize via ._id when present).
 */
function idOf(entry) {
  return (entry._id ? entry._id : entry).toString()
}

export function isVisibleToUser(committee, user) {
  if (user.role === 'Admin') return true
  const ids = [...committee.coordinatorRefs, ...committee.memberRefs].map(idOf)
  return ids.includes(user.id)
}
