// frontend/src/pages/Quotations.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Quotations() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState([])

  useEffect(() => { fetchQuotations() }, [])

  const fetchQuotations = async () => {
    const res = await apiFetch('/api/quotations')
    const data = await res.json()
    setQuotations(data.quotations || [])
  }

  const handleDelete = async (id) => {
    if(window.confirm('Delete this quotation?')) {
      await apiFetch(`/api/quotations/${id}`, { method: 'DELETE' })
      fetchQuotations()
    }
  }

  const handleConvert = async (id) => {
    if(!window.confirm('Convert this quotation into an invoice?')) return
    const res = await apiFetch(`/api/quotations/${id}/convert`, { method: 'POST' })
    if (res.ok) {
      alert('Successfully converted to Invoice!')
      fetchQuotations()
    } else {
      alert('Failed to convert.')
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Accepted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'Converted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'Sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Quotations</h2>
        <button onClick={() => navigate('/quotations/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + New Quotation
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Quote #</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Client</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Total</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Status</th>
              <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">No quotations yet.</td></tr>
            ) : (
              quotations.map(q => (
                <tr key={q.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="p-4 font-medium text-gray-800 dark:text-gray-100">{q.quote_number}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">{q.clients?.name || 'Unknown'}</td>
                  <td className="p-4 font-semibold text-gray-800 dark:text-gray-100">{q.currency} {parseFloat(q.total).toFixed(2)}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(q.status)}`}>{q.status}</span></td>
                  <td className="p-4 text-right space-x-3">
                    <button onClick={() => navigate(`/quotations/${q.id}/edit`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                    {q.status !== 'Converted' && q.status !== 'Rejected' && (
                      <button onClick={() => handleConvert(q.id)} className="text-purple-600 hover:text-purple-800 text-sm font-medium">Convert</button>
                    )}
                    <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
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