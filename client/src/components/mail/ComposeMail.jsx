import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Paperclip, Send, Save, ChevronDown, ChevronUp, FileText, Trash2 } from 'lucide-react'
import { searchContacts, createMail, updateDraft, sendDraft, uploadAttachment } from '../../services/mailService'
import { extractErrorMessage } from '../../services/apiClient'
import ErrorBanner from '../shared/ErrorBanner'

const inputClasses =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-brand-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

function quoteBlock(mail) {
  const when = new Date(mail.sentAt || mail.createdAt).toLocaleString()
  return `\n\n---------- Original message ----------\nFrom: ${mail.from?.name || 'Unknown'} <${mail.from?.email || ''}>\nDate: ${when}\nSubject: ${mail.subject}\n\n${mail.body}`
}

/**
 * mode: 'new' | 'reply' | 'replyAll' | 'forward' | 'editDraft'
 * sourceMail: the mail being replied to / forwarded / edited (raw Mail doc, populated)
 * currentUserId: excluded automatically from Reply All's recipient list
 */
export default function ComposeMail({ mode = 'new', sourceMail = null, currentUserId, onClose, onSaved }) {
  const [draftId, setDraftId] = useState(mode === 'editDraft' ? sourceMail?._id : null)
  const [to, setTo] = useState(() => initialTo(mode, sourceMail))
  const [cc, setCc] = useState(() => initialCc(mode, sourceMail, currentUserId))
  const [bcc, setBcc] = useState(() => (mode === 'editDraft' ? sourceMail?.bcc || [] : []))
  const [showCcBcc, setShowCcBcc] = useState(() => (mode === 'editDraft' && (bccInit(sourceMail).length || ccInit(sourceMail).length)) || mode === 'replyAll')
  const [subject, setSubject] = useState(() => initialSubject(mode, sourceMail))
  const [body, setBody] = useState(() => initialBody(mode, sourceMail))
  const [attachments, setAttachments] = useState(() => (mode === 'editDraft' ? sourceMail?.attachments || [] : mode === 'forward' ? sourceMail?.attachments || [] : []))
  const [uploading, setUploading] = useState([])
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function buildPayload(isDraft) {
    return {
      to: to.map((u) => u.id),
      cc: cc.map((u) => u.id),
      bcc: bcc.map((u) => u.id),
      subject,
      body,
      attachments: attachments.map((a) => ({
        storageKey: a.storageKey,
        originalName: a.originalName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes
      })),
      isDraft,
      replyToMailId: mode === 'reply' || mode === 'replyAll' ? sourceMail?._id : undefined
    }
  }

  async function handleSend() {
    setError(null)
    if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
      setError('Add at least one recipient before sending.')
      return
    }
    setSending(true)
    try {
      if (draftId) {
        await updateDraft(draftId, buildPayload(true))
        await sendDraft(draftId)
      } else {
        await createMail(buildPayload(false))
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  async function handleSaveDraft() {
    setError(null)
    setSavingDraft(true)
    try {
      if (draftId) {
        await updateDraft(draftId, buildPayload(true))
      } else {
        const created = await createMail(buildPayload(true))
        setDraftId(created._id)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList)
    const pending = files.map((f) => ({ id: crypto.randomUUID(), name: f.name, progress: 0, error: null }))
    setUploading((prev) => [...prev, ...pending])

    for (let i = 0; i < files.length; i++) {
      const item = pending[i]
      try {
        const ref = await uploadAttachment(files[i], (pct) => {
          setUploading((prev) => prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u)))
        })
        setAttachments((prev) => [...prev, ref])
        setUploading((prev) => prev.filter((u) => u.id !== item.id))
      } catch (err) {
        setUploading((prev) => prev.map((u) => (u.id === item.id ? { ...u, error: extractErrorMessage(err) } : u)))
      }
    }
  }

  const title = { new: 'New Message', reply: 'Reply', replyAll: 'Reply All', forward: 'Forward', editDraft: 'Edit Draft' }[mode]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <RecipientField label="To" selected={to} onChange={setTo} />

          {showCcBcc ? (
            <>
              <RecipientField label="Cc" selected={cc} onChange={setCc} />
              <RecipientField label="Bcc" selected={bcc} onChange={setBcc} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              <ChevronDown className="h-3.5 w-3.5" /> Add Cc/Bcc
            </button>
          )}
          {showCcBcc && (
            <button
              type="button"
              onClick={() => {
                setShowCcBcc(false)
                setCc([])
                setBcc([])
              }}
              className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              <ChevronUp className="h-3.5 w-3.5" /> Hide Cc/Bcc
            </button>
          )}

          <input
            className={inputClasses}
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <textarea
            rows={10}
            className={inputClasses}
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach files
            </button>

            {(attachments.length > 0 || uploading.length > 0) && (
              <ul className="mt-2.5 space-y-1.5">
                {attachments.map((a, idx) => (
                  <li
                    key={a.storageKey || idx}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{a.originalName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-status-overdue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {uploading.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs">
                    {u.error ? (
                      <span className="text-status-overdue">{u.name}: {u.error}</span>
                    ) : (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
                        <span className="min-w-0 flex-1 truncate text-slate-500">{u.name} · {u.progress}%</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <ErrorBanner message={error} />}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={sending || savingDraft}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || savingDraft || uploading.length > 0}
            className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Chip-based To/Cc/Bcc field with a name/email search dropdown. */
function RecipientField({ label, selected, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const users = await searchContacts(query)
        setResults(users.filter((u) => !selected.some((s) => s.id === u._id)))
      } catch {
        setResults([])
      }
    }, 200)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selected])

  function addUser(user) {
    onChange([...selected, { id: user._id, name: user.name, email: user.email }])
    setQuery('')
  }

  function removeUser(id) {
    onChange(selected.filter((u) => u.id !== id))
  }

  return (
    <div ref={boxRef} className="relative">
      <div className={`flex flex-wrap items-center gap-1.5 ${inputClasses} min-h-[42px]`}>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{label}</span>
        {selected.map((u) => (
          <span
            key={u.id}
            className="flex items-center gap-1 rounded-full bg-brand-100 dark:bg-brand-900/40 px-2.5 py-1 text-xs font-medium text-brand-800 dark:text-brand-200"
          >
            {u.name}
            <button type="button" onClick={() => removeUser(u.id)} className="text-brand-600 hover:text-brand-900">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[100px] flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          placeholder={selected.length === 0 ? 'Search name or email…' : ''}
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-popover">
          {results.map((u) => (
            <li key={u._id}>
              <button
                type="button"
                onClick={() => addUser(u)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-[11px] font-semibold text-brand-800 dark:text-brand-200">
                  {initialsFor(u.name)}
                </span>
                <span className="min-w-0">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{u.name}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

function toRecipient(u) {
  return { id: u._id || u.id, name: u.name, email: u.email }
}

function ccInit(mail) {
  return mail?.cc || []
}
function bccInit(mail) {
  return mail?.bcc || []
}

function initialTo(mode, mail) {
  if (!mail) return []
  if (mode === 'reply' || mode === 'replyAll') return mail.from ? [toRecipient(mail.from)] : []
  if (mode === 'editDraft') return (mail.to || []).map(toRecipient)
  return []
}

function initialCc(mode, mail, currentUserId) {
  if (!mail) return []
  if (mode === 'replyAll') {
    const all = [...(mail.to || []), ...(mail.cc || [])]
    return all.filter((u) => (u._id || u.id) !== currentUserId && (u._id || u.id) !== (mail.from?._id || mail.from?.id)).map(toRecipient)
  }
  if (mode === 'editDraft') return (mail.cc || []).map(toRecipient)
  return []
}

function initialSubject(mode, mail) {
  if (!mail) return ''
  if (mode === 'editDraft') return mail.subject === '(no subject)' ? '' : mail.subject
  const subj = mail.subject === '(no subject)' ? '' : mail.subject
  if (mode === 'reply' || mode === 'replyAll') return subj.startsWith('Re: ') ? subj : `Re: ${subj}`
  if (mode === 'forward') return subj.startsWith('Fwd: ') ? subj : `Fwd: ${subj}`
  return ''
}

function initialBody(mode, mail) {
  if (!mail) return ''
  if (mode === 'editDraft') return mail.body || ''
  if (mode === 'reply' || mode === 'replyAll' || mode === 'forward') return quoteBlock(mail)
  return ''
}
