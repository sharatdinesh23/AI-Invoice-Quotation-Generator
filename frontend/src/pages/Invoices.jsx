// frontend/src/pages/Invoices.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import CurrencyConverter from '../components/CurrencyConverter'

export default function Invoices() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [showConverter, setShowConverter] = useState(false)
  const [settlingId, setSettlingId] = useState(null)

  useEffect(() => { 
    fetchInvoices() 
  }, [])

  const fetchInvoices = async () => {
    const res = await apiFetch('/api/invoices')
    const data = await res.json()
    setInvoices(data.invoices || [])
  }

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to VOID this invoice? It will be marked as Void and removed from the active list, but kept for your records.')) {
      await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' })
      fetchInvoices()
    }
  }

  const handleSettlePayout = async (inv) => {
    const customUtr = window.prompt(
      `Settle payout for Invoice ${inv.invoice_number}.\nEnter UTR number (or leave blank to auto-generate):`,
      inv.utr_number || ''
    )
    if (customUtr === null) return; // User cancelled

    setSettlingId(inv.id)
    try {
      const res = await apiFetch(`/api/invoices/${inv.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ utr_number: customUtr.trim() || undefined })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`✅ Invoice ${inv.invoice_number} settled successfully!\nStatus: Completed\nUTR: ${data.utr_number}`)
        fetchInvoices()
      } else {
        const err = await res.json()
        alert(`Settlement failed: ${err.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error(error)
      alert('Error connecting to settlement server.')
    } finally {
      setSettlingId(null)
    }
  }

  const getStatusBadge = (inv) => {
    const status = inv.status
    const utr = inv.utr_number

    switch(status) {
      case 'Completed':
        return (
          <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-1 items-center flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 border border-green-300">
                Client: Paid
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Payout: Paid
              </span>
            </div>
            {utr && (
              <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200">
                UTR: {utr}
              </span>
            )}
          </div>
        )
      case 'Paid':
        return (
          <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-1 items-center flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 border border-green-300">
                Client: Paid
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Payout: To Be Paid
              </span>
            </div>
          </div>
        )
      case 'Sent':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Sent</span>
      case 'Overdue':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Overdue</span>
      case 'Void':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 line-through">Void</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>
    }
  }

  const handleSendInvoice = async (id, invoiceNumber, clientEmail) => {
    if (!window.confirm(`Send invoice ${invoiceNumber} to ${clientEmail} via your connected Gmail?`)) return;

    try {
      const res = await apiFetch(`/api/invoices/${id}/send`, {
        method: 'POST',
        body: JSON.stringify({
          subject: `Invoice ${invoiceNumber} from Your Business`,
          body: `Hello,\n\nPlease find attached invoice ${invoiceNumber} for your recent services.\n\nThank you for your business!`
        })
      });

      if (res.ok) {
        alert('✅ Invoice sent successfully via Gmail!');
        fetchInvoices();
      } else {
        const err = await res.json();
        alert(`Failed to send: ${err.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(error);
      alert('Network error while sending invoice. Please check your connection.');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowConverter(!showConverter)} 
            className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-medium text-sm flex items-center gap-1.5"
          >
            💱 Currency Converter
          </button>
          <button 
            onClick={() => navigate('/invoices/new')} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-sm"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {showConverter && (
        <div className="mb-6">
          <CurrencyConverter onClose={() => setShowConverter(false)} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Invoice #</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Client</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Total</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Status & Settlement</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500">No invoices yet.</td></tr>
            ) : (
              invoices.map(inv => (
                <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800">
                    {inv.invoice_number}
                    {inv.is_international && (
                      <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">INTL</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-600">{inv.clients?.name || 'Unknown'}</td>
                  <td className="p-4 font-semibold text-gray-800">{inv.currency || 'USD'} {parseFloat(inv.total).toFixed(2)}</td>
                  <td className="p-4">
                    {getStatusBadge(inv)}
                  </td>
                  <td className="p-4 text-right space-x-2.5">
                    {inv.status === 'Paid' && (
                      <button 
                        onClick={() => handleSettlePayout(inv)} 
                        disabled={settlingId === inv.id}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition"
                        title="Mark money settled to freelancer and generate UTR"
                      >
                        {settlingId === inv.id ? 'Settling...' : '🏦 Settle [UTR]'}
                      </button>
                    )}
                    <button onClick={() => navigate(`/invoices/${inv.id}/view`)} className="text-gray-600 hover:text-gray-800 text-sm font-medium">
                      View
                    </button>
                    <button onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    <button 
                      onClick={() => handleSendInvoice(inv.id, inv.invoice_number, inv.clients?.email)} 
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                      title="Send via Gmail"
                    >
                      ✉️ Send
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`http://localhost:5173/portal/${inv.id}`)
                        alert('Client portal link copied!')
                      }} 
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                      title="Copy Client Link"
                    >
                      🔗 Link
                    </button>
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