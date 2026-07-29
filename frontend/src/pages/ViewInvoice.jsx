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
    fetchInvoice()
  }, [id])

  const handleDownloadPDF = async () => {
    try {
      // Fetch the PDF with the auth token included
      const res = await apiFetch(`/api/invoices/${id}/pdf`)
      const blob = await res.blob()
      
      // Create a temporary link to download the blob
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

  if (loading) return <div className="p-8 text-center">Loading invoice...</div>
  if (!invoice) return <div className="p-8 text-center text-red-600">Invoice not found.</div>

  const currency = invoice.currency || 'USD'
  const subtotal = parseFloat(invoice.subtotal || 0)
  const tax = parseFloat(invoice.tax_amount || invoice.tax || 0)
  const discount = parseFloat(invoice.discount || 0)
  const total = parseFloat(invoice.total || 0)
  const taxRate = subtotal > 0 ? ((tax / subtotal) * 100).toFixed(1) : 0

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Invoice Details</h2>
        <div className="flex gap-3">
          <button onClick={() => navigate(`/invoices/${id}/edit`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            Edit Invoice
          </button>
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2">
            📄 Download PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">INVOICE</h1>
            <p className="text-gray-600 mt-1">#{invoice.invoice_number}</p>
            <p className="text-gray-600">Date: {invoice.issue_date || invoice.created_at?.split('T')[0]}</p>
            <p className="text-gray-600">Status: <span className="font-semibold text-blue-600">{invoice.status}</span></p>
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