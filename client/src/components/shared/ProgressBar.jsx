export default function ProgressBar({ value, status = 'due' }) {
  const colorMap = {
    compliant: 'bg-status-compliant',
    due: 'bg-status-due',
    overdue: 'bg-status-overdue'
  }
  return (
    <div className="flex items-center gap-2.5 w-full min-w-[110px]">
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorMap[status]} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums w-9 text-right">{value}%</span>
    </div>
  )
}
