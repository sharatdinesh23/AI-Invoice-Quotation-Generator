import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api.js';

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    category: '', 
    subcategory: '', 
    amount: '', 
    currency: 'INR', 
    description: '',
    expense_date: new Date().toISOString().split('T')[0], 
    payment_method: 'Bank Transfer',
    vendor_name: '', 
    tax_amount: 0, 
    tax_rate: 0, 
    is_tax_deductible: true,
    notes: '', 
    status: 'completed', 
    receipt_url: ''
  });

  const paymentMethods = ['Bank Transfer', 'UPI', 'Card', 'Cash', 'Check', 'Other'];

  useEffect(() => { 
    fetchExpenses(); 
    fetchCategories(); 
    fetchSummary(); 
  }, [filterCategory, filterStatus, dateRange]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const res = await api.getExpenses(params);
      const data = await res.json();
      setExpenses(data.expenses || []);
    } catch (error) { 
      console.error('Error fetching expenses:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchCategories = async () => {
    try { 
      const res = await api.getExpenseCategories(); 
      const data = await res.json();
      setCategories(data.categories || []); 
    } catch (error) { 
      console.error('Error fetching categories:', error); 
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.getExpenseStats();
      const data = await res.json();
      setSummary(data);
    } catch (error) { 
      console.error('Error fetching summary:', error); 
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const resetForm = () => {
    setFormData({ 
      category: categories.length > 0 ? categories[0].name : '', 
      subcategory: '', 
      amount: '', 
      currency: 'INR', 
      description: '',
      expense_date: new Date().toISOString().split('T')[0], 
      payment_method: 'Bank Transfer', 
      vendor_name: '',
      tax_amount: 0, 
      tax_rate: 0,
      is_tax_deductible: true, 
      notes: '', 
      status: 'completed', 
      receipt_url: ''
    });
    setEditingExpense(null);
  };

  const openNewModal = () => { 
    resetForm(); 
    setShowModal(true); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category) {
      alert('Please select a category.');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        tax_amount: parseFloat(formData.tax_amount || 0)
      };

      let res;
      if (editingExpense) { 
        res = await api.updateExpense(editingExpense.id, payload); 
        if (res.ok) alert('Expense updated successfully!');
      } else { 
        res = await api.createExpense(payload); 
        if (res.ok) alert('Expense created successfully!'); 
      }
      
      if (!res.ok) {
        const errData = await res.json();
        alert(`Error: ${errData.detail || 'Failed to save expense'}`);
        return;
      }

      setShowModal(false); 
      setEditingExpense(null); 
      resetForm(); 
      fetchExpenses(); 
      fetchSummary(); 
    } catch (error) { 
      console.error(error);
      alert('Failed to save expense.'); 
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category || '', 
      subcategory: expense.subcategory || '',
      amount: expense.amount || '',
      currency: expense.currency || 'INR', 
      description: expense.description || '',
      expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_method: expense.payment_method || 'Bank Transfer', 
      vendor_name: expense.vendor_name || '',
      tax_amount: expense.tax_amount || 0,
      is_tax_deductible: expense.is_tax_deductible !== undefined ? expense.is_tax_deductible : true,
      notes: expense.notes || '', 
      status: expense.status || 'completed', 
      receipt_url: expense.receipt_url || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try { 
      const res = await api.deleteExpense(id); 
      if (res.ok) {
        alert('Expense deleted successfully!'); 
        fetchExpenses(); 
        fetchSummary(); 
      }
    } catch (error) { 
      alert('Failed to delete expense.'); 
    }
  };

  const getCategoryColor = (catName) => {
    const cat = categories.find(c => c.name === catName);
    return cat?.color || '#3B82F6';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Expenses</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Track business expenses & tax deductions</p>
          </div>
          <button 
            onClick={openNewModal} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm flex items-center gap-2"
          >
            ➕ Add Expense
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹{summary.current_month?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Previous Month</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">₹{summary.previous_month?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">Tax Deductible (This Month)</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">₹{summary.tax_deductible_this_month?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase">MoM Change</p>
              <p className={`text-2xl font-bold mt-1 ${summary.month_over_month_change >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {summary.month_over_month_change > 0 ? `+${summary.month_over_month_change}%` : `${summary.month_over_month_change}%`}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)} 
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm p-2"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm p-2"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} 
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm p-2" 
              />
            </div>
            <div>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} 
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm p-2" 
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-6 py-3 text-xs uppercase">Date</th>
                <th className="px-6 py-3 text-xs uppercase">Category</th>
                <th className="px-6 py-3 text-xs uppercase">Vendor / Description</th>
                <th className="px-6 py-3 text-xs uppercase">Method</th>
                <th className="px-6 py-3 text-xs uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading expenses...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No expense records found. Click "Add Expense" to record one!</td></tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">
                      {new Date(e.expense_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded text-xs font-bold text-white shadow-xs" style={{ backgroundColor: getCategoryColor(e.category) }}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{e.vendor_name || 'N/A'}</p>
                      {e.description && <p className="text-xs text-gray-500 dark:text-gray-400">{e.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {e.payment_method || 'Other'}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                      {e.currency || 'INR'} {Number(e.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(e)} className="text-blue-600 hover:text-blue-800 font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Expense Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                </h3>
                <button 
                  onClick={() => { setShowModal(false); setEditingExpense(null); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      required
                      placeholder="0.00"
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Currency
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Expense Date *
                    </label>
                    <input
                      type="date"
                      name="expense_date"
                      value={formData.expense_date}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                      Payment Method *
                    </label>
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                    >
                      {paymentMethods.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Vendor / Supplier Name
                  </label>
                  <input
                    type="text"
                    name="vendor_name"
                    value={formData.vendor_name}
                    onChange={handleInputChange}
                    placeholder="e.g. AWS, Adobe, Local Shop"
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief details about the expense"
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2.5 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_tax_deductible"
                    name="is_tax_deductible"
                    checked={formData.is_tax_deductible}
                    onChange={handleInputChange}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="is_tax_deductible" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tax Deductible Business Expense
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingExpense(null); }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-sm"
                  >
                    {editingExpense ? 'Save Changes' : 'Create Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Expenses;
