import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

const STATUS_MAP = {
  compliant: {
    label: 'Compliant',
    icon: CheckCircle2,
    classes: 'bg-status-compliantBg text-status-compliant border-status-compliantBorder'
  },
  due: {
    label: 'Due Soon',
    icon: Clock,
    classes: 'bg-status-dueBg text-status-due border-status-dueBorder'
  },
  overdue: {
    label: 'Overdue',
    icon: AlertTriangle,
    classes: 'bg-status-overdueBg text-status-overdue border-status-overdueBorder'
  }
}

export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.due
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {config.label}
    </span>
  )
}
