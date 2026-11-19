import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

/**
 * Props come straight from GET /api/dashboard/metrics:
 *  - quarterly: [{ quarter: 'Q1 2026-27', meetingsLogged: 4 }, ...]
 *  - statusDistribution: { compliant, due, overdue }
 */
export default function ComplianceChart({ quarterly = [], statusDistribution }) {
  const [mode, setMode] = useState('quarterly')

  const barData = useMemo(
    () => ({
      labels: quarterly.map((q) => q.quarter),
      datasets: [
        {
          label: 'Meetings Logged',
          data: quarterly.map((q) => q.meetingsLogged),
          backgroundColor: '#0d9488',
          borderRadius: 4,
          maxBarThickness: 32
        }
      ]
    }),
    [quarterly]
  )

  const doughnutData = useMemo(
    () => ({
      labels: ['Compliant', 'Due Soon', 'Overdue'],
      datasets: [
        {
          data: [statusDistribution.compliant, statusDistribution.due, statusDistribution.overdue],
          backgroundColor: ['#059669', '#d97706', '#e11d48'],
          borderWidth: 0,
          hoverOffset: 6
        }
      ]
    }),
    [statusDistribution]
  )

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#115e59', padding: 10, cornerRadius: 8 }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b', font: { size: 11 }, precision: 0 }
      }
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, font: { size: 11 }, color: '#475569' }
      },
      tooltip: { backgroundColor: '#115e59', padding: 10, cornerRadius: 8 }
    }
  }

  const hasQuarterlyData = quarterly.length > 0

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">Compliance Analytics</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {mode === 'quarterly' ? 'Meetings logged per academic quarter' : 'Current status distribution'}
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-semibold">
          <button
            onClick={() => setMode('quarterly')}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              mode === 'quarterly' ? 'bg-white dark:bg-slate-900 text-brand-800 shadow-sm' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setMode('overall')}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              mode === 'overall' ? 'bg-white dark:bg-slate-900 text-brand-800 shadow-sm' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Overall
          </button>
        </div>
      </div>
      <div className="h-64">
        {mode === 'quarterly' ? (
          hasQuarterlyData ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400 dark:text-slate-500">
              No meetings logged yet this cycle.
            </div>
          )
        ) : (
          <Doughnut data={doughnutData} options={doughnutOptions} />
        )}
      </div>
    </div>
  )
}
