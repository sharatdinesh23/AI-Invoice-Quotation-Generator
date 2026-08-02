// frontend/src/pages/Transactions.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Transactions() {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({
    total_settled_amount: 0,
    total_to_be_paid_amount: 0,
    total_commission_amount: 0,
    count_total: 0,
    count_settled: 0,
    count_pending: 0
  })
  const [filter, setFilter] = useState('all') // 'all', 'to_be_paid', 'paid'
  const [loading, setLoading] = useState(true)
  const [settlingId, setSettlingId] = useState(null)

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const res = await apiFetch('/api/transactions')
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
        setSummary(data.summary || {})
      }
    } catch (err) {
      console.error('Error fetching transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSettle = async (tx) => {
    const customUtr = window.prompt(
      `Settle payout for Invoice ${tx.invoice_number}.\nEnter UTR number (or leave blank to auto-generate):`,
      tx.utr_number || ''
    )
    if (customUtr === null) return; // User cancelled

    setSettlingId(tx.id)
    try {
      const res = await apiFetch(`/api/invoices/${tx.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ utr_number: customUtr.trim() || undefined })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`✅ Payout Settled to Freelancer!\nStatus: Paid\nUTR: ${data.utr_number}`)
        fetchTransactions()
      } else {
        const err = await res.json()
        alert(`Settlement failed: ${err.detail || 'Unknown error'}`)
      }
    } catch (err) {
      console.error(err)
      alert('Error connecting to settlement server.')
    } finally {
      setSettlingId(null)
    }
  }

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'to_be_paid') return tx.freelancer_payout_status === 'To Be Paid'
    if (filter === 'paid') return tx.freelancer_payout_status === 'Paid'
    return true
  })

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading transactions ledger...</div>
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Client to Freelancer Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Track client payment receipts and freelancer settlement payouts with UTR verification.
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-semibold transition"
        >
          🔄 Refresh Ledger
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Settled (Freelancer Paid)</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{summary.total_settled_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{summary.count_settled} completed settlements</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Payout (To Be Paid)</p>
          <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            ₹{summary.total_to_be_paid_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{summary.count_pending} pending payouts</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform Commission Fee</p>
          <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            ₹{summary.total_commission_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-gray-400 mt-1">Platform fee (2%)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Transactions</p>
          <h3 className="text-2xl font-extrabold text-gray-800 dark:text-white mt-1">
            {summary.count_total}
          </h3>
          <p className="text-xs text-gray-400 mt-1">Client payment records</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-6">
        <button
          onClick={() => setFilter('all')}
          className={`pb-3 font-bold text-sm border-b-2 transition ${
            filter === 'all'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          All Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setFilter('to_be_paid')}
          className={`pb-3 font-bold text-sm border-b-2 transition ${
            filter === 'to_be_paid'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          ⏳ To Be Paid ({summary.count_pending})
        </button>
        <button
          onClick={() => setFilter('paid')}
          className={`pb-3 font-bold text-sm border-b-2 transition ${
            filter === 'paid'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          ✓ Paid to Freelancer ({summary.count_settled})
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Client</th>
                <th className="p-4 text-right">Client Paid</th>
                <th className="p-4 text-right">Fee (2%)</th>
                <th className="p-4 text-right">Freelancer Amount</th>
                <th className="p-4 text-center">Client Status</th>
                <th className="p-4 text-center">Freelancer Payout Status</th>
                <th className="p-4">UTR Reference</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-gray-500">
                    No transactions found in this category.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                      {tx.invoice_number}
                      {tx.is_international && (
                        <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">INTL</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{tx.client_name}</div>
                      <div className="text-xs text-gray-500">{tx.client_email}</div>
                    </td>
                    <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                      {tx.currency} {tx.total_amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-xs text-red-600 dark:text-red-400 font-semibold">
                      -{tx.currency} {tx.commission_amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      {tx.currency} {tx.freelancer_payout_amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/40 dark:text-green-300">
                        Paid (Client)
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {tx.freelancer_payout_status === 'Paid' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ✓ Paid (Freelancer)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300">
                          ⏳ To Be Paid
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {tx.utr_number ? (
                        <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                          {tx.utr_number}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Pending UTR</span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {tx.freelancer_payout_status === 'To Be Paid' && (
                        <button
                          onClick={() => handleSettle(tx)}
                          disabled={settlingId === tx.id}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition"
                        >
                          {settlingId === tx.id ? 'Settling...' : '🏦 Settle [UTR]'}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/invoices/${tx.id}/view`)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                      >
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
