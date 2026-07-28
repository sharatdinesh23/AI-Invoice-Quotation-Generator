// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ clients: 0, pending: 0, paid: 0, revenue: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login') // Redirect to login if not authenticated
      } else {
        setUser(user)
        fetchDashboardData(user)
      }
    }
    checkUser()
  }, [navigate])

  // Fetch data from our secure FastAPI backend
  const fetchDashboardData = async (currentUser) => {
    const { data: { session } } = await supabase.auth.getSession()
    
    // We pass the user's token to our backend!
    const response = await fetch('http://localhost:8000/api/dashboard', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      setStats(data.stats)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Dashboard Overview</h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Clients" value={stats.clients} color="blue" />
          <StatCard title="Pending Invoices" value={stats.pending} color="yellow" />
          <StatCard title="Paid Invoices" value={stats.paid} color="green" />
          <StatCard title="Total Revenue" value={`$${stats.revenue}`} color="purple" />
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <ActionButton label="+ New Invoice" />
            <ActionButton label="+ New Client" />
            <ActionButton label="+ New Quote" />
          </div>
        </div>
      </main>
    </div>
  )
}

// Helper Components for the Dashboard
function StatCard({ title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100'
  }

  return (
    <div className={`p-6 rounded-xl border ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  )
}

function ActionButton({ label }) {
  return (
    <button className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium">
      {label}
    </button>
  )
}