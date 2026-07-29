// frontend/src/pages/Reports.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function Reports() {
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    // Fetch user settings to get their preferred currency
    try {
      const profileRes = await apiFetch('/api/settings')
      const profileData = await profileRes.json()
      console.log('User settings loaded:', profileData)
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleDownloadCSV = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/reports/download-csv')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoices_report_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading CSV:', error)
      alert('Failed to download CSV. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Financial Reports</h2>
        <button 
          onClick={handleDownloadCSV} 
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span> Downloading...
            </>
          ) : (
            <>
              📥 Download Invoices CSV
            </>
          )}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Click the button above to download all your invoices with their status in a CSV file.
          <br/>
          <span className="text-sm text-gray-500 dark:text-gray-500">
            Amounts will be converted to your preferred currency configured in Settings.
          </span>
        </p>
      </div>
    </div>
  )
}