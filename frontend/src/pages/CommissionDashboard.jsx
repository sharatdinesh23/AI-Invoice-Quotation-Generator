import React, { useState, useEffect } from 'react';
import * as api from '../api.js';

const CommissionDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const ctxRes = await api.getMeContext();
      const ctx = await ctxRes.json();
      if (!ctx.is_admin) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      fetchData();
    } catch (err) {
      setAccessDenied(true);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getPlatformTransactions();
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
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
      const res = await api.settleInvoicePayout(invoiceId, utr || undefined);
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

  const handleRetry = async (invoiceId) => {
    if (!window.confirm('Retry Razorpay Route payout for this invoice?')) return;
    try {
      setRetryingId(invoiceId);
      const res = await api.retryInvoicePayout(invoiceId);
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Retry initiated');
        fetchData();
      } else {
        alert(result.detail || 'Retry failed');
      }
    } catch (err) {
      alert('Payout retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Access Denied</h2>
        <p className="text-gray-500 mt-2">Platform Commission Dashboard is restricted to platform admins.</p>
        <p className="text-xs text-gray-400 mt-2">Set <code>is_admin=true</code> on your profile or add your email to <code>PLATFORM_ADMIN_EMAILS</code>.</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Owner Commission Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">All freelancers — volume, commission, settlements</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading Platform Commission Data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Platform Volume (Gross)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{((summary.total_settled_amount || 0) + (summary.total_to_be_paid_amount || 0) + (summary.total_commission_amount || 0)).toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-purple-600 uppercase">Platform Commission</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">₹{(summary.total_commission_amount || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-emerald-600 uppercase">Settled Payouts</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">₹{(summary.total_settled_amount || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-amber-600 uppercase">Pending / Failed</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">₹{(summary.total_to_be_paid_amount || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs overflow-hidden border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-3 text-xs uppercase">Invoice</th>
                  <th className="px-6 py-3 text-xs uppercase">Client</th>
                  <th className="px-6 py-3 text-xs uppercase">Gross</th>
                  <th className="px-6 py-3 text-xs uppercase">Fee</th>
                  <th className="px-6 py-3 text-xs uppercase">Net Payout</th>
                  <th className="px-6 py-3 text-xs uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map(t => (
                  <tr key={t.invoice_id}>
                    <td className="px-6 py-4">
                      <p className="font-bold">#{t.invoice_number}</p>
                      <p className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">{t.client_name}</td>
                    <td className="px-6 py-4 font-bold">{t.currency} {t.total_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-purple-600 font-bold">{t.currency} {t.commission_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">{t.currency} {t.freelancer_payout_amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {t.freelancer_payout_status === 'Paid' && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">✓ Paid{t.utr_number ? ` · ${t.utr_number}` : ''}</span>
                      )}
                      {t.freelancer_payout_status === 'Processing' && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">⚡ Processing</span>
                      )}
                      {t.freelancer_payout_status === 'Failed' && (
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">✗ Failed</span>
                      )}
                      {t.freelancer_payout_status === 'To Be Paid' && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">⏳ Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      {t.freelancer_payout_status === 'To Be Paid' && (
                        <button onClick={() => handleSettle(t.invoice_id)} disabled={settlingId === t.invoice_id}
                          className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold rounded">
                          {settlingId === t.invoice_id ? '...' : 'Settle'}
                        </button>
                      )}
                      {(t.freelancer_payout_status === 'Failed' || t.freelancer_payout_status === 'To Be Paid') && (
                        <button onClick={() => handleRetry(t.invoice_id)} disabled={retryingId === t.invoice_id}
                          className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                          {retryingId === t.invoice_id ? '...' : 'Retry'}
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
