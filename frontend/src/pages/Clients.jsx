// frontend/src/pages/Clients.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientStats, setClientStats] = useState(null)
  const [showStatsModal, setShowStatsModal] = useState(false)

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    const res = await apiFetch('/api/clients')
    const data = await res.json()
    setClients(data.clients || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editingId) {
      // UPDATE existing client
      await apiFetch(`/api/clients/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, email })
      })
      setEditingId(null)
    } else {
      // CREATE new client
      await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name, email })
      })
    }
    
    setName('')
    setEmail('')
    fetchClients()
  }

  const handleEdit = (client) => {
    setEditingId(client.id)
    setName(client.name)
    setEmail(client.email)
  }

  const handleCancel = () => {
    setEditingId(null)
    setName('')
    setEmail('')
  }

  const deleteClient = async (id) => {
    if(window.confirm('Are you sure?')) {
      await apiFetch(`/api/clients/${id}`, { method: 'DELETE' })
      fetchClients()
    }
  }

  const viewClientStats = async (client) => {
    setSelectedClient(client)
    const res = await apiFetch(`/api/clients/${client.id}/stats`)
    const data = await res.json()
    setClientStats(data.stats)
    setShowStatsModal(true)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Client Management</h2>
      
      {/* Add/Edit Client Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            {editingId ? 'Update Client' : 'Add Client'}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Clients List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Email</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan="3" className="p-8 text-center text-gray-500">No clients yet. Add your first one above!</td></tr>
            ) : (
              clients.map(client => (
                <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800">{client.name}</td>
                  <td className="p-4 text-gray-600">{client.email}</td>
                  <td className="p-4 text-right space-x-3">
                    
                    <button onClick={() => viewClientStats(client)} className="text-purple-600 hover:text-purple-800 dark:hover:text-purple-400 text-sm font-medium">
                      📊 Stats
                    </button>
                    <button onClick={() => handleEdit(client)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    <button onClick={() => deleteClient(client.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showStatsModal && selectedClient && clientStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{selectedClient.name}</h3>
              <button onClick={() => setShowStatsModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl">&times;</button>
            </div>
            
            <div className="space-y-4">
              <StatRow label="Total Invoiced" value={`₹${clientStats.total_invoiced.toFixed(2)}`} color="text-gray-800 dark:text-gray-100" />
              <StatRow label="Total Paid" value={`₹${clientStats.total_paid.toFixed(2)}`} color="text-green-600" />
              <StatRow label="Outstanding Balance" value={`₹${clientStats.outstanding.toFixed(2)}`} color="text-red-600" />
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total Invoices:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{clientStats.invoice_count}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600 dark:text-gray-400">Paid Invoices:</span>
                  <span className="font-semibold text-green-600">{clientStats.paid_count}</span>
                </div>
              </div>
            </div>
            
            <button onClick={() => setShowStatsModal(false)} className="w-full mt-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
  
}
function StatRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  )
}