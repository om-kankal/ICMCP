import { useEffect, useState } from 'react'
import { UserPlus, Loader2, CheckCircle2, Mail, Shield, Pencil, Trash2, KeyRound, Plus, Building2, ChevronDown, X, Crown, FileSpreadsheet, Download } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import BulkImportModal from './BulkImportModal'
import ExportUsersModal from './ExportUsersModal'
import { listUsers, createUser, updateUser, updateUserCommittees, transferAdminRole, resetUserPassword, deleteUser } from '../../services/userService'
import { listCommittees } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'
import { useAuth } from '../../context/AuthContext'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

// Admins can assign any role, including promoting/demoting other Admins.
// New accounts can only be Coordinator or Member — Admin promotion happens
// via the Edit form's role dropdown instead (single-Admin invariant).
const ROLES = ['Coordinator', 'Member']

const roleBadgeTone = {
  Admin: 'bg-brand-50 text-brand-800 border-brand-200',
  Coordinator: 'bg-status-dueBg text-status-due border-status-dueBorder',
  Member: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
}

const emptyForm = { name: '', email: '', password: '', role: 'Coordinator', designation: '' }

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [committeeIds, setCommitteeIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toast, setToast] = useState(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showExport, setShowExport] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [usersData, committeesData] = await Promise.all([listUsers(), listCommittees()])
      setUsers(usersData)
      setCommittees(committeesData)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setCommitteeIds([])
    setSubmitError(null)
  }

  function startEdit(u) {
    setEditingId(u._id)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, designation: u.designation || '' })
    setCommitteeIds((u.committeeRefs || []).map(String))
    setSubmitError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete ${u.name}'s account?`)) return
    try {
      await deleteUser(u._id)
      if (editingId === u._id) resetForm()
      load()
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    }
  }

  async function handleResetPassword(u) {
    const newPassword = window.prompt(`New temporary password for ${u.name} (min 6 characters):`)
    if (!newPassword) return
    if (newPassword.length < 6) {
      window.alert('Password must be at least 6 characters.')
      return
    }
    try {
      await resetUserPassword(u._id, newPassword)
      setToast(`Password reset for ${u.name}`)
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    }
  }

  async function handleTransferAdmin(u) {
    const confirmed = window.confirm(
      `Make ${u.name} the Admin? Your own account will immediately become a Coordinator. This can't be undone by yourself alone — you'd need the new Admin to transfer it back.`
    )
    if (!confirmed) return
    try {
      const message = await transferAdminRole(u._id)
      setToast(message)
      setTimeout(() => setToast(null), 4000)
      if (editingId === u._id) resetForm()
      load()
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (editingId) {
        await updateUser(editingId, {
          name: form.name,
          email: form.email,
          // Admin isn't a settable value on this endpoint — omit it
          // entirely when editing the current Admin's own profile so the
          // request only touches name/email/designation.
          ...(form.role !== 'Admin' ? { role: form.role } : {}),
          designation: form.designation
        })
        // A role change (handled above) clears any previous committee
        // assignment server-side, so this always applies against the
        // user's *current* (possibly just-changed) role.
        if (form.role !== 'Admin') {
          await updateUserCommittees(editingId, committeeIds)
        }
        setToast(`${form.name} updated`)
      } else {
        await createUser(form)
        setToast(`${form.name} (${form.role}) created`)
      }
      resetForm()
      load()
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">User Management</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Create, edit, or remove Admin, Coordinator, and Member accounts, reassign their committees, and reset
            passwords on their behalf.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand-700" /> Bulk Import (Excel)
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-brand-700" /> Export (Excel)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <form onSubmit={handleSubmit} className="order-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card xl:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
              <UserPlus className="h-4 w-4 text-brand-700" /> {editingId ? 'Edit Account' : 'Create Account'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <Plus className="h-3.5 w-3.5" /> New instead
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
              <input
                required
                pattern="[A-Za-z ]+"
                title="Letters and spaces only"
                className={inputClasses}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Jane Doe"
              />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Letters and spaces only.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Email</label>
              <input
                required
                type="email"
                className={inputClasses}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="jane.doe@institution.edu"
              />
            </div>
            {!editingId && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Temporary Password</label>
                <input
                  required
                  type="text"
                  minLength={6}
                  className={inputClasses}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Role</label>
              {form.role === 'Admin' ? (
                <>
                  <input disabled value="Admin" className={`${inputClasses} cursor-not-allowed opacity-70`} />
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    Use "Make Admin" on another account (in the list) to transfer this role — see the list on the
                    right.
                  </p>
                </>
              ) : (
                <select
                  className={inputClasses}
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Designation</label>
              <input
                className={inputClasses}
                value={form.designation}
                onChange={(e) => update('designation', e.target.value)}
                placeholder="e.g. Associate Professor, Dept. of Physics"
              />
            </div>

            {editingId && form.role !== 'Admin' && (
              <CommitteeMultiSelect committees={committees} selectedIds={committeeIds} setSelectedIds={setCommitteeIds} />
            )}
            {!editingId && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Committee assignment is available after the account is created — edit it from the list on the right.
              </p>
            )}
          </div>

          {submitError && (
            <div className="mt-5">
              <ErrorBanner message={submitError} />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Account'}
          </button>
        </form>

        <div className="order-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card xl:col-span-2">
          <div className="border-b border-slate-100 dark:border-slate-800 p-5">
            <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">All Users</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{loading ? 'Loading…' : `${users.length} accounts`}</p>
          </div>
          {loading && <Spinner label="Loading users…" />}
          {!loading && loadError && (
            <div className="p-5">
              <ErrorBanner message={loadError} onRetry={load} />
            </div>
          )}
          {!loading && !loadError && (
            <ul className="divide-y divide-slate-50 dark:divide-slate-800">
              {users.map((u) => (
                <li key={u._id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                    {u.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-400 dark:text-slate-500">
                      <Mail className="h-3 w-3" /> {u.email}
                    </p>
                    {u.role !== 'Admin' && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
                        <Building2 className="h-3 w-3" />
                        {(u.committeeRefs || []).length === 0
                          ? 'No committees'
                          : `${u.committeeRefs.length} committee${u.committeeRefs.length === 1 ? '' : 's'}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`hidden sm:flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roleBadgeTone[u.role]}`}
                  >
                    <Shield className="h-3 w-3" /> {u.role}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {u.role !== 'Admin' && (
                      <button
                        onClick={() => handleTransferAdmin(u)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700"
                        aria-label="Make Admin"
                        title="Make Admin (transfers the Admin role to this account)"
                      >
                        <Crown className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(u)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-700"
                      aria-label="Reset password"
                      title="Reset password"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => startEdit(u)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700"
                      aria-label="Edit user"
                      title="Edit / change committee"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {u._id !== currentUser.id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
                        aria-label="Delete user"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {users.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No users yet.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 px-4 py-3 shadow-popover">
          <CheckCircle2 className="h-5 w-5 text-status-compliant" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{toast}</p>
        </div>
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onCommitted={() => {
            load()
            setToast('Bulk import complete')
            setTimeout(() => setToast(null), 3000)
          }}
        />
      )}
      {showExport && (
        <ExportUsersModal
          committees={committees.map((c) => ({ id: c.id || c._id, name: c.name }))}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}

/** Dropdown checklist for assigning/changing which committees a user belongs to. */
function CommitteeMultiSelect({ committees, selectedIds, setSelectedIds }) {
  const [open, setOpen] = useState(false)
  const selected = committees.filter((c) => selectedIds.includes(c.id))

  function toggle(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <Building2 className="h-3.5 w-3.5" /> Committees
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${inputClasses} flex items-center justify-between text-left`}
        >
          <span className="text-slate-400 dark:text-slate-500">
            {selected.length === 0 ? 'Select committees…' : `${selected.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-popover">
            {committees.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">No committees registered yet.</p>
            )}
            {committees.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/40 px-2.5 py-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300"
            >
              {c.name}
              <button type="button" onClick={() => toggle(c.id)} className="hover:text-status-overdue">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
