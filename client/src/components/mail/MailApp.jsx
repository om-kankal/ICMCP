import { useCallback, useEffect, useState } from 'react'
import {
  Inbox,
  Send,
  FileEdit,
  Star,
  Archive,
  Trash2,
  Search,
  PenSquare,
  Paperclip,
  Reply,
  ReplyAll,
  Forward,
  ArchiveRestore,
  RotateCcw,
  FileText
} from 'lucide-react'
import Spinner from '../shared/Spinner'
import ErrorBanner from '../shared/ErrorBanner'
import ComposeMail from './ComposeMail'
import {
  listMail,
  getMailThread,
  updateMailState,
  permanentlyDeleteMail,
  resolveAttachmentUrl
} from '../../services/mailService'
import { extractErrorMessage } from '../../services/apiClient'

const FOLDERS = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'starred', label: 'Starred', icon: Star },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'draft', label: 'Drafts', icon: FileEdit },
  { key: 'archive', label: 'Archive', icon: Archive },
  { key: 'trash', label: 'Trash', icon: Trash2 }
]

function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

function formatTimestamp(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

function snippetOf(body = '') {
  return body.replace(/\s+/g, ' ').trim().slice(0, 110)
}

function participantLine(item, currentUserId) {
  const mail = item.mail
  if (item.folder === 'sent' || item.participantRole === 'from') {
    const names = [...(mail.to || []), ...(mail.cc || [])].map((u) => u.name)
    return names.length ? `To: ${names.join(', ')}` : 'To: (no recipients)'
  }
  return mail.from?.name || 'Unknown sender'
}

export default function MailApp({ currentUserId }) {
  const [folder, setFolder] = useState('inbox')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [selectedId, setSelectedId] = useState(null)
  const [thread, setThread] = useState(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState(null)

  const [compose, setCompose] = useState(null) // { mode, sourceMail }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await listMail(folder, search)
      setItems(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [folder, search])

  useEffect(() => {
    load()
    setSelectedId(null)
    setThread(null)
  }, [load])

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(handle)
  }, [searchInput])

  async function openMail(item) {
    if (item.folder === 'draft') {
      setCompose({ mode: 'editDraft', sourceMail: item.mail })
      return
    }
    setSelectedId(item.mail._id)
    setThreadLoading(true)
    setThreadError(null)
    try {
      const data = await getMailThread(item.mail._id)
      setThread(data)
      // Reflect the read flip immediately in the list without a full reload.
      setItems((prev) => prev.map((i) => (i.mail._id === item.mail._id ? { ...i, isRead: true } : i)))
    } catch (err) {
      setThreadError(extractErrorMessage(err))
    } finally {
      setThreadLoading(false)
    }
  }

  async function toggleStar(item, e) {
    e?.stopPropagation()
    const next = !item.isStarred
    setItems((prev) => prev.map((i) => (i.mail._id === item.mail._id ? { ...i, isStarred: next } : i)))
    try {
      await updateMailState(item.mail._id, { isStarred: next })
    } catch {
      load()
    }
  }

  async function moveTo(mailId, transition) {
    try {
      await updateMailState(mailId, { folder: transition })
      setSelectedId(null)
      setThread(null)
      load()
    } catch (err) {
      setThreadError(extractErrorMessage(err))
    }
  }

  async function handlePermanentDelete(mailId) {
    if (!window.confirm('Permanently delete this mail? This cannot be undone.')) return
    try {
      await permanentlyDeleteMail(mailId)
      setSelectedId(null)
      setThread(null)
      load()
    } catch (err) {
      setThreadError(extractErrorMessage(err))
    }
  }

  const unreadInbox = folder === 'inbox' ? items.filter((i) => !i.isRead).length : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Mail</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Send and receive mail with anyone in the institution.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Search mail or people…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button
            onClick={() => setCompose({ mode: 'new', sourceMail: null })}
            className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <PenSquare className="h-4 w-4" /> Compose
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-2">
          <nav className="space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 shadow-card">
            {FOLDERS.map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.key}
                  onClick={() => setFolder(f.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    folder === f.key
                      ? 'bg-brand-800 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {f.label}
                  {f.key === 'inbox' && unreadInbox > 0 && (
                    <span
                      className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        folder === f.key ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-800'
                      }`}
                    >
                      {unreadInbox}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
          <div className="border-b border-slate-100 dark:border-slate-800 p-4">
            <p className="font-display text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{folder}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{loading ? 'Loading…' : `${items.length} mail${items.length === 1 ? '' : 's'}`}</p>
          </div>
          {loading && <Spinner label="Loading mail…" />}
          {!loading && loadError && (
            <div className="p-4">
              <ErrorBanner message={loadError} onRetry={load} />
            </div>
          )}
          {!loading && !loadError && (
            <ul className="max-h-[65vh] divide-y divide-slate-50 dark:divide-slate-800 overflow-y-auto">
              {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No mail here.</li>}
              {items.map((item) => (
                <li
                  key={item.stateId}
                  onClick={() => openMail(item)}
                  className={`cursor-pointer px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    selectedId === item.mail._id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-[11px] font-semibold text-brand-800 dark:text-brand-200">
                      {initialsFor(item.folder === 'sent' || item.participantRole === 'from' ? item.mail.to?.[0]?.name || item.mail.from?.name : item.mail.from?.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${!item.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                          {participantLine(item, currentUserId)}
                        </p>
                        <button onClick={(e) => toggleStar(item, e)} className="shrink-0">
                          <Star className={`h-4 w-4 ${item.isStarred ? 'fill-status-due text-status-due' : 'text-slate-300 hover:text-slate-400'}`} />
                        </button>
                      </div>
                      <p className={`truncate text-sm ${!item.isRead ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                        {item.mail.subject}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                        <p className="truncate">{snippetOf(item.mail.body)}</p>
                        {item.mail.attachments?.length > 0 && <Paperclip className="h-3 w-3 shrink-0" />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{formatTimestamp(item.mail.sentAt || item.mail.createdAt)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-card">
          {!selectedId && (
            <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              Select a mail to read it.
            </div>
          )}
          {selectedId && threadLoading && <Spinner label="Loading conversation…" />}
          {selectedId && !threadLoading && threadError && (
            <div className="p-5">
              <ErrorBanner message={threadError} onRetry={() => openMail({ mail: { _id: selectedId }, folder })} />
            </div>
          )}
          {selectedId && !threadLoading && !threadError && thread && (
            <MailThreadView
              thread={thread}
              currentUserId={currentUserId}
              onReply={(mode, mail) => setCompose({ mode, sourceMail: mail })}
              onMoveTo={moveTo}
              onPermanentDelete={handlePermanentDelete}
            />
          )}
        </div>
      </div>

      {compose && (
        <ComposeMail
          mode={compose.mode}
          sourceMail={compose.sourceMail}
          currentUserId={currentUserId}
          onClose={() => setCompose(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function MailThreadView({ thread, currentUserId, onReply, onMoveTo, onPermanentDelete }) {
  const last = thread[thread.length - 1]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5">
        <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-slate-900 dark:text-white">{last.mail.subject}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {last.folder === 'trash' ? (
            <>
              <button
                onClick={() => onMoveTo(last.mail._id, 'restore')}
                title="Restore"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-700"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPermanentDelete(last.mail._id)}
                title="Delete forever"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onMoveTo(last.mail._id, last.folder === 'archive' ? 'inbox' : 'archive')}
                title={last.folder === 'archive' ? 'Move to Inbox' : 'Archive'}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-700"
              >
                {last.folder === 'archive' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onMoveTo(last.mail._id, 'trash')}
                title="Move to Trash"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-status-overdueBg hover:text-status-overdue"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {thread.map((item) => (
          <MailMessage key={item.mail._id} item={item} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-4">
        <button
          onClick={() => onReply('reply', last.mail)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Reply className="h-4 w-4" /> Reply
        </button>
        <button
          onClick={() => onReply('replyAll', last.mail)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ReplyAll className="h-4 w-4" /> Reply All
        </button>
        <button
          onClick={() => onReply('forward', last.mail)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Forward className="h-4 w-4" /> Forward
        </button>
      </div>
    </div>
  )
}

function MailMessage({ item }) {
  const mail = item.mail
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-[11px] font-semibold text-brand-800 dark:text-brand-200">
            {initialsFor(mail.from?.name)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{mail.from?.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{mail.from?.email}</p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              To: {mail.to?.map((u) => u.name).join(', ') || '—'}
              {mail.cc?.length > 0 && <> · Cc: {mail.cc.map((u) => u.name).join(', ')}</>}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatTimestamp(mail.sentAt || mail.createdAt)}</p>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{mail.body}</p>

      {mail.attachments?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {mail.attachments.map((a) => (
            <li key={a.storageKey}>
              <a
                href={resolveAttachmentUrl(`/api/uploads/file/${encodeURIComponent(a.storageKey)}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <FileText className="h-3.5 w-3.5 text-brand-600" />
                {a.originalName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
