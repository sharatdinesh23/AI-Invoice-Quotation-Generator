import React, { useState, useEffect } from 'react';
import * as api from '../api.js';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [clientRevenue, setClientRevenue] = useState([]);
  const [platformEarnings, setPlatformEarnings] = useState([]);
  const [agingReport, setAgingReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taxRegime, setTaxRegime] = useState('new'); // 'new' or 'old'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resAnal, resPL, resTrends, resClient, resPlatform, resAging] = await Promise.all([
        api.getExpenseAnalytics({ months: 6 }),
        api.getProfitLoss(),
        api.getRevenueTrends(6),
        api.getClientRevenue(),
        api.getPlatformEarnings(),
        api.getAgingReport()
      ]);

      const dataAnal = await resAnal.json();
      const dataPL = await resPL.json();
      const dataTrends = await resTrends.json();
      const dataClient = await resClient.json();
      const dataPlatform = await resPlatform.json();
      const dataAging = await resAging.json();

      setAnalytics(dataAnal);
      setProfitLoss(dataPL);
      setRevenueTrends(dataTrends.revenue_trends || []);
      setClientRevenue(dataClient.client_revenue || []);
      setPlatformEarnings(dataPlatform.platform_earnings || []);
      setAgingReport(dataAging);
    } catch (err) {
      console.error("Error fetching analytics data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Tax Estimator Logic (Indian Tax System for Freelancers - Section 44ADA / New vs Old Regime)
  const calculateEstimatedTax = () => {
    if (!profitLoss) return { grossRevenue: 0, taxableIncome: 0, estimatedTax: 0, gstEstimated: 0, presumptiveTaxableIncome: 0, netProfit: 0 };

    const grossRevenue = profitLoss.revenue?.total || 0;
    const netProfit = profitLoss.profit?.gross_profit || 0;

    // Presumptive Tax under 44ADA (50% of gross revenue if under 75 Lakhs)
    const presumptiveTaxableIncome = grossRevenue * 0.5;
    const taxableIncome = Math.min(netProfit, presumptiveTaxableIncome);

    let estimatedTax = 0;

    if (taxRegime === 'new') {
      // New Regime Slabs under 44ADA (Rebate up to 7 Lakhs)
      if (taxableIncome > 1500000) {
        estimatedTax = 150000 + (taxableIncome - 1500000) * 0.30;
      } else if (taxableIncome > 1200000) {
        estimatedTax = 90000 + (taxableIncome - 1200000) * 0.20;
      } else if (taxableIncome > 900000) {
        estimatedTax = 45000 + (taxableIncome - 900000) * 0.15;
      } else if (taxableIncome > 600000) {
        estimatedTax = 15000 + (taxableIncome - 600000) * 0.10;
      } else if (taxableIncome > 300000) {
        estimatedTax = (taxableIncome - 300000) * 0.05;
      }
      if (taxableIncome <= 700000) {
        estimatedTax = 0; // Tax rebate under 87A for New Regime
      }
    } else {
      // Old Regime Slabs (Basic 2.5L exemption + standard deduction)
      const effectiveIncome = Math.max(0, taxableIncome - 50000); // Standard deduction
      if (effectiveIncome > 1000000) {
        estimatedTax = 112500 + (effectiveIncome - 1000000) * 0.30;
      } else if (effectiveIncome > 500000) {
        estimatedTax = 12500 + (effectiveIncome - 500000) * 0.20;
      } else if (effectiveIncome > 250000) {
        estimatedTax = (effectiveIncome - 250000) * 0.05;
      }
      if (effectiveIncome <= 500000) {
        estimatedTax = 0; // Rebate under Old Regime
      }
    }

    // Cess 4%
    if (estimatedTax > 0) {
      estimatedTax += estimatedTax * 0.04;
    }

    // GST Estimated (18% if revenue > 20 Lakhs)
    const gstEstimated = grossRevenue > 2000000 ? grossRevenue * 0.18 : 0;

    return {
      grossRevenue,
      netProfit,
      presumptiveTaxableIncome,
      taxableIncome,
      estimatedTax: Math.max(0, Math.round(estimatedTax)),
      gstEstimated: Math.round(gstEstimated)
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
      [`Estimated Income Tax (Sec 44ADA - ${taxRegime.toUpperCase()} Regime)`, taxInfo.estimatedTax],
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

  const handleExportPDF = async () => {
    try {
      const res = await api.exportAnalyticsPdf();
      const htmlText = await res.text();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(htmlText);
        win.document.close();
        win.print();
      }
    } catch (err) {
      alert("Failed to export PDF statement");
    }
  };

  const maxTrendVal = Math.max(
    ...revenueTrends.map(t => Math.max(t.revenue, t.expenses)),
    1000
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Advanced Analytics & Profit/Loss</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Financial insights, platform breakdowns, aging reports & tax liability estimator</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
          >
            📥 Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
          >
            🖨️ Print / PDF Statement
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading Analytics, P&L Statement & Trends...</div>
      ) : (
        <>
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Gross Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">₹{taxInfo.grossRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₹{(profitLoss?.expenses?.total || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Net Operating Profit</p>
              <p className={`text-2xl font-bold mt-1 ${taxInfo.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ₹{taxInfo.netProfit.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Profit Margin</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{profitLoss?.profit?.profit_margin_percent || 0}%</p>
            </div>
          </div>

          {/* Revenue vs Expenses Monthly Trend Visualizer (Bar Chart) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">📊 Monthly Revenue vs. Expense Trend</h3>
                <p className="text-xs text-gray-500">6-month comparison of total income earned vs expenses incurred</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded-xs inline-block"></span> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-500 rounded-xs inline-block"></span> Expenses</span>
              </div>
            </div>

            {revenueTrends.length > 0 ? (
              <div className="pt-6">
                <div className="flex items-end justify-between gap-2 h-48 border-b border-gray-200 dark:border-gray-700 pb-2">
                  {revenueTrends.map((t, idx) => {
                    const revPct = maxTrendVal > 0 ? (t.revenue / maxTrendVal) * 100 : 0;
                    const expPct = maxTrendVal > 0 ? (t.expenses / maxTrendVal) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-12 bg-gray-900 text-white text-[10px] p-2 rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 whitespace-nowrap">
                          <div><strong>{t.month}</strong></div>
                          <div className="text-emerald-400">Rev: ₹{t.revenue.toLocaleString()}</div>
                          <div className="text-rose-400">Exp: ₹{t.expenses.toLocaleString()}</div>
                          <div className="text-blue-300">Profit: ₹{t.profit.toLocaleString()}</div>
                        </div>

                        <div className="flex gap-1.5 items-end w-full max-w-[60px] justify-center h-full">
                          <div
                            className="w-1/2 bg-emerald-500 hover:bg-emerald-600 rounded-t transition-all duration-300"
                            style={{ height: `${Math.max(revPct, 4)}%` }}
                          ></div>
                          <div
                            className="w-1/2 bg-rose-500 hover:bg-rose-600 rounded-t transition-all duration-300"
                            style={{ height: `${Math.max(expPct, 4)}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mt-2 truncate max-w-full">{t.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">No monthly trend data recorded yet.</p>
            )}
          </div>

          {/* Breakdown Grid: Clients & Platforms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Revenue Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">👥 Top Client Revenue Contribution</h3>
              {clientRevenue.length > 0 ? (
                <div className="space-y-3">
                  {clientRevenue.slice(0, 5).map((c, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <span>{c.client_name}</span>
                        <span>₹{c.revenue.toLocaleString()} ({c.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(c.percentage, 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">No client revenue data found.</p>
              )}
            </div>

            {/* Platform Earnings Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">🌐 Platform-Wise Earnings</h3>
              {platformEarnings.length > 0 ? (
                <div className="space-y-3">
                  {platformEarnings.map((p, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <span>{p.platform}</span>
                        <span>₹{p.revenue.toLocaleString()} ({p.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(p.percentage, 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">No platform earnings data recorded.</p>
              )}
            </div>
          </div>

          {/* Receivables Aging Report */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">⏳ Receivables Aging Report</h3>
                <p className="text-xs text-gray-500">Unpaid invoice breakdown categorized by overdue days</p>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                Total Unpaid: ₹{(agingReport?.total_receivables || 0).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              {agingReport?.aging_buckets && Object.entries(agingReport.aging_buckets).map(([key, item]) => (
                <div key={key} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 text-center">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">{item.label}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white mt-1 block">₹{item.amount.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-400 font-medium block">{item.count} invoice(s)</span>
                </div>
              ))}
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
                  className={`px-3 py-1 rounded font-bold transition ${taxRegime === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                  New Regime
                </button>
                <button
                  onClick={() => setTaxRegime('old')}
                  className={`px-3 py-1 rounded font-bold transition ${taxRegime === 'old' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
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
                <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold block">Estimated Tax ({taxRegime.toUpperCase()})</span>
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
