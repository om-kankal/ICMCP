import { Loader2 } from 'lucide-react'

export default function Spinner({ label = 'Loading…', size = 'md', className = '' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9' }
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 py-10 text-slate-400 dark:text-slate-500 ${className}`}>
      <Loader2 className={`${sizeMap[size]} animate-spin text-brand-600`} />
      {label && <p className="text-xs font-medium">{label}</p>}
    </div>
  )
}
