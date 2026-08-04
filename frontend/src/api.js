// frontend/src/api.js
import { supabase } from './supabaseClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// This helper automatically attaches the user's token to every request to our FastAPI backend
export const apiFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
    ...options.headers,
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })
  
  return response
}

// Payment account / Route
export const getPaymentAccountStatus = () => apiFetch('/api/payment-account/status');
export const connectPaymentAccount = () => apiFetch('/api/payment-account/connect', { method: 'POST' });
export const updatePaymentAccountDetails = (data) => apiFetch('/api/payment-account/update-details', { method: 'POST', body: JSON.stringify(data) });
export const togglePaymentIntegration = (enable) => apiFetch('/api/payment-account/toggle-integration', { method: 'POST', body: JSON.stringify({ enable }) });
export const getPayouts = () => apiFetch('/api/payouts');
export const getPaymentSplits = () => apiFetch('/api/payment-splits');
export const getTransactions = () => apiFetch('/api/transactions');
export const getPlatformTransactions = () => apiFetch('/api/admin/platform-transactions');
export const getMeContext = () => apiFetch('/api/me/context');
export const retryInvoicePayout = (invoiceId) => apiFetch(`/api/invoices/${invoiceId}/retry-payout`, { method: 'POST' });
export const refundInvoice = (invoiceId, reason = '') => apiFetch(`/api/invoices/${invoiceId}/refund`, { method: 'POST', body: JSON.stringify({ reason }) });
export const getProjectDetail = (id) => apiFetch(`/api/projects/${id}`);
export const getProjectMilestones = (projectId) => apiFetch(`/api/projects/${projectId}/milestones`);
export const createMilestone = (projectId, data) => apiFetch(`/api/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
export const updateMilestone = (projectId, milestoneId, data) => apiFetch(`/api/projects/${projectId}/milestones/${milestoneId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMilestone = (projectId, milestoneId) => apiFetch(`/api/projects/${projectId}/milestones/${milestoneId}`, { method: 'DELETE' });
export const createInvoiceFromMilestone = (projectId, milestoneId) => apiFetch(`/api/projects/${projectId}/milestones/${milestoneId}/create-invoice`, { method: 'POST' });
export const settleInvoicePayout = (invoiceId, utrNumber) => apiFetch(`/api/invoices/${invoiceId}/settle`, { method: 'POST', body: JSON.stringify({ utr_number: utrNumber }) });

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
export const getRevenueTrends = (months = 6) => apiFetch(`/api/analytics/revenue-trends?months=${months}`);
export const getClientRevenue = () => apiFetch('/api/analytics/client-revenue');
export const getPlatformEarnings = () => apiFetch('/api/analytics/platform-earnings');
export const getAgingReport = () => apiFetch('/api/analytics/aging-report');
export const exportAnalyticsPdf = () => apiFetch('/api/analytics/export-pdf');

// Projects / CRM
export const getProjects = () => apiFetch('/api/projects');
export const createProject = (data) => apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id, data) => apiFetch(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
export const syncGmailProjects = () => apiFetch('/api/projects/sync-gmail', { method: 'POST' });
export const getPlatformConnections = () => apiFetch('/api/platform-connections');
export const savePlatformConnection = (data) => apiFetch('/api/platform-connections', { method: 'POST', body: JSON.stringify(data) });
export const deletePlatformConnection = (id) => apiFetch(`/api/platform-connections/${id}`, { method: 'DELETE' });
export const syncPlatformConnection = (id) => apiFetch(`/api/platform-connections/${id}/sync`, { method: 'POST' });

// Recurring Expenses
export const getRecurringExpenses = () => apiFetch('/api/recurring-expenses');
export const createRecurringExpense = (data) => apiFetch('/api/recurring-expenses', { method: 'POST', body: JSON.stringify(data) });
export const deleteRecurringExpense = (id) => apiFetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' });
export const toggleRecurringExpenseRule = (id, is_active) => apiFetch(`/api/recurring-expenses/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
export const processRecurringExpenses = () => apiFetch('/api/recurring-expenses/process', { method: 'POST' });

// Receipt Upload
export const uploadExpenseReceipt = (data) => apiFetch('/api/expenses/upload-receipt', { method: 'POST', body: JSON.stringify(data) });

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