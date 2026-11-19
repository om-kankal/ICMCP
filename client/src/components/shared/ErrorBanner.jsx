import { AlertTriangle, RotateCw } from 'lucide-react'

export default function ErrorBanner({ message, onRetry, className = '' }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-status-overdueBorder bg-status-overdueBg p-4 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-status-overdue" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-status-overdue">{message || 'Something went wrong.'}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-status-overdueBorder bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-status-overdue hover:bg-status-overdueBg"
        >
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  )
}
