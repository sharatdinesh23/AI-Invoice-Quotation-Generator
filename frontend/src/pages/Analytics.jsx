import React, { useState, useEffect } from 'react';
import * as api from '../api.js';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taxRegime, setTaxRegime] = useState('new'); // 'new' or 'old'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resAnal, resPL] = await Promise.all([
        api.getExpenseAnalytics({ months: 6 }),
        api.getProfitLoss()
      ]);
      const dataAnal = await resAnal.json();
      const dataPL = await resPL.json();
      setAnalytics(dataAnal);
      setProfitLoss(dataPL);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Tax Estimator Logic (Indian Tax System for Freelancers - Section 44ADA / Standard Slabs)
  const calculateEstimatedTax = () => {
    if (!profitLoss) return { grossRevenue: 0, taxableIncome: 0, estimatedTax: 0, gstEstimated: 0 };

    const grossRevenue = profitLoss.revenue?.total || 0;
    const totalExpenses = profitLoss.expenses?.total || 0;
    const netProfit = profitLoss.profit?.gross_profit || 0;

    // Presumptive Tax under 44ADA (50% of gross revenue if under 75 Lakhs)
    const presumptiveTaxableIncome = grossRevenue * 0.5;
    const taxableIncome = Math.min(netProfit, presumptiveTaxableIncome);

    let estimatedTax = 0;
    if (taxableIncome > 700000) {
      // Basic Slab Calculation
      estimatedTax = (taxableIncome - 700000) * 0.10 + 20000;
    } else if (taxableIncome > 300000) {
      estimatedTax = (taxableIncome - 300000) * 0.05;
    }

    // GST Estimated (18% if applicable)
    const gstEstimated = grossRevenue > 2000000 ? grossRevenue * 0.18 : 0;

    return {
      grossRevenue,
      netProfit,
      presumptiveTaxableIncome,
      taxableIncome,
      estimatedTax: Math.max(0, estimatedTax),
      gstEstimated
    };
  };

  const taxInfo = calculateEstimatedTax();

  const handleExportCSV = () => {
    if (!profitLoss) return;
    const rows = [
      ['Category', 'Amount (INR)'],
      ['Total Revenue', profitLoss.revenue?.total || 0],
      ['Total Expenses', profitLoss.expenses?.total || 0],
      ['Gross Profit', profitLoss.profit?.gross_profit || 0],
      ['Estimated Income Tax (44ADA)', taxInfo.estimatedTax],
      ['Estimated GST (18%)', taxInfo.gstEstimated]
    ];
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `P_and_L_Statement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics & Profit/Loss</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Financial insights, category breakdowns, and tax liability calculator</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg shadow-xs flex items-center gap-2"
        >
          📥 Export Financial Statement (CSV)
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading Analytics & P&L Statement...</div>
      ) : (
        <>
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Gross Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">₹{taxInfo.grossRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₹{(profitLoss?.expenses?.total || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Net Profit</p>
              <p className={`text-2xl font-bold mt-1 ${taxInfo.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ₹{taxInfo.netProfit.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Profit Margin</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{profitLoss?.profit?.profit_margin_percent || 0}%</p>
            </div>
          </div>

          {/* Profit & Loss Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Expense Breakdown by Category</h3>
              {analytics?.category_breakdown && Object.keys(analytics.category_breakdown).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(analytics.category_breakdown).map(([cat, info]) => {
                    const pct = taxInfo.grossRevenue > 0 ? ((info.total / (profitLoss?.expenses?.total || 1)) * 100).toFixed(1) : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <span>{cat}</span>
                          <span>₹{info.total.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">No expense category data recorded yet.</p>
              )}
            </div>

            {/* Monthly Trend */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Monthly Expense Trend</h3>
              {analytics?.monthly_trend && analytics.monthly_trend.length > 0 ? (
                <div className="space-y-4">
                  {analytics.monthly_trend.map((m) => (
                    <div key={m.month} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">{m.month}</span>
                      <span className="font-bold text-sm text-gray-900 dark:text-white">₹{m.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">No monthly trend data available.</p>
              )}
            </div>
          </div>

          {/* Tax Estimator Calculator */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">🧮 Freelancer Tax Estimator (Sec 44ADA)</h3>
                <p className="text-xs text-gray-500">Estimates Indian Income Tax under presumptive taxation & 18% GST eligibility</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-semibold">Regime:</span>
                <button
                  onClick={() => setTaxRegime('new')}
                  className={`px-3 py-1 rounded font-bold ${taxRegime === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  New Regime
                </button>
                <button
                  onClick={() => setTaxRegime('old')}
                  className={`px-3 py-1 rounded font-bold ${taxRegime === 'old' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Old Regime
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold block">Presumptive Income (50% of Revenue)</span>
                <span className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-1 block">₹{taxInfo.presumptiveTaxableIncome.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold block">Estimated Income Tax Liability</span>
                <span className="text-xl font-bold text-purple-900 dark:text-purple-200 mt-1 block">₹{taxInfo.estimatedTax.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold block">GST Liability (If &gt; 20 Lakhs)</span>
                <span className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-1 block">
                  {taxInfo.gstEstimated > 0 ? `₹${taxInfo.gstEstimated.toLocaleString()}` : 'Exempt (< 20 Lakhs)'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
