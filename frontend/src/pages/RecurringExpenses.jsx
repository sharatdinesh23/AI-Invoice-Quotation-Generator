import React, { useState, useEffect } from 'react';
import * as api from '../api.js';

const RecurringExpenses = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    category: 'Software & Tools',
    amount: '',
    currency: 'INR',
    frequency: 'monthly',
    vendor_name: '',
    description: '',
    next_due_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.getRecurringExpenses();
      const data = await res.json();
      setRules(data.recurring_expenses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDue = async () => {
    try {
      setProcessing(true);
      const res = await api.processRecurringExpenses();
      const data = await res.json();
      alert(data.message || 'Processed due recurring expenses!');
      fetchRules();
    } catch (err) {
      alert('Failed to process recurring expenses');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleActive = async (ruleId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const res = await api.toggleRecurringExpenseRule(ruleId, newStatus);
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      alert('Failed to toggle rule status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recurring expense rule?')) return;
    try {
      const res = await api.deleteRecurringExpense(id);
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      alert('Failed to delete rule');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount || 0)
      };
      const res = await api.createRecurringExpense(payload);
      if (res.ok) {
        setShowModal(false);
        setFormData({
          category: 'Software & Tools', amount: '', currency: 'INR',
          frequency: 'monthly', vendor_name: '', description: '',
          next_due_date: new Date().toISOString().split('T')[0]
        });
        fetchRules();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.detail || 'Failed'}`);
      }
    } catch (err) {
      alert('Failed to create recurring rule');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Expenses Automation</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Automate recurring business subscriptions (AWS, Adobe, Rent, Internet)</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleProcessDue}
            disabled={processing}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-sm font-semibold border border-indigo-200 shadow-xs flex items-center gap-2"
          >
            {processing ? 'Processing...' : '⚡ Process Due Recurring Expenses'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs"
          >
            ➕ New Recurring Rule
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-6 py-3 text-xs uppercase">Vendor / Subscription</th>
              <th className="px-6 py-3 text-xs uppercase">Category</th>
              <th className="px-6 py-3 text-xs uppercase">Frequency</th>
              <th className="px-6 py-3 text-xs uppercase">Amount</th>
              <th className="px-6 py-3 text-xs uppercase">Next Due Date</th>
              <th className="px-6 py-3 text-xs uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-500">Loading recurring rules...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-500">No active recurring expense rules found. Click "New Recurring Rule" to create one!</td></tr>
            ) : (
              rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900 dark:text-white">{rule.vendor_name || 'Software Subscription'}</p>
                    {rule.description && <p className="text-xs text-gray-500">{rule.description}</p>}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">
                    {rule.category}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                      {rule.frequency}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                    {rule.currency || 'INR'} {Number(rule.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {rule.next_due_date}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(rule.id, rule.is_active ?? true)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                        (rule.is_active ?? true)
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {(rule.is_active ?? true) ? '● Active' : '○ Paused'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Recurring Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Recurring Expense Rule</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Vendor / Provider Name *</label>
                <input
                  type="text"
                  required
                  value={formData.vendor_name}
                  onChange={(e) => setFormData(p => ({ ...p, vendor_name: e.target.value }))}
                  placeholder="e.g. AWS Cloud, Adobe Creative Cloud"
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                  >
                    <option value="Software & Tools">Software & Tools</option>
                    <option value="Internet & Phone">Internet & Phone</option>
                    <option value="Office Rent & Utilities">Office Rent & Utilities</option>
                    <option value="Marketing & Ads">Marketing & Ads</option>
                    <option value="Professional Services">Professional Services</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData(p => ({ ...p, frequency: e.target.value }))}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Next Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.next_due_date}
                    onChange={(e) => setFormData(p => ({ ...p, next_due_date: e.target.value }))}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Notes about subscription plan"
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Create Recurring Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringExpenses;
