export default function MetricCard({ label, value, suffix = '', icon: Icon, tone = 'slate', trend }) {
  const toneMap = {
    slate: 'bg-brand-800 text-white',
    emerald: 'bg-status-compliantBg text-status-compliant border border-status-compliantBorder',
    amber: 'bg-status-dueBg text-status-due border border-status-dueBorder',
    rose: 'bg-status-overdueBg text-status-overdue border border-status-overdueBorder'
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-display text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
          {value}
          {suffix && <span className="text-lg text-slate-400 dark:text-slate-500 font-medium ml-0.5">{suffix}</span>}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.direction === 'up' ? 'text-status-compliant' : 'text-status-overdue'
            }`}
          >
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}
