// frontend/src/api.js
import { supabase } from './supabaseClient'

// This helper automatically attaches the user's token to every request to our FastAPI backend
export const apiFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
    ...options.headers,
  }

  const response = await fetch(`http://127.0.0.1:8000${endpoint}`, {
    ...options,
    headers,
  })
  
  return response
}

// Expense Categories
export const getExpenseCategories = () => apiFetch('/api/expenses/categories');
export const createExpenseCategory = (data) => apiFetch('/api/expenses/categories', { method: 'POST', body: JSON.stringify(data) });
export const updateExpenseCategory = (id, data) => apiFetch(`/api/expenses/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteExpenseCategory = (id) => apiFetch(`/api/expenses/categories/${id}`, { method: 'DELETE' });

// Expenses
export const getExpenses = (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiFetch(`/api/expenses${queryString ? '?' + queryString : ''}`);
};
export const createExpense = (data) => apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(data) });
export const updateExpense = (id, data) => apiFetch(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteExpense = (id) => apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });

// Analytics
export const getExpenseAnalytics = (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiFetch(`/api/expenses/analytics${queryString ? '?' + queryString : ''}`);
};
export const getExpenseStats = () => apiFetch('/api/expenses/stats');
export const getProfitLoss = (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiFetch(`/api/profit-loss${queryString ? '?' + queryString : ''}`);
};

// Existing API helpers
export const getClients = () => apiFetch('/api/clients');
export const createClient = (data) => apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(data) });
export const updateClient = (id, data) => apiFetch(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteClient = (id) => apiFetch(`/api/clients/${id}`, { method: 'DELETE' });

export const getInvoices = () => apiFetch('/api/invoices');
export const createInvoice = (data) => apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) });
export const updateInvoice = (id, data) => apiFetch(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteInvoice = (id) => apiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
export const sendInvoice = (id) => apiFetch(`/api/invoices/${id}/send`, { method: 'POST' });
export const markInvoiceAsPaid = (id) => apiFetch(`/api/invoices/${id}/mark-paid`, { method: 'POST' });

export const getQuotations = () => apiFetch('/api/quotations');
export const createQuotation = (data) => apiFetch('/api/quotations', { method: 'POST', body: JSON.stringify(data) });
export const updateQuotation = (id, data) => apiFetch(`/api/quotations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteQuotation = (id) => apiFetch(`/api/quotations/${id}`, { method: 'DELETE' });
export const convertQuotationToInvoice = (id) => apiFetch(`/api/quotations/${id}/convert`, { method: 'POST' });

export const getUserProfile = () => apiFetch('/api/profile');
export const updateUserProfile = (data) => apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify(data) });

export const getDashboardData = () => apiFetch('/api/dashboard');
export const getSubscriptions = () => apiFetch('/api/subscriptions');
export const createSubscription = (planType) => apiFetch('/api/subscriptions/create', { method: 'POST', body: JSON.stringify({ plan_type: planType }) });