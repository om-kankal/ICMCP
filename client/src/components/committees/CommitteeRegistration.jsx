import { useEffect, useState } from 'react'
import { CheckCircle2, Users2, Loader2, X, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import {
  listCommittees,
  createCommittee,
  updateCommittee,
  updateCommitteeMembers,
  deleteCommittee
} from '../../services/committeeService'
import { listUsers } from '../../services/userService'
import { extractErrorMessage } from '../../services/apiClient'
import { useAcademicYear } from '../../context/AcademicYearContext'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

export default function CommitteeRegistration({ onViewDetails }) {
  const { years, selectedYear, current: currentYear } = useAcademicYear()
  const emptyForm = { name: '', mandate: '', year: selectedYear || currentYear }
  const [committees, setCommittees] = useState([])
  const [coordinatorOptions, setCoordinatorOptions] = useState([])
  const [memberOptions, setMemberOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [coordinatorIds, setCoordinatorIds] = useState([])
  const [memberIds, setMemberIds] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [committeesData, coordinators, members] = await Promise.all([
        listCommittees(selectedYear),
        listUsers('Coordinator'),
        listUsers('Member')
      ])
      setCommittees(committeesData)
      setCoordinatorOptions(coordinators)
      setMemberOptions(members)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setCoordinatorIds([])
    setMemberIds([])
    setSubmitError(null)
  }

  function startEdit(committee) {
    setEditingId(committee.id)
    setForm({ name: committee.name, mandate: committee.mandate, year: committee.academicYear })
    setCoordinatorIds((committee.coordinators || []).map((c) => c._id))
    setMemberIds((committee.members || []).map((m) => m._id))
    setSubmitError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(committee) {
    if (!window.confirm(`Delete "${committee.name}"? This can't be undone.`)) return
    try {
      await deleteCommittee(committee.id)
      if (editingId === committee.id) resetForm()
      load()
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    if (coordinatorIds.length === 0) {
      setSubmitError('Assign at least one Coordinator before saving.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await updateCommittee(editingId, { name: form.name, type: form.mandate, academicYear: form.year })
        await updateCommitteeMembers(editingId, { coordinatorIds, memberIds })
        setToast(`${form.name} updated`)
      } else {
        await createCommittee({
          name: form.name,
          type: form.mandate,
          academicYear: form.year,
          coordinatorIds,
          memberIds
        })
        setToast(`${form.name} registered`)
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

  if (loading) return <Spinner label="Loading…" size="lg" />
  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Committee Registry</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Register, update, or remove statutory committees and manage their Coordinator/Member roster.
        </p>
      </div>

      {(coordinatorOptions.length === 0 || memberOptions.length === 0) && (
        <div className="rounded-lg border border-status-dueBorder bg-status-dueBg p-4 text-sm text-status-due">
          {coordinatorOptions.length === 0 ? 'No Coordinator accounts exist yet. ' : ''}
          Go to User Management to create Coordinator and Member accounts before registering a committee that needs them.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="order-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card xl:order-1">
          <h3 className="mb-1 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Registered Committees</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{committees.length} active this academic year</p>
          <ul className="space-y-2.5">
            {committees.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => onViewDetails?.(c.id)}
                  className="flex flex-1 min-w-0 items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5 text-left hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-slate-800"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/40 text-[11px] font-bold text-brand-700 dark:text-brand-300">
                    {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{c.name}</p>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{c.secretary}</p>
                  </div>
                </button>
                <button
                  onClick={() => startEdit(c)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700"
                  aria-label="Edit committee"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
                  aria-label="Delete committee"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {committees.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">No committees registered yet.</p>
            )}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="order-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card xl:order-2 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
              {editingId ? 'Edit Committee' : 'Committee Details'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <Plus className="h-3.5 w-3.5" /> New committee instead
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Committee Name</label>
              <input
                required
                placeholder="e.g. Curriculum Development Committee"
                className={inputClasses}
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Mandate / Type</label>
              <input
                required
                placeholder="e.g. NBA / Curriculum Design"
                className={inputClasses}
                value={form.mandate}
                onChange={(e) => updateForm('mandate', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Academic Year</label>
              <select className={inputClasses} value={form.year} onChange={(e) => updateForm('year', e.target.value)}>
                {[...new Set([...(years.length ? years : [currentYear]), form.year])].filter(Boolean).sort().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <MultiSelect
              label="Coordinators"
              icon={Users2}
              options={coordinatorOptions}
              selectedIds={coordinatorIds}
              setSelectedIds={setCoordinatorIds}
              required
            />
            <MultiSelect
              label="Members"
              icon={Users2}
              options={memberOptions}
              selectedIds={memberIds}
              setSelectedIds={setMemberIds}
            />
          </div>

          {submitError && (
            <div className="mt-6"><ErrorBanner message={submitError} /></div>
          )}

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="button"
              disabled={submitting}
              onClick={resetForm}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Register Committee'}
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 px-4 py-3 shadow-popover">
          <CheckCircle2 className="h-5 w-5 text-status-compliant" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Saved</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Dropdown-driven multi-select: click to open a checklist, selections show as removable chips. */
function MultiSelect({ label, icon: Icon, options, selectedIds, setSelectedIds, required }) {
  const [open, setOpen] = useState(false)
  const selected = options.filter((o) => selectedIds.includes(o._id))

  function toggle(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <Icon className="h-3.5 w-3.5" /> {label} {required && <span className="text-status-overdue">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${inputClasses} flex items-center justify-between text-left`}
        >
          <span className="text-slate-400 dark:text-slate-500">
            {selected.length === 0 ? `Select ${label.toLowerCase()}…` : `${selected.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-popover">
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">No accounts available.</p>
            )}
            {options.map((o) => (
              <label
                key={o._id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(o._id)}
                  onChange={() => toggle(o._id)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                <div className="min-w-0">
                  <p className="truncate">{o.name}</p>
                  <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{o.designation || o.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <span
              key={o._id}
              className="flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/40 px-2.5 py-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300"
            >
              {o.name}
              <button type="button" onClick={() => toggle(o._id)} className="hover:text-status-overdue">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
