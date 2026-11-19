import { useEffect, useState } from 'react'
import {
  Newspaper,
  PartyPopper,
  Megaphone,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  MapPin,
  CalendarDays,
  X,
  Eye,
  Printer,
  Download
} from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import MicButton from '../shared/MicButton'
import DocumentPreviewModal from '../shared/DocumentPreviewModal'
import { listNewsEvents, createNewsEvent, deleteNewsEvent } from '../../services/newsService'
import { listCommittees } from '../../services/committeeService'
import { fetchNewsDocument, saveBlob } from '../../services/documentService'
import { extractErrorMessage } from '../../services/apiClient'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

const CATEGORY_META = {
  News: { icon: Newspaper, tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' },
  Event: { icon: PartyPopper, tone: 'bg-status-compliantBg text-status-compliant' },
  Announcement: { icon: Megaphone, tone: 'bg-status-overdueBg text-status-overdue' }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NewsEvents({ role, focusId, onFocusHandled }) {
  const canPost = role === 'admin' || role === 'coordinator'

  const [posts, setPosts] = useState([])
  const [committees, setCommittees] = useState([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [form, setForm] = useState({
    category: 'News',
    title: '',
    content: '',
    eventDate: '',
    location: '',
    committeeId: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toast, setToast] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [postsData, committeesData] = await Promise.all([listNewsEvents(), canPost ? listCommittees() : []])
      setPosts(postsData)
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

  // Arrived here via the dashboard updates ticker — auto-open that post
  // once the list has loaded, then clear the request.
  useEffect(() => {
    if (!focusId || posts.length === 0) return
    const match = posts.find((p) => p._id === focusId)
    if (match) setSelectedPost(match)
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, posts])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    if (form.category === 'Event' && !form.eventDate) {
      setSubmitError('Please set the event date.')
      return
    }
    setSubmitting(true)
    try {
      await createNewsEvent({
        category: form.category,
        title: form.title,
        content: form.content,
        eventDate: form.eventDate || undefined,
        location: form.location || undefined,
        committeeId: form.committeeId || undefined
      })
      setToast(form.title)
      setForm({ category: 'News', title: '', content: '', eventDate: '', location: '', committeeId: '' })
      load()
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this post?')) return
    try {
      await deleteNewsEvent(id)
      load()
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    }
  }

  const visiblePosts = filter === 'All' ? posts : posts.filter((p) => p.category === filter)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">News, Events &amp; Announcements</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {canPost ? 'Share news, upcoming events, and announcements.' : 'Latest news, events, and announcements.'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${canPost ? 'xl:grid-cols-3' : ''}`}>
        {canPost && (
          <form onSubmit={handleSubmit} className="order-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-card xl:col-span-1">
            <h3 className="mb-5 flex items-center gap-2 font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Plus className="h-4 w-4 text-brand-700" /> New Post
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
                <select className={inputClasses} value={form.category} onChange={(e) => update('category', e.target.value)}>
                  <option value="News">News</option>
                  <option value="Event">Event</option>
                  <option value="Announcement">Announcement</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Title</label>
                <input
                  required
                  className={inputClasses}
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Annual Tech Fest 2026"
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
                  placeholder="Details... or tap Speak to dictate"
                />
              </div>
              {form.category === 'Event' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Event Date</label>
                    <input
                      required
                      type="date"
                      className={inputClasses}
                      value={form.eventDate}
                      onChange={(e) => update('eventDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Location</label>
                    <input
                      className={inputClasses}
                      value={form.location}
                      onChange={(e) => update('location', e.target.value)}
                      placeholder="e.g. Main Auditorium"
                    />
                  </div>
                </div>
              )}
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
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </form>
        )}

        <div className={`order-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card ${canPost ? 'xl:col-span-2' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">All Posts</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{loading ? 'Loading…' : `${visiblePosts.length} posts`}</p>
            </div>
            <div className="flex gap-1.5">
              {['All', 'News', 'Event', 'Announcement'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    filter === f
                      ? 'border-brand-700 bg-brand-800 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {loading && <Spinner label="Loading posts…" />}
          {!loading && loadError && (
            <div className="p-5">
              <ErrorBanner message={loadError} onRetry={load} />
            </div>
          )}
          {!loading && !loadError && (
            <ul className="divide-y divide-slate-50 dark:divide-slate-800">
              {visiblePosts.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">Nothing here yet.</li>
              )}
              {visiblePosts.map((post) => {
                const meta = CATEGORY_META[post.category]
                const Icon = meta.icon
                return (
                  <li
                    key={post._id}
                    onClick={() => setSelectedPost(post)}
                    className="flex cursor-pointer items-start gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{post.title}</p>
                        {canPost && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(post._id)
                            }}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
                            aria-label="Delete post"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{post.content}</p>
                      {post.category === 'Event' && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDate(post.eventDate)}</span>
                          {post.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {post.location}</span>}
                        </div>
                      )}
                      <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {post.committeeRef?.name || 'Institution-wide'} · {post.postedBy?.name} · {formatDate(post.createdAt)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-status-compliantBorder bg-white dark:bg-slate-900 px-4 py-3 shadow-popover">
          <CheckCircle2 className="h-5 w-5 text-status-compliant" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Posted</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Floating detail window for a News/Event/Announcement post, closable via the X button, Escape, or backdrop click. */
function PostDetailModal({ post, onClose }) {
  const [docAction, setDocAction] = useState(null) // null | 'view' | 'print'
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleDownload() {
    setDownloadError(null)
    setDownloading(true)
    try {
      const { blob, filename } = await fetchNewsDocument(post._id)
      saveBlob(blob, filename)
    } catch (err) {
      setDownloadError(extractErrorMessage(err))
    } finally {
      setDownloading(false)
    }
  }

  const meta = CATEGORY_META[post.category]
  const Icon = meta.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {post.category}
              </span>
              <h3 id="post-detail-title" className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {post.title}
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
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{post.content}</p>

          {post.category === 'Event' && (
            <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(post.eventDate)}</span>
              {post.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {post.location}</span>}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-400 dark:text-slate-500">
            <p>{post.committeeRef?.name || 'Institution-wide'}</p>
            <p className="mt-0.5">Posted by {post.postedBy?.name || 'Unknown'} · {formatDate(post.createdAt)}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              onClick={() => setDocAction('view')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button
              onClick={() => setDocAction('print')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </button>
          </div>
          {downloadError && <div className="mt-3"><ErrorBanner message={downloadError} /></div>}
        </div>
      </div>

      {docAction && (
        <DocumentPreviewModal
          docType="news"
          meeting={post}
          autoPrint={docAction === 'print'}
          onClose={() => setDocAction(null)}
        />
      )}
    </div>
  )
}
