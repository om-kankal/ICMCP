import { useEffect, useRef, useState } from 'react'
import { UploadCloud, FileText, ImageIcon, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { uploadFile } from '../../services/meetingService'
import { extractErrorMessage } from '../../services/apiClient'

/**
 * fileType: 'Agenda' | 'MoM' | 'Photo' — passed straight through to the
 * presign endpoint, which validates the mimetype against it server-side.
 * onFilesChange(uploadedFileRefs[]) fires whenever the set of *successfully
 * uploaded* files changes, so the parent form can attach them to the meeting.
 */
export default function DropZone({ label, accept, hint, multiple = false, icon, fileType, onFilesChange }) {
  const [items, setItems] = useState([]) // { id, name, size, previewUrl, status, progress, error, ref }
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const Icon = icon === 'image' ? ImageIcon : FileText

  // Reporting the uploaded-file list up to the parent form is a side effect,
  // so it belongs in an effect that runs *after* render — never inside a
  // setState updater function (React logs "Cannot update a component while
  // rendering a different component" if a parent's setter is invoked from
  // inside a child's updater, since updater functions are expected to be
  // pure). The lastReportedRef guard just avoids redundant calls when items
  // change for reasons that don't affect the "done" subset (e.g. progress
  // ticking up on an in-flight upload).
  const lastReportedRef = useRef(null)
  useEffect(() => {
    const doneRefs = items.filter((i) => i.status === 'done').map((i) => i.ref)
    const signature = doneRefs.map((r) => r.storageKey).join('|')
    if (signature === lastReportedRef.current) return
    lastReportedRef.current = signature
    onFilesChange?.(doneRefs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function addFiles(fileList) {
    const incoming = Array.from(fileList).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: (f.size / 1024).toFixed(0) + ' KB',
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      status: 'uploading',
      progress: 0,
      error: null,
      ref: null
    }))

    setItems((prev) => (multiple ? [...prev, ...incoming] : incoming))

    for (const item of incoming) {
      try {
        const ref = await uploadFile(item.file, fileType, (pct) => {
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i)))
        })
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'done', ref } : i)))
      } catch (err) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: extractErrorMessage(err) } : i))
        )
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {accept}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-brand-300 hover:bg-brand-50/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <UploadCloud className="h-5 w-5" strokeWidth={2} />
        </div>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="text-brand-700">Click to upload</span> or drag and drop
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
      </div>

      {items.length > 0 && (
        <ul className={`mt-3 ${icon === 'image' ? 'grid grid-cols-3 gap-2' : 'space-y-2'}`}>
          {items.map((item) =>
            icon === 'image' && item.previewUrl ? (
              <li key={item.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                {item.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-status-overdue/80">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(item.id)
                  }}
                  className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ) : (
              <li key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{item.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.size}</p>
                  </div>
                  {item.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-500" />}
                  {item.status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-status-compliant" />}
                  {item.status === 'error' && <AlertTriangle className="h-4 w-4 shrink-0 text-status-overdue" />}
                  <button onClick={() => removeItem(item.id)} className="text-slate-400 dark:text-slate-500 hover:text-status-overdue">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && <p className="mt-1.5 text-[11px] text-status-overdue">{item.error}</p>}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}
