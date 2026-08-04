import React, { useState, useEffect } from 'react';
import * as api from '../api.js';

const CommissionDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.apiFetch('/api/transactions');
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (invoiceId) => {
    const utr = prompt('Enter Bank UTR Reference Number (or click OK to auto-generate):');
    if (utr === null) return;

    try {
      setSettlingId(invoiceId);
      const res = await api.apiFetch(`/api/invoices/${invoiceId}/settle`, {
        method: 'POST',
        body: JSON.stringify({ utr_number: utr || undefined })
      });
      if (res.ok) {
        alert('Payout marked as Settled & Completed!');
        fetchData();
      } else {
        const err = await res.json();
        alert(`Settlement error: ${err.detail || 'Failed'}`);
      }
    } catch (err) {
      alert('Error performing settlement.');
    } finally {
      setSettlingId(null);
    }
  };

  const summary = data?.summary || {};
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Owner Commission Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track gross client volume, 2% platform commission revenues, and payout settlements</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading Platform Commission Data...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Platform Volume (Gross)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{((summary.total_settled_amount || 0) + (summary.total_to_be_paid_amount || 0) + (summary.total_commission_amount || 0)).toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">2% Platform Commission Revenue</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                ₹{(summary.total_commission_amount || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Total Settled Freelancer Payouts</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{(summary.total_settled_amount || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Pending Freelancer Payouts</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                ₹{(summary.total_to_be_paid_amount || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
              Platform Transactions & Commission Ledger
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-3 text-xs uppercase">Invoice / Date</th>
                  <th className="px-6 py-3 text-xs uppercase">Client</th>
                  <th className="px-6 py-3 text-xs uppercase">Gross Amount</th>
                  <th className="px-6 py-3 text-xs uppercase">2% Platform Fee</th>
                  <th className="px-6 py-3 text-xs uppercase">Net Freelancer Payout</th>
                  <th className="px-6 py-3 text-xs uppercase">Payout Status</th>
                  <th className="px-6 py-3 text-right text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map(t => (
                  <tr key={t.invoice_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 dark:text-white">#{t.invoice_number}</p>
                      <p className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-800 dark:text-gray-200 font-medium">
                      {t.client_name}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                      {t.currency} {t.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-purple-600 dark:text-purple-400">
                      {t.currency} {t.commission_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      {t.currency} {t.freelancer_payout_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {t.freelancer_payout_status === 'Paid' ? (
                        <div className="flex flex-col">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
                            ✓ Paid to Freelancer
                          </span>
                          {t.utr_number && <span className="text-[10px] text-gray-500 font-mono mt-0.5">UTR: {t.utr_number}</span>}
                        </div>
                      ) : t.freelancer_payout_status === 'Processing' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 w-fit">
                          ⚡ Route Transfer Processing
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 w-fit">
                          ⏳ To Be Paid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {t.freelancer_payout_status === 'To Be Paid' && (
                        <button
                          onClick={() => handleSettle(t.invoice_id)}
                          disabled={settlingId === t.invoice_id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                        >
                          {settlingId === t.invoice_id ? 'Settling...' : '🏦 Settle [UTR]'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CommissionDashboard;
