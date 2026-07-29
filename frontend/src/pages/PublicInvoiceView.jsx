// frontend/src/pages/PublicInvoiceView.jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

export default function PublicInvoiceView() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/public/invoices/${id}`)
      const data = await res.json()
      setInvoice(data.invoice)
    } catch (error) {
      console.error("Error fetching invoice:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    setProcessing(true)
    try {
      // 1. Create Order on Backend
      const orderRes = await fetch('http://localhost:8000/api/public/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: id })
      })
      const orderData = await orderRes.json()

      // 2. Open Razorpay Checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: invoice.profile?.organization_name || "Freelancer",
        description: `Payment for Invoice ${invoice.invoice_number}`,
        order_id: orderData.order_id,
        handler: async function (response) {
          // 3. Verify Payment on Backend
          const verifyRes = await fetch('http://localhost:8000/api/public/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              invoice_id: id
            })
          })
          
          if (verifyRes.ok) {
            alert('✅ Payment Successful! Thank you.');
            fetchInvoice(); // Refresh to show "Paid" status
          } else {
            alert('Payment verification failed.');
          }
        },
        prefill: {
          name: invoice.clients?.name,
          email: invoice.clients?.email
        },
        theme: { color: "#2563eb" }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Payment error:", error);
      alert("Failed to initiate payment.");
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50">Loading Invoice...</div>
  if (!invoice) return <div className="flex justify-center items-center h-screen bg-gray-50 text-red-600">Invoice not found.</div>

  const isPaid = invoice.status === 'Paid'
  const currency = invoice.currency || 'USD'
  const subtotal = parseFloat(invoice.subtotal || 0)
  const tax = parseFloat(invoice.tax_amount || invoice.tax || 0)
  const discount = parseFloat(invoice.discount || 0)
  const total = parseFloat(invoice.total || 0)

  const handleDownloadPDF = async () => {
  try {
    const res = await fetch(`http://localhost:8000/api/invoices/${id}/pdf`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem('sb-...-auth-token')}` } // Note: Public PDF endpoint might need a tweak, let's use the public one
    })
    // Actually, let's create a quick public PDF endpoint or just use the existing one with a public flag. 
    // For now, let's add a simple "Print" button which browsers can "Save as PDF"
    window.print()
  } catch (error) {
    console.error("Error:", error)
  }
}

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 p-8 text-white flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">INVOICE</h1>
            <p className="mt-2 text-blue-100">#{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            {invoice.profile?.logo_url && <img src={invoice.profile.logo_url} alt="Logo" className="h-12 object-contain bg-white p-1 rounded mb-2 ml-auto" />}
            <p className="font-semibold">{invoice.profile?.organization_name || "Freelancer"}</p>
            {invoice.profile?.gstin && <p className="text-sm text-blue-100">GSTIN: {invoice.profile.gstin}</p>}
          </div>
        </div>

        {/* Status & Bill To */}
        <div className="p-8 flex justify-between items-center border-b border-gray-200">
          <div>
            <p className="text-sm text-gray-500 uppercase font-semibold">Bill To</p>
            <p className="text-lg font-bold text-gray-800 mt-1">{invoice.clients?.name}</p>
            <p className="text-gray-600">{invoice.clients?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 uppercase font-semibold">Status</p>
            <span className={`inline-block mt-1 px-4 py-1 rounded-full text-sm font-bold ${
              isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {invoice.status}
            </span>
            <p className="text-sm text-gray-500 mt-2">Date: {invoice.created_at?.split('T')[0]}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="p-8">
          <table className="w-full text-left">
            <thead className="border-b-2 border-gray-200">
              <tr>
                <th className="py-3 text-gray-600 font-semibold">Description</th>
                <th className="py-3 text-gray-600 font-semibold text-center">Qty</th>
                <th className="py-3 text-gray-600 font-semibold text-right">Rate</th>
                <th className="py-3 text-gray-600 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-4 text-gray-800">{item.description}</td>
                  <td className="py-4 text-gray-600 text-center">{item.quantity}</td>
                  <td className="py-4 text-gray-600 text-right">{currency} {parseFloat(item.rate).toFixed(2)}</td>
                  <td className="py-4 text-gray-800 font-medium text-right">{currency} {parseFloat(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{currency} {subtotal.toFixed(2)}</span></div>
              {tax > 0 && <div className="flex justify-between text-gray-600"><span>Tax:</span><span>{currency} {tax.toFixed(2)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-gray-600"><span>Discount:</span><span>-{currency} {discount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-xl font-bold text-gray-900 border-t-2 border-gray-200 pt-3">
                <span>Total:</span><span>{currency} {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pay Button */}
        <div className="bg-gray-50 p-8 border-t border-gray-200 text-center space-y-4">
  {!isPaid ? (
    <button 
      onClick={handlePayment} 
      disabled={processing}
      className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-50"
    >
      {processing ? 'Processing...' : `Pay ${currency} ${total.toFixed(2)} Now`}
    </button>
  ) : (
    <div className="text-green-600 font-bold text-lg flex items-center justify-center gap-2">
      ✅ Paid in Full
    </div>
  )}
  
  <button 
    onClick={() => window.print()} 
    className="text-sm text-gray-500 hover:text-gray-800 underline flex items-center justify-center gap-1 mx-auto"
  >
    🖨️ Print or Save as PDF
  </button>
  <p className="text-xs text-gray-400">Secure payment powered by Razorpay</p>
</div>
      </div>
    </div>
  )
}