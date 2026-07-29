// frontend/src/pages/RecurringInvoices.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function RecurringInvoices() {
  const navigate = useNavigate()
  const [recurring, setRecurring] = useState([])

  useEffect(() => { fetchRecurring() }, [])

  const fetchRecurring = async () => {
    const res = await apiFetch('/api/recurring')
    const data = await res.json()
    setRecurring(data.recurring || [])
  }

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await apiFetch(`/api/recurring/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
    fetchRecurring()
  }

  const deleteRecurring = async (id) => {
    if(window.confirm('Delete this recurring template?')) {
      await apiFetch(`/api/recurring/${id}`, { method: 'DELETE' })
      fetchRecurring()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Recurring Invoices</h2>
        <button onClick={() => navigate('/recurring/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            + New Recurring Template
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Client</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Frequency</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Amount</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Status</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recurring.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">No recurring invoices set up yet.</td></tr>
            ) : (
              recurring.map(rec => (
                <tr key={rec.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-4 font-medium text-gray-800 dark:text-gray-100">{rec.clients?.name}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-300 capitalize">{rec.frequency}</td>
                  <td className="p-4 font-semibold text-gray-800 dark:text-gray-100">{rec.currency} {parseFloat(rec.subtotal + rec.tax - rec.discount).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${rec.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {rec.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-3">
                    <button onClick={() => toggleStatus(rec.id, rec.status)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      {rec.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => deleteRecurring(rec.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}