import { Mic, MicOff, AlertCircle } from 'lucide-react'
import { useSpeechToText } from '../../hooks/useSpeechToText'

/**
 * Drop-in "Speak" button for large text inputs (Minutes/Proceedings, Notice
 * content, News/Event content, etc). Uses the browser's built-in speech
 * recognition — free, no server involved. Renders nothing on browsers that
 * don't support it (Firefox, Safari) so the layout stays clean.
 *
 * onAppend(text) is called with each finalized chunk of speech — the caller
 * decides how to merge it into the field's current value. While listening,
 * a live preview of the in-progress phrase is shown so the person can see
 * — and re-say anything that came out wrong — before it's committed.
 */
export default function MicButton({ onAppend, className = '' }) {
  const { supported, listening, error, interimText, toggle } = useSpeechToText({
    onResult: (text, isFinal) => {
      if (isFinal && text.trim()) onAppend(text.trim())
    }
  })

  if (!supported) return null

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        title={listening ? 'Stop voice input' : 'Speak to fill this field'}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
          listening
            ? 'border-status-overdueBorder bg-status-overdueBg text-status-overdue'
            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300'
        } ${className}`}
      >
        {listening ? <MicOff className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-3.5 w-3.5" />}
        {listening ? 'Listening…' : 'Speak'}
      </button>

      {listening && (
        <span className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] italic leading-snug text-slate-500 dark:text-slate-400 shadow-popover">
          {interimText || 'Listening — start speaking…'}
        </span>
      )}

      {error && (
        <span className="absolute left-0 top-full z-20 mt-1 flex w-56 items-start gap-1.5 rounded-lg border border-status-overdueBorder bg-white dark:bg-slate-900 p-2.5 text-[11px] leading-snug text-status-overdue shadow-popover">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </span>
      )}
    </div>
  )
}
