// frontend/src/components/Layout.jsx
import { Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Helper to highlight the active link
  const getLinkClass = (path) => {
    return location.pathname === path 
      ? 'bg-blue-50 text-blue-700 font-semibold' 
      : 'text-gray-600 hover:bg-gray-50'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Freelance Portal</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/')}`}>
            📊 Dashboard
          </Link>
          <Link to="/clients" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/clients')}`}>
            👥 Clients
          </Link>
          <Link to="/invoices/create" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/invoices/create')}`}>
          📝 Create Invoice
        </Link>
        <Link to="/invoices" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/invoices')}`}>
          📄 Invoices
        </Link>
        <Link to="/products" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/products')}`}>
            📦 Products & Services
        </Link>
        <Link to="/settings" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/settings')}`}>
            ⚙️ Settings
        </Link>

        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full text-left p-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet /> {/* This is where the Dashboard/Clients/Products pages will render */}
      </main>
    </div>
  )
}