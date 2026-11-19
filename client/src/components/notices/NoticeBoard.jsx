import { useEffect, useState } from 'react'
import { Bell, Plus, Loader2, Trash2, Pin, CheckCircle2, X } from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import MicButton from '../shared/MicButton'
import { listNotices, createNotice, deleteNotice } from '../../services/noticeService'
import { listCommittees } from '../../services/committeeService'
import { extractErrorMessage } from '../../services/apiClient'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

const priorityTone = {
  Normal: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  Important: 'bg-status-dueBg text-status-due border-status-dueBorder',
  Urgent: 'bg-status-overdueBg text-status-overdue border-status-overdueBorder'
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NoticeBoard({ role, focusId, onFocusHandled }) {
  const canPost = role === 'admin' || role === 'coordinator'

  const [notices, setNotices] = useState([])
  const [committees, setCommittees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selectedNotice, setSelectedNotice] = useState(null)

  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal', committeeId: '', isPinned: false })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [noticesData, committeesData] = await Promise.all([listNotices(), canPost ? listCommittees() : []])
      setNotices(noticesData)
      setCommittees(committeesData)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arrived here via the dashboard updates ticker — auto-open that notice
  // once the list has loaded, then clear the request so revisiting this
  // page normally doesn't reopen it.
  useEffect(() => {
    if (!focusId || notices.length === 0) return
    const match = notices.find((n) => n._id === focusId)
    if (match) setSelectedNotice(match)
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, notices])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      await createNotice({
        title: form.title,
        content: form.content,
        priority: form.priority,
        committeeId: form.committeeId || undefined,
        isPinned: form.isPinned
      })
      setToast(form.title)
      setForm({ title: '', content: '', priority: 'Normal', committeeId: '', isPinned: false })
      load()
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this notice?')) return
    try {
      await deleteNotice(id)
      load()
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Notice Board</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {canPost
            ? 'Post institution-wide or committee-specific notices.'
            : 'Notices posted for your committees and the whole institution.'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${canPost ? 'xl:grid-cols-3' : ''}`}>
        {canPost && (
          <form onSubmit={handleSubmit} className="order-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card xl:col-span-1">
            <h3 className="mb-5 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Plus className="h-4 w-4 text-brand-700" /> New Notice
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Title</label>
                <input
                  required
                  className={inputClasses}
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Revised examination schedule"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Content</label>
                  <MicButton onAppend={(text) => update('content', form.content ? `${form.content} ${text}` : text)} />
                </div>
                <textarea
                  required
                  rows={5}
                  className={inputClasses}
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  placeholder="Notice details... or tap Speak to dictate"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Priority</label>
                  <select className={inputClasses} value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                    <option value="Normal">Normal</option>
                    <option value="Important">Important</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Audience</label>
                  <select className={inputClasses} value={form.committeeId} onChange={(e) => update('committeeId', e.target.value)}>
                    <option value="">Everyone</option>
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => update('isPinned', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                Pin to top
              </label>
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
              {submitting ? 'Posting…' : 'Post Notice'}
            </button>
          </form>
        )}

        <div className={`order-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card ${canPost ? 'xl:col-span-2' : ''}`}>
          <div className="border-b border-slate-100 dark:border-slate-800 p-5">
            <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">All Notices</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{loading ? 'Loading…' : `${notices.length} notices`}</p>
          </div>
          {loading && <Spinner label="Loading notices…" />}
          {!loading && loadError && (
            <div className="p-5">
              <ErrorBanner message={loadError} onRetry={load} />
            </div>
          )}
          {!loading && !loadError && (
            <ul className="divide-y divide-slate-50 dark:divide-slate-800">
              {notices.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No notices yet.</li>
              )}
              {notices.map((n) => (
                <li
                  key={n._id}
                  onClick={() => setSelectedNotice(n)}
                  className="cursor-pointer px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {n.isPinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityTone[n.priority]}`}>
                            {n.priority}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.content}</p>
                        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {n.committeeRef?.name || 'Institution-wide'} · {n.postedBy?.name} · {formatDate(n.createdAt)}
                        </p>
                      </div>
                    </div>
                    {canPost && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(n._id)
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
                        aria-label="Delete notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedNotice && <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 px-4 py-3 shadow-popover">
          <CheckCircle2 className="h-5 w-5 text-status-compliant" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notice posted</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Floating detail window for a notice, closable via the X button, Escape, or backdrop click. */
function NoticeDetailModal({ notice, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-dueBg text-status-due">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityTone[notice.priority]}`}>
                {notice.priority}
              </span>
              <h3 id="notice-detail-title" className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {notice.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{notice.content}</p>

          <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-400 dark:text-slate-500">
            <p>{notice.committeeRef?.name || 'Institution-wide'}</p>
            <p className="mt-0.5">Posted by {notice.postedBy?.name || 'Unknown'} · {formatDate(notice.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
