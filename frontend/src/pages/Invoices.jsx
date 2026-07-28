// // frontend/src/pages/Invoices.jsx
// import { useState, useEffect } from 'react'
// import { Link } from 'react-router-dom'
// import { apiFetch } from '../api'

// export default function Invoices() {
//   const [invoices, setInvoices] = useState([])

//   useEffect(() => {
//     const fetchInvoices = async () => {
//       const res = await apiFetch('/api/invoices')
//       const data = await res.json()
//       setInvoices(data.invoices || [])
//     }
//     fetchInvoices()
//   }, [])

//   return (
//     <div>
//       <div className="flex justify-between items-center mb-6">
//         <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
//         <Link to="/invoices/create" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
//           + New Invoice
//         </Link>
//       </div>

//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//         <table className="w-full text-left">
//           <thead className="bg-gray-50 border-b border-gray-200">
//             <tr>
//               <th className="p-4 text-sm font-semibold text-gray-600">Invoice #</th>
//               <th className="p-4 text-sm font-semibold text-gray-600">Client</th>
//               <th className="p-4 text-sm font-semibold text-gray-600">Date</th>
//               <th className="p-4 text-sm font-semibold text-gray-600">Total</th>
//               <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
//               <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {invoices.length === 0 ? (
//               <tr><td colSpan="6" className="p-8 text-center text-gray-500">No invoices yet. Create your first one!</td></tr>
//             ) : (
//               invoices.map(inv => (
//                 <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
//                   <td className="p-4 font-medium text-gray-800">{inv.invoice_number}</td>
//                   <td className="p-4 text-gray-600">{inv.clients?.name || 'Unknown'}</td>
//                   <td className="p-4 text-gray-600">{inv.issue_date}</td>
//                   <td className="p-4 text-gray-800 font-medium">${parseFloat(inv.total).toFixed(2)}</td>
//                   <td className="p-4">
//                     <span className={`px-2 py-1 rounded-full text-xs font-medium ${
//                       inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 
//                       inv.status === 'Sent' ? 'bg-blue-100 text-blue-800' : 
//                       'bg-gray-100 text-gray-800'
//                     }`}>
//                       {inv.status}
//                     </span>
//                   </td>
//                   <td className="p-4 text-right">
//                     <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
//                       View
//                     </Link>
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   )
// }

// frontend/src/pages/Invoices.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Invoices() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])

  useEffect(() => { fetchInvoices() }, [])

  const fetchInvoices = async () => {
    const res = await apiFetch('/api/invoices')
    const data = await res.json()
    setInvoices(data.invoices || [])
  }

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this invoice?')) {
      await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' })
      fetchInvoices()
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Paid': return 'bg-green-100 text-green-800'
      case 'Sent': return 'bg-blue-100 text-blue-800'
      case 'Overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
        <button onClick={() => navigate('/invoices/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Invoice #</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Client</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Total</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500">No invoices yet.</td></tr>
            ) : (
              invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800">{inv.invoice_number}</td>
                  <td className="p-4 text-gray-600">{inv.clients?.name || 'Unknown'}</td>
                  <td className="p-4 font-semibold text-gray-800">{inv.currency || 'USD'} {parseFloat(inv.total).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-3">
                    {/* VIEW BUTTON */}
                    <button onClick={() => navigate(`/invoices/${inv.id}/view`)} className="text-gray-600 hover:text-gray-800 text-sm font-medium">
                      View
                    </button>
                    {/* EDIT BUTTON */}
                    <button onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    {/* DELETE BUTTON */}
                    <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
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

