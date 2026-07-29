// frontend/src/pages/Reports.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function Reports() {
  const [summary, setSummary] = useState({ total_billed: 0, total_collected: 0, total_pending: 0, total_gst: 0 })
  const [monthly, setMonthly] = useState({})
  const [taxLabel, setTaxLabel] = useState('Tax') // Default fallback

  useEffect(() => { fetchReports() }, [])

    const fetchReports = async () => {
    // Fetch Reports
    const res = await apiFetch('/api/reports/summary')
    const data = await res.json()
    setSummary(data.summary)
    setMonthly(data.monthly)

    // Fetch User Profile to get their specific Tax Label
    const profileRes = await apiFetch('/api/settings')
    const profileData = await profileRes.json()
    if (profileData.profile && profileData.profile.tax_label) {
      setTaxLabel(profileData.profile.tax_label.toUpperCase()) // e.g., "VAT", "GST", "SALES TAX"
    }
  }

  const handleDownloadCSV = async () => {
    const res = await apiFetch('/api/reports/download-csv')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'financial_report.csv'
    a.click()
  }

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Financial Reports</h2>
        <button onClick={handleDownloadCSV} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2">
          📥 Download CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportCard title="Total Billed" value={formatCurrency(summary.total_billed)} color="blue" />
          <ReportCard 
          title={`Total ${taxLabel} Collected`} 
          value={formatCurrency(summary.total_tax)} 
          color="purple" 
        />
        <ReportCard title="Pending / Overdue" value={formatCurrency(summary.total_pending)} color="red" />
        <ReportCard title="Total GST Collected" value={formatCurrency(summary.total_gst)} color="purple" />
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Monthly Performance</h3>
        {Object.keys(monthly).length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No data available yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(monthly).sort().reverse().map(([month, data]) => (
              <div key={month} className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>{month}</span>
                  <span>{formatCurrency(data.billed)}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${Math.min((data.collected / data.billed) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Collected: {formatCurrency(data.collected)} ({data.billed > 0 ? ((data.collected / data.billed) * 100).toFixed(0) : 0}%)
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportCard({ title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800'
  }
  return (
    <div className={`p-6 rounded-xl border ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  )
}