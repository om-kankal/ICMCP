import { useEffect, useRef, useState } from 'react'
import {
  ClipboardCheck,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  CircleDot,
  ImageIcon,
  X
} from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import SafeImage from '../shared/SafeImage'
import {
  listWorkAssignments,
  createWorkAssignment,
  updateWorkAssignment,
  updateWorkAssignmentStatus,
  deleteWorkAssignment,
  uploadWorkProof
} from '../../services/workAssignmentService'
import { listCommittees } from '../../services/committeeService'
import { resolveFileUrl } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

const STATUS_META = {
  Pending: { icon: CircleDot, tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' },
  'In Progress': { icon: Clock, tone: 'bg-status-dueBg text-status-due' },
  Completed: { icon: CheckCircle2, tone: 'bg-status-compliantBg text-status-compliant' }
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WorkAssign({ role }) {
  return role === 'coordinator' ? <CoordinatorView /> : <MemberView />
}

/* ---------------------------------- Coordinator ---------------------------------- */

const emptyForm = { committeeId: '', assignedTo: '', title: '', description: '', dueDate: '' }

function CoordinatorView() {
  const [assignments, setAssignments] = useState([])
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [assignmentsData, committeesData] = await Promise.all([listWorkAssignments(), listCommittees()])
      setAssignments(assignmentsData)
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
    setForm((prev) => ({ ...prev, [field]: value, ...(field === 'committeeId' ? { assignedTo: '' } : {}) }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setSubmitError(null)
  }

  function startEdit(a) {
    setEditingId(a._id)
    setForm({
      committeeId: a.committeeRef?._id || '',
      assignedTo: a.assignedTo?._id || '',
      title: a.title,
      description: a.description,
      dueDate: a.dueDate ? a.dueDate.slice(0, 10) : ''
    })
    setSubmitError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this work assignment?')) return
    try {
      await deleteWorkAssignment(id)
      if (editingId === id) resetForm()
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
        await updateWorkAssignment(editingId, {
          title: form.title,
          description: form.description,
          dueDate: form.dueDate || null
        })
        setToast(`${form.title} updated`)
      } else {
        await createWorkAssignment({
          committeeId: form.committeeId,
          assignedTo: form.assignedTo,
          title: form.title,
          description: form.description,
          dueDate: form.dueDate || undefined
        })
        setToast(`${form.title} assigned`)
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

  const selectedCommittee = committees.find((c) => c.id === form.committeeId)

  if (loading) return <Spinner label="Loading work assignments…" size="lg" />
  if (loadError) return <ErrorBanner message={loadError} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Work Assign</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Assign work to members of your committees. Each item is only visible to the member it's assigned to and to
          you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <form onSubmit={handleSubmit} className="order-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card xl:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Plus className="h-4 w-4 text-brand-700" /> {editingId ? 'Edit Work' : 'Assign Work'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                New instead
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Committee</label>
              <select
                required
                disabled={!!editingId}
                className={`${inputClasses} disabled:opacity-60`}
                value={form.committeeId}
                onChange={(e) => update('committeeId', e.target.value)}
              >
                <option value="">Select committee…</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Member</label>
              <select
                required
                disabled={!!editingId || !form.committeeId}
                className={`${inputClasses} disabled:opacity-60`}
                value={form.assignedTo}
                onChange={(e) => update('assignedTo', e.target.value)}
              >
                <option value="">Select member…</option>
                {(selectedCommittee?.members || []).map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              {form.committeeId && (selectedCommittee?.members || []).length === 0 && (
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  This committee has no Members assigned yet.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Title</label>
              <input
                required
                className={inputClasses}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Draft the annual NAAC report section"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Description</label>
              <textarea
                required
                rows={4}
                className={inputClasses}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What needs to be done…"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Due Date (optional)</label>
              <input
                type="date"
                className={inputClasses}
                value={form.dueDate}
                onChange={(e) => update('dueDate', e.target.value)}
              />
            </div>
          </div>

          {submitError && <div className="mt-5"><ErrorBanner message={submitError} /></div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Assign Work'}
          </button>
        </form>

        <div className="order-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card xl:col-span-2">
          <div className="border-b border-slate-100 dark:border-slate-800 p-5">
            <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Assigned Work</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{assignments.length} item{assignments.length === 1 ? '' : 's'}</p>
          </div>
          <ul className="divide-y divide-slate-50 dark:divide-slate-800">
            {assignments.map((a) => {
              const meta = STATUS_META[a.status]
              const Icon = meta.icon
              return (
                <li key={a._id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{a.description}</p>
                        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {a.committeeRef?.name} · Assigned to {a.assignedTo?.name}
                          {formatDate(a.dueDate) ? ` · Due ${formatDate(a.dueDate)}` : ''}
                        </p>
                        {(a.proofText || a.proofImageUrl) && (
                          <div className="mt-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Proof submitted</p>
                            {a.proofText && (
                              <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{a.proofText}</p>
                            )}
                            {a.proofImageUrl && (
                              <SafeImage
                                src={resolveFileUrl(a.proofImageUrl)}
                                alt="Proof"
                                className="mt-2 max-h-40 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${meta.tone}`}>{a.status}</span>
                      <button
                        onClick={() => startEdit(a)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 hover:text-brand-700"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(a._id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
            {assignments.length === 0 && (
              <li className="px-5 py-14 text-center">
                <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400 dark:text-slate-500">You haven't assigned any work yet.</p>
              </li>
            )}
          </ul>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 px-4 py-3 shadow-popover">
          <CheckCircle2 className="h-5 w-5 text-status-compliant" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{toast}</p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------- Member ------------------------------------- */

function MemberView() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setAssignments(await listWorkAssignments())
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <Spinner label="Loading your work…" size="lg" />
  if (error) return <ErrorBanner message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">My Work</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Work assigned to you by your committee coordinator. Only you and your coordinator can see this.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {assignments.map((a) => (
          <MemberWorkCard key={a._id} assignment={a} onUpdated={load} />
        ))}
      </div>

      {assignments.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center shadow-card">
          <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">No work has been assigned to you yet.</p>
        </div>
      )}
    </div>
  )
}

function MemberWorkCard({ assignment, onUpdated }) {
  const [status, setStatus] = useState(assignment.status)
  const [proofText, setProofText] = useState(assignment.proofText || '')
  const [proofImageUrl, setProofImageUrl] = useState(assignment.proofImageUrl || null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef(null)

  const dirty =
    status !== assignment.status || proofText !== (assignment.proofText || '') || proofImageUrl !== (assignment.proofImageUrl || null)

  async function handleProofImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const uploaded = await uploadWorkProof(file)
      setProofImageUrl(uploaded.cloudUrl)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await updateWorkAssignmentStatus(assignment._id, { status, proofText, proofImageUrl })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onUpdated?.()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const meta = STATUS_META[status]
  const StatusIcon = meta.icon

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
          <StatusIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{assignment.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">{assignment.description}</p>
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            {assignment.committeeRef?.name} · From {assignment.assignedBy?.name}
            {formatDate(assignment.dueDate) ? ` · Due ${formatDate(assignment.dueDate)}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
          <select className={inputClasses} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Proof of work <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <textarea
            rows={2}
            className={inputClasses}
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            placeholder="Add a note about what was done…"
          />
          <div className="mt-2 flex items-center gap-2.5">
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleProofImage} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {proofImageUrl ? 'Replace image' : 'Attach image'}
            </button>
            {proofImageUrl && (
              <button
                type="button"
                onClick={() => setProofImageUrl(null)}
                className="flex items-center gap-1 text-xs font-semibold text-status-overdue hover:underline"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          {proofImageUrl && (
            <SafeImage
              src={resolveFileUrl(proofImageUrl)}
              alt="Proof"
              className="mt-2 max-h-32 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
            />
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Update'}
        </button>
      </div>
    </div>
  )
}
