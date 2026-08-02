// frontend/src/pages/ViewInvoice.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import CurrencyConverter from '../components/CurrencyConverter'

export default function ViewInvoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showConverter, setShowConverter] = useState(false)
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      const res = await apiFetch(`/api/invoices/${id}`)
      const data = await res.json()
      setInvoice(data.invoice)
    } catch (error) {
      console.error("Error fetching invoice:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const res = await apiFetch(`/api/invoices/${id}/pdf`)
      const blob = await res.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Invoice-${invoice.invoice_number}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading PDF:", error)
      alert("Failed to download PDF. Please try again.")
    }
  }

  const handleSettle = async () => {
    const customUtr = window.prompt(
      `Settle payout for Invoice ${invoice.invoice_number}.\nEnter UTR number (or leave blank to auto-generate):`,
      invoice.utr_number || ''
    )
    if (customUtr === null) return

    setSettling(true)
    try {
      const res = await apiFetch(`/api/invoices/${id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ utr_number: customUtr.trim() || undefined })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`✅ Payout Settled!\nStatus: Completed\nUTR: ${data.utr_number}`)
        fetchInvoice()
      } else {
        const err = await res.json()
        alert(`Settlement failed: ${err.detail || 'Unknown error'}`)
      }
    } catch (err) {
      console.error(err)
      alert('Error initiating settlement.')
    } finally {
      setSettling(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading invoice...</div>
  if (!invoice) return <div className="p-8 text-center text-red-600 font-semibold">Invoice not found.</div>

  const currency = invoice.currency || 'USD'
  const subtotal = parseFloat(invoice.subtotal || 0)
  const tax = parseFloat(invoice.tax_amount || invoice.tax || 0)
  const discount = parseFloat(invoice.discount || 0)
  const total = parseFloat(invoice.total || 0)
  const taxRate = subtotal > 0 ? ((tax / subtotal) * 100).toFixed(1) : 0

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Invoice Details</h2>
        <div className="flex gap-3 flex-wrap">
          <button 
            onClick={() => setShowConverter(!showConverter)} 
            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm border border-indigo-200"
          >
            💱 Convert Currency
          </button>
          {invoice.status === 'Paid' && (
            <button 
              onClick={handleSettle} 
              disabled={settling}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm shadow-sm"
            >
              {settling ? 'Settling...' : '🏦 Settle [UTR]'}
            </button>
          )}
          <button onClick={() => navigate(`/invoices/${id}/edit`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            Edit Invoice
          </button>
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2">
            📄 Download PDF
          </button>
        </div>
      </div>

      {showConverter && (
        <div className="mb-6">
          <CurrencyConverter initialAmount={total} initialFrom={currency} initialTo={currency === 'INR' ? 'USD' : 'INR'} onClose={() => setShowConverter(false)} />
        </div>
      )}

      {/* Settlement & Status Banner */}
      {invoice.status === 'Completed' ? (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h4 className="font-bold text-emerald-900">Payout Completed & Settled to Freelancer</h4>
              <p className="text-xs text-emerald-700">Client payment received and funds transferred to your bank account.</p>
            </div>
          </div>
          {invoice.utr_number && (
            <div className="text-right">
              <span className="text-xs text-emerald-600 font-medium block">Bank UTR Reference</span>
              <span className="font-mono text-sm font-bold text-emerald-900 bg-white px-2.5 py-1 rounded border border-emerald-300">
                {invoice.utr_number}
              </span>
            </div>
          )}
        </div>
      ) : invoice.status === 'Paid' ? (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <h4 className="font-bold text-amber-900">Client Status: Paid | Freelancer Payout: To Be Paid</h4>
              <p className="text-xs text-amber-700">Client payment is confirmed successful. Payout to freelancer is pending settlement.</p>
            </div>
          </div>
          <button 
            onClick={handleSettle} 
            disabled={settling}
            className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow"
          >
            Mark Freelancer Paid & Generate UTR
          </button>
        </div>
      ) : null}

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">INVOICE</h1>
            <p className="text-gray-600 mt-1">#{invoice.invoice_number}</p>
            <p className="text-gray-600">Date: {invoice.issue_date || invoice.created_at?.split('T')[0]}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-gray-600 text-sm">Client Status:</span>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                invoice.status === 'Paid' || invoice.status === 'Completed' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-blue-100 text-blue-800'
              }`}>
                {invoice.status === 'Paid' || invoice.status === 'Completed' ? 'Paid' : invoice.status}
              </span>
              <span className="text-gray-600 text-sm ml-2">Freelancer Payout:</span>
              <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold ${
                invoice.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                invoice.status === 'Paid' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                'bg-gray-100 text-gray-700'
              }`}>
                {invoice.status === 'Completed' ? 'Paid' : invoice.status === 'Paid' ? 'To Be Paid' : 'Pending'}
              </span>
              {invoice.is_international && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-bold">
                  International Client
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-800">{invoice.clients?.name}</h3>
            <p className="text-gray-600">{invoice.clients?.email}</p>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-8">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Description</th>
              <th className="p-3 text-center text-sm font-semibold text-gray-600">Qty</th>
              <th className="p-3 text-right text-sm font-semibold text-gray-600">Rate</th>
              <th className="p-3 text-right text-sm font-semibold text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="p-3 text-gray-800">{item.description}</td>
                <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                <td className="p-3 text-right text-gray-600">{currency} {parseFloat(item.rate).toFixed(2)}</td>
                <td className="p-3 text-right font-medium text-gray-800">{currency} {parseFloat(item.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax ({taxRate}%):</span>
              <span>{currency} {tax.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount:</span>
                <span>-{currency} {discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-800 border-t border-gray-200 pt-2">
              <span>Total:</span>
              <span>{currency} {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* UTR Section if present */}
        {invoice.utr_number && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Settlement Details</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Unique Transaction Reference (UTR):</span>
              <span className="font-mono font-bold text-gray-800">{invoice.utr_number}</span>
            </div>
            {invoice.settled_at && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Settled On:</span>
                <span className="text-gray-800">{new Date(invoice.settled_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-2">Notes:</h4>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}