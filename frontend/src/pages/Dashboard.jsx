// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ 
    clients: 0, 
    pending_count: 0, 
    pending_amount: 0, 
    paid_count: 0, 
    revenue: 0 
  })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [pendingInvoices, setPendingInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.log("No user found, redirecting to login")
          navigate('/login')
          return
        }
        setUser(user)
        await fetchDashboardData()
      } catch (err) {
        console.error("Auth error:", err)
        navigate('/login')
      }
    }
    checkUser()
  }, [navigate])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log("Fetching dashboard data...")
      const res = await apiFetch('/api/dashboard')
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      
      const data = await res.json()
      console.log("Dashboard data received:", data)
      
      setStats(data.stats || { 
        clients: 0, 
        pending_count: 0, 
        pending_amount: 0, 
        paid_count: 0, 
        revenue: 0 
      })
      setRecentInvoices(data.recent_invoices || [])
      setPendingInvoices(data.pending_invoices || [])
      
    } catch (err) {
      console.error("Dashboard fetch error:", err)
      setError(err.message)
      // Don't redirect on data fetch error, just show error message
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400 text-lg">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600 dark:text-red-300 text-sm mb-4">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard Overview</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">Welcome, {user?.email}</span>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Clients" value={stats.clients} color="blue" icon="" />
        <StatCard title="Pending Invoices" value={stats.pending_count} sub={`$${stats.pending_amount?.toFixed(2) || 0}`} color="yellow" icon="⏳" />
        <StatCard title="Paid Invoices" value={stats.paid_count} color="green" icon="✅" />
        <StatCard title="Total Revenue" value={`$${stats.revenue?.toFixed(2) || 0}`} color="purple" icon="💰" />
      </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Invoices</h3>
            <button onClick={() => navigate('/invoices')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View All &rarr;
            </button>
          </div>
          
          {recentInvoices.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map(inv => (
                <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{inv.invoice_number}</p>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{inv.clients?.name || 'Unknown Client'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                      {inv.currency || 'USD'} {parseFloat(inv.total || 0).toFixed(2)}
                    </p>
                    <button 
                      onClick={() => navigate(`/invoices/${inv.id}/view`)} 
                      className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 font-medium transition"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending / Needs Attention */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Needs Attention (Pending)</h3>
          {pendingInvoices.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">All caught up! 🎉</p>
          ) : (
            <div className="space-y-3">
              {pendingInvoices.map(inv => (
                <div key={inv.id} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{inv.invoice_number}</p>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{inv.clients?.name}</p>
                  </div>
                  <button 
                    onClick={() => navigate(`/invoices/${inv.id}/view`)} 
                    className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 font-medium transition"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  )
}

// Helper component for Status Badges
function StatusBadge({ status }) {
  const styles = {
    Paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    Sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    Overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }
  
  // Fallback to Draft if status is unknown
  const style = styles[status] || styles.Draft;
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${style}`}>
      {status}
    </span>
  )
}


function StatCard({ title, value, sub, color, icon }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-100 dark:border-yellow-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800'
  }
  
  return (
    <div className={`p-6 rounded-xl border ${colors[color]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {sub && <p className="text-sm mt-1 opacity-75">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}