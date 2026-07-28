// frontend/src/pages/ViewInvoice.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function ViewInvoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInvoice = async () => {
      const res = await apiFetch(`/api/invoices/${id}`)
      if (res.ok) {
        const data = await res.json()
        setInvoice(data.invoice)
      }
      setLoading(false)
    }
    fetchInvoice()
  }, [id])

  // This function downloads the PDF securely using the user's JWT token
  const downloadPdf = async () => {
    const res = await apiFetch(`/api/invoices/${id}/pdf`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${invoice.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-8 text-center">Loading invoice...</div>
  if (!invoice) return <div className="p-8 text-center text-red-600">Invoice not found.</div>

  return (
    <div className="max-w-4xl mx-auto">
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/invoices')} className="text-blue-600 hover:underline">
          &larr; Back to Invoices
        </button>
        <button onClick={downloadPdf} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
          📄 Download PDF
        </button>
      </div>

      {/* Invoice Preview */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">INVOICE</h1>
            <p className="text-gray-600 mt-1">{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Issue Date</p>
            <p className="font-medium">{invoice.issue_date}</p>
            <p className="text-sm text-gray-500 mt-2">Due Date</p>
            <p className="font-medium">{invoice.due_date || 'N/A'}</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
          <p className="text-lg font-bold text-gray-800">{invoice.clients.name}</p>
          <p className="text-gray-600">{invoice.clients.email}</p>
        </div>

        <table className="w-full text-left mb-8">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="p-3 text-sm font-semibold text-gray-600">Description</th>
              <th className="p-3 text-sm font-semibold text-gray-600 text-center">Qty</th>
              <th className="p-3 text-sm font-semibold text-gray-600 text-right">Rate</th>
              <th className="p-3 text-sm font-semibold text-gray-600 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="p-3 text-gray-800">{item.description}</td>
                <td className="p-3 text-gray-600 text-center">{item.quantity}</td>
                <td className="p-3 text-gray-600 text-right">${parseFloat(item.rate).toFixed(2)}</td>
                <td className="p-3 text-gray-800 font-medium text-right">${parseFloat(item.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-1/2 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>${parseFloat(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax ({invoice.tax_rate}%):</span>
              <span>${parseFloat(invoice.tax_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount:</span>
              <span>-${parseFloat(invoice.discount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-200">
              <span>Total:</span>
              <span>${parseFloat(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}