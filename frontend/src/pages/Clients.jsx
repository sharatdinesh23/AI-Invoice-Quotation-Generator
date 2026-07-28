// frontend/src/pages/Clients.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    const res = await apiFetch('/api/clients')
    const data = await res.json()
    setClients(data.clients || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { name, email }
    
    if (editingId) {
      // UPDATE existing client
      await apiFetch(`/api/clients/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
    } else {
      // CREATE new client
      await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
    
    // Reset form and refresh list
    setEditingId(null)
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
    if(window.confirm('Are you sure you want to delete this client?')) {
      await apiFetch(`/api/clients/${id}`, { method: 'DELETE' })
      fetchClients()
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Client Management</h2>
      
      {/* Add / Edit Client Form */}
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
          <button type="submit" className={`px-6 py-2 text-white rounded-lg font-medium transition ${editingId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {editingId ? 'Update Client' : 'Add Client'}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
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
                  <td className="p-4 text-right space-x-2">
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
    </div>
  )
}