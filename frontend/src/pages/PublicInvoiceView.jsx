// frontend/src/pages/PublicInvoiceView.jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import CurrencyConverter from '../components/CurrencyConverter'

export default function PublicInvoiceView() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showWireDetails, setShowWireDetails] = useState(false)
  const [wireDetails, setWireDetails] = useState(null)
  const [showConverter, setShowConverter] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/public/invoices/${id}`)
      const data = await res.json()
      setInvoice(data.invoice)

      // Fetch international wire details if applicable
      if (data.invoice?.is_international || data.invoice?.currency !== 'INR') {
        fetchWireDetails()
      }
    } catch (error) {
      console.error("Error fetching invoice:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWireDetails = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/public/invoices/${id}/international-details`)
      if (res.ok) {
        const data = await res.json()
        setWireDetails(data.wire_details)
      }
    } catch (err) {
      console.error("Error fetching wire details:", err)
    }
  }

  const handlePayment = async () => {
    setProcessing(true)
    try {
      // 1. Create Order on Backend
      const orderRes = await fetch('http://127.0.0.1:8000/api/public/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: id })
      })
      const orderData = await orderRes.json()

      // 2. Open Razorpay Checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount_paise,
        currency: orderData.currency,
        name: invoice.profile?.organization_name || "Freelancer",
        description: `Payment for Invoice ${invoice.invoice_number}`,
        order_id: orderData.order_id,
        handler: async function (response) {
          // 3. Verify Payment on Backend
          const verifyRes = await fetch('http://127.0.0.1:8000/api/public/payments/verify', {
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
            alert('✅ Payment Successful! Invoice status updated to Paid.');
            fetchInvoice(); // Refresh
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

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500">Loading Invoice...</div>
  if (!invoice) return <div className="flex justify-center items-center h-screen bg-gray-50 text-red-600 font-semibold">Invoice not found.</div>

  const isCompleted = invoice.status === 'Completed'
  const isPaid = invoice.status === 'Paid' || isCompleted
  const currency = invoice.currency || 'USD'
  const subtotal = parseFloat(invoice.subtotal || 0)
  const tax = parseFloat(invoice.tax_amount || invoice.tax || 0)
  const discount = parseFloat(invoice.discount || 0)
  const total = parseFloat(invoice.total || 0)

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight">INVOICE</h1>
              {(invoice.is_international || currency !== 'INR') && (
                <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold backdrop-blur-sm">
                  🌐 International
                </span>
              )}
            </div>
            <p className="mt-1 text-blue-100 font-mono">#{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            {invoice.profile?.logo_url && <img src={invoice.profile.logo_url} alt="Logo" className="h-12 object-contain bg-white p-1 rounded mb-2 ml-auto shadow-sm" />}
            <p className="font-bold text-lg">{invoice.profile?.organization_name || "Freelancer"}</p>
            {invoice.profile?.gstin && <p className="text-sm text-blue-100">GSTIN: {invoice.profile.gstin}</p>}
          </div>
        </div>

        {/* Currency Converter Bar */}
        <div className="bg-blue-50 px-8 py-3 flex justify-between items-center border-b border-blue-100 text-sm">
          <span className="text-blue-900 font-medium">Need to convert this invoice to your local currency?</span>
          <button
            onClick={() => setShowConverter(!showConverter)}
            className="px-3 py-1 bg-white text-blue-700 font-semibold rounded-lg shadow-sm border border-blue-200 hover:bg-blue-100 transition text-xs"
          >
            💱 Convert Currency
          </button>
        </div>

        {showConverter && (
          <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-center">
            <CurrencyConverter 
              initialAmount={total} 
              initialFrom={currency} 
              initialTo={currency === 'INR' ? 'USD' : 'INR'} 
              onClose={() => setShowConverter(false)} 
            />
          </div>
        )}

        {/* Status & Bill To */}
        <div className="p-8 flex justify-between items-center border-b border-gray-200 flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Bill To</p>
            <p className="text-lg font-bold text-gray-800 mt-1">{invoice.clients?.name}</p>
            <p className="text-gray-600 text-sm">{invoice.clients?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Status</p>
            <div className="mt-1">
              {isCompleted ? (
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ Completed (Settled)
                </span>
              ) : isPaid ? (
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ● Payment Received (Paid)
                </span>
              ) : (
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                  Pending Payment
                </span>
              )}
            </div>
            {invoice.utr_number && (
              <p className="text-xs font-mono text-emerald-700 mt-1.5 font-bold">
                UTR: {invoice.utr_number}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">Date: {invoice.created_at?.split('T')[0]}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="p-8">
          <table className="w-full text-left">
            <thead className="border-b-2 border-gray-200 bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-gray-600 font-semibold text-sm">Description</th>
                <th className="py-3 px-4 text-gray-600 font-semibold text-center text-sm">Qty</th>
                <th className="py-3 px-4 text-gray-600 font-semibold text-right text-sm">Rate</th>
                <th className="py-3 px-4 text-gray-600 font-semibold text-right text-sm">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-4 px-4 text-gray-800">{item.description}</td>
                  <td className="py-4 px-4 text-gray-600 text-center">{item.quantity}</td>
                  <td className="py-4 px-4 text-gray-600 text-right">{currency} {parseFloat(item.rate).toFixed(2)}</td>
                  <td className="py-4 px-4 text-gray-800 font-medium text-right">{currency} {parseFloat(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-gray-600 text-sm"><span>Subtotal:</span><span>{currency} {subtotal.toFixed(2)}</span></div>
              {tax > 0 && <div className="flex justify-between text-gray-600 text-sm"><span>Tax:</span><span>{currency} {tax.toFixed(2)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-gray-600 text-sm"><span>Discount:</span><span>-{currency} {discount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-xl font-extrabold text-gray-900 border-t-2 border-gray-200 pt-3">
                <span>Total:</span><span>{currency} {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* International SWIFT Details Accordion / Display */}
        {(invoice.is_international || currency !== 'INR') && wireDetails && (
          <div className="mx-8 mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏦</span>
                <h4 className="font-bold text-purple-900">International Bank Wire (SWIFT / IBAN)</h4>
              </div>
              <button 
                onClick={() => setShowWireDetails(!showWireDetails)} 
                className="text-xs text-purple-700 font-bold underline"
              >
                {showWireDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            <p className="text-xs text-purple-700 mb-3">For international clients making cross-border wire transfers.</p>

            {showWireDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-4 rounded-lg border border-purple-100">
                <div><span className="text-gray-500">Account Holder:</span> <p className="font-bold text-gray-800">{wireDetails.account_holder_name}</p></div>
                <div><span className="text-gray-500">Bank Name:</span> <p className="font-bold text-gray-800">{wireDetails.bank_name}</p></div>
                <div><span className="text-gray-500">SWIFT / BIC Code:</span> <p className="font-mono font-bold text-indigo-700">{wireDetails.swift_code}</p></div>
                <div><span className="text-gray-500">IBAN / Account Number:</span> <p className="font-mono font-bold text-indigo-700">{wireDetails.iban_number || wireDetails.bank_account_number}</p></div>
                {wireDetails.routing_number && <div><span className="text-gray-500">Routing Number:</span> <p className="font-mono text-gray-800">{wireDetails.routing_number}</p></div>}
                <div><span className="text-gray-500">Payment Reference:</span> <p className="font-mono font-bold text-purple-800">{wireDetails.reference_code}</p></div>
              </div>
            )}
          </div>
        )}

        {/* Pay Button Section */}
        <div className="bg-gray-50 p-8 border-t border-gray-200 text-center space-y-4">
          {!isPaid ? (
            <div className="space-y-3">
              {invoice.payment_integration_enabled ? (
                <button 
                  onClick={handlePayment} 
                  disabled={processing}
                  className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-50"
                >
                  {processing ? 'Processing Payment...' : `💳 Pay ${currency} ${total.toFixed(2)} Online`}
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                  <p className="font-semibold">Online payment not enabled for this invoice.</p>
                  <p className="mt-1 text-amber-700">Please pay via bank transfer using details provided by the freelancer, then they will mark it as paid.</p>
                </div>
              )}
            </div>
          ) : isCompleted ? (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 font-bold text-base flex flex-col items-center gap-1">
              <span>✅ Payment Completed & Settled</span>
              {invoice.utr_number && <span className="font-mono text-xs font-normal text-emerald-700">Bank UTR: {invoice.utr_number}</span>}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-bold text-base flex flex-col items-center gap-1">
              <span>✅ Payment Received</span>
              <span className="font-normal text-xs text-amber-700">Thank you! Your payment has been captured and is being processed for settlement.</span>
            </div>
          )}
          
          <button 
            onClick={() => window.print()} 
            className="text-sm text-gray-500 hover:text-gray-800 underline flex items-center justify-center gap-1 mx-auto pt-2"
          >
            🖨️ Print or Save as PDF
          </button>
          <p className="text-xs text-gray-400">Secure multi-currency payment platform</p>
        </div>
      </div>
    </div>
  )
}