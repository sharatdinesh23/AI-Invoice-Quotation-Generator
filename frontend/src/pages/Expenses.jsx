import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

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
    category: '', subcategory: '', amount: '', currency: 'USD', description: '',
    expense_date: new Date().toISOString().split('T')[0], payment_method: '',
    vendor_name: '', tax_amount: 0, tax_rate: 0, is_tax_deductible: true,
    notes: '', status: 'completed', receipt_url: ''
  });

  const paymentMethods = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Check', 'Other'];
  const statuses = ['completed', 'pending', 'reimbursable'];

  useEffect(() => { fetchExpenses(); fetchCategories(); fetchSummary(); }, [filterCategory, filterStatus, dateRange]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const res = await api.get('/api/expenses', { params });
      setExpenses(res.data.expenses || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try { const res = await api.get('/api/expenses/categories'); setCategories(res.data.categories || []); }
    catch (error) { console.error('Error:', error); }
  };

  const fetchSummary = async () => {
    try {
      const params = {};
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const res = await api.get('/api/expenses/summary', { params });
      setSummary(res.data.summary);
    } catch (error) { console.error('Error:', error); }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) { await api.put('/api/expenses/' + editingExpense.id, formData); alert('Updated!'); }
      else { await api.post('/api/expenses', formData); alert('Created!'); }
      setShowModal(false); setEditingExpense(null); resetForm(); fetchExpenses(); fetchSummary();
    } catch (error) { alert(error.response?.data?.detail || 'Failed'); }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category || '', subcategory: expense.subcategory || '', amount: expense.amount || '',
      currency: expense.currency || 'USD', description: expense.description || '',
      expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : '',
      payment_method: expense.payment_method || '', vendor_name: expense.vendor_name || '',
      tax_amount: expense.tax_amount || 0, tax_rate: expense.tax_rate || 0,
      is_tax_deductible: expense.is_tax_deductible !== undefined ? expense.is_tax_deductible : true,
      notes: expense.notes || '', status: expense.status || 'completed', receipt_url: expense.receipt_url || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try { await api.delete('/api/expenses/' + id); alert('Deleted!'); fetchExpenses(); fetchSummary(); }
    catch (error) { alert('Failed'); }
  };

  const resetForm = () => {
    setFormData({ category: '', subcategory: '', amount: '', currency: 'USD', description: '',
      expense_date: new Date().toISOString().split('T')[0], payment_method: '', vendor_name: '',
      tax_amount: 0, tax_rate: 0, is_tax_deductible: true, notes: '', status: 'completed', receipt_url: '' });
    setEditingExpense(null);
  };

  const openNewModal = () => { resetForm(); setShowModal(true); };
  const getCategoryColor = (category) => { const cat = categories.find(c => c.name === category); return cat && cat.color_code ? cat.color_code : '#6B7280'; };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Expenses</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Track business expenses</p></div>
          <button onClick={openNewModal} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">Add Expense</button>
        </div>
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"><p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p><p className="text-2xl font-bold text-red-600 mt-1">${Number(summary.total_expenses||0).toFixed(2)}</p></div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"><p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p><p className="text-2xl font-bold text-green-600 mt-1">${Number(summary.total_revenue||0).toFixed(2)}</p></div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"><p className="text-sm text-gray-600 dark:text-gray-400">Net Profit</p><p className={"text-2xl font-bold mt-1 " + ((summary.net_profit||0) >= 0 ? 'text-green-600' : 'text-red-600')}>${Number(summary.net_profit||0).toFixed(2)}</p></div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"><button onClick={() => navigate('/analytics')} className="text-blue-600">Analytics</button></div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"><option value="">All Categories</option>{categories.map(cat => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}</select></div>
            <div><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"><option value="">All</option><option value="completed">Completed</option><option value="pending">Pending</option></select></div>
            <div><input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
            <div><input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700"><tr>
              <th className="px-6 py-3 text-left text-xs uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-xs uppercase">Actions</th>
            </tr></thead>
            <tbody>{loading ? (<tr><td colSpan="5" className="p-8 text-center">Loading...</td></tr>) : expenses.length === 0 ? (<tr><td colSpan="5" className="p-8 text-center">No expenses</td></tr>) : (expenses.map((e) => (<tr key={e.id} className="border-t dark:border-gray-700"><td className="px-6 py-4">{new Date(e.expense_date).toLocaleDateString()}</td><td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs text-white" style={{backgroundColor: getCategoryColor(e.category)}}>{e.category}</span></td><td className="px-6 py-4">{e.vendor_name || '-'}</td><td className="px-6 py-4">${Number(e.amount||0).toFixed(2)}</td><td className="px-6 py-4 text-right"><button onClick={() => handleEdit(e)} className="text-blue-600 mr-2">Edit</button><button onClick={() => handleDelete(e.id)} className="text-red-600">Delete</button></td></tr>)))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
