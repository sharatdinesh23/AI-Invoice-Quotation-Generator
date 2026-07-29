// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Invoices from './pages/Invoices'
import CreateInvoice from './pages/CreateInvoice'
import ViewInvoice from './pages/ViewInvoice'
import Settings from './pages/Settings'
import RecurringInvoices from './pages/RecurringInvoices'
import CreateRecurringInvoice from './pages/CreateRecurringInvoice'
import Quotations from './pages/Quotations'
import CreateQuotation from './pages/CreateQuotation'
import PublicInvoiceView from './pages/PublicInvoiceView'
import Landing from './pages/Landing'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading app...</div>

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. PUBLIC ROUTES (No Auth Required) */}
        <Route path="/portal/:id" element={<PublicInvoiceView />} />
        
        {/* 2. CONDITIONAL ROUTING BASED ON SESSION */}
        {!session ? (
          // If NOT logged in: Show Landing page at root, and Auth at /login
          <>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth />} />
          </>
        ) : (
          // If LOGGED IN: Show Dashboard at root, and wrap app routes in Layout
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<CreateInvoice />} />
            <Route path="/invoices/:id/view" element={<ViewInvoice />} />
            <Route path="/invoices/:id/edit" element={<CreateInvoice />} />
            <Route path="/recurring" element={<RecurringInvoices />} />
            <Route path="/recurring/new" element={<CreateRecurringInvoice />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/quotations/new" element={<CreateQuotation />} />
            <Route path="/quotations/:id/edit" element={<CreateQuotation />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        )}
        
        {/* 3. CATCH-ALL REDIRECT */}
        <Route path="*" element={<Navigate to={session ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App