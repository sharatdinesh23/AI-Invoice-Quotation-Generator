// // // frontend/src/components/Layout.jsx
// // import { Outlet, Link, useLocation } from 'react-router-dom'
// // import { supabase } from '../supabaseClient'
// // import { useNavigate } from 'react-router-dom'

// // export default function Layout() {
// //   const location = useLocation()
// //   const navigate = useNavigate()

// //   const handleLogout = async () => {
// //     await supabase.auth.signOut()
// //     navigate('/login')
// //   }

// //   // Helper to highlight the active link
// //   const getLinkClass = (path) => {
// //     return location.pathname === path 
// //       ? 'bg-blue-50 text-blue-700 font-semibold' 
// //       : 'text-gray-600 hover:bg-gray-50'
// //   }

// //   return (
// //     <div className="flex h-screen bg-gray-50">
// //       {/* Sidebar */}
// //       <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
// //         <div className="p-6 border-b border-gray-200">
// //           <h1 className="text-xl font-bold text-gray-800">Freelance Portal</h1>
// //         </div>
        
// //         <nav className="flex-1 p-4 space-y-2">
// //           <Link to="/" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/')}`}>
// //             📊 Dashboard
// //           </Link>
// //           <Link to="/clients" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/clients')}`}>
// //             👥 Clients
// //           </Link>
// //           {/* <Link to="/invoices/create" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/invoices/create')}`}>
// //           📝 Create Invoice
// //         </Link> */}
// //         <Link to="/invoices" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/invoices')}`}>
// //           📄 Invoices
// //         </Link>
// //         <Link to="/products" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/products')}`}>
// //             📦 Products & Services
// //         </Link>
// //         <Link to="/settings" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/settings')}`}>
// //             ⚙️ Settings
// //         </Link>

// //         </nav>

// //         <div className="p-4 border-t border-gray-200">
// //           <button onClick={handleLogout} className="w-full text-left p-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium">
// //             🚪 Logout
// //           </button>
// //         </div>
// //       </aside>

// //       {/* Main Content Area */}
// //       <main className="flex-1 overflow-y-auto p-8">
// //         <Outlet /> {/* This is where the Dashboard/Clients/Products pages will render */}
// //       </main>
// //     </div>
// //   )
// // }

// // frontend/src/components/Layout.jsx
// import { Outlet, Link, useLocation } from 'react-router-dom'
// import { supabase } from '../supabaseClient'
// import { useNavigate } from 'react-router-dom'

// export default function Layout() {
//   const location = useLocation()
//   const navigate = useNavigate()

//   const handleLogout = async () => {
//     await supabase.auth.signOut()
//     navigate('/login')
//   }

//   const getLinkClass = (path) => {
//     const isActive = location.pathname === path
//     return isActive 
//       ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' 
//       : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
//   }

//   return (
//     <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
//       {/* Sidebar */}
//       <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
//         <div className="p-6 border-b border-gray-200 dark:border-gray-700">
//           <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Freelance Portal</h1>
//         </div>
        
//         <nav className="flex-1 p-4 space-y-2">
//           <Link to="/" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/')}`}>
//             📊 Dashboard
//           </Link>
//           <Link to="/clients" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/clients')}`}>
//             👥 Clients
//           </Link>
//           <Link to="/products" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/products')}`}>
//             📦 Products & Services
//           </Link>
//           <Link to="/invoices" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/invoices')}`}>
//             🧾 Invoices
//           </Link>
//           <Link to="/recurring" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/recurring')}`}>
//             🔄 Recurring
//           </Link>
//           <Link to="/settings" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/settings')}`}>
//             ⚙️ Settings
//           </Link>
//         </nav>

//         <div className="p-4 border-t border-gray-200 dark:border-gray-700">
//           <button onClick={handleLogout} className="w-full text-left p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition font-medium">
//             🚪 Logout
//           </button>
//         </div>
//       </aside>

//       {/* Main Content Area */}
//       <main className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900">
//         <Outlet />
//       </main>
//     </div>
//   )
// } 

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

  const getLinkClass = (path) => {
    const isActive = location.pathname === path
    return isActive 
      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' 
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Fixed width, scrollable if needed */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Freelance Portal</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link to="/" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/')}`}>
             Dashboard
          </Link>
          <Link to="/clients" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/clients')}`}>
            👥 Clients
          </Link>
          <Link to="/products" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/products')}`}>
            📦 Products & Services
          </Link>
          <Link to="/invoices" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/invoices')}`}>
            🧾 Invoices
          </Link>
          <Link to="/recurring" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/recurring')}`}>
            🔄 Recurring
          </Link>
          <Link to="/quotations" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/quotations')}`}>
            Quotations
          </Link>
          <Link to="/transactions" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/transactions')}`}>
            💸 Transactions
          </Link>
          <Link to="/payment-settings" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/payment-settings')}`}>
            💳 Payment Settings
          </Link>
          <Link to="/settings" className={`flex items-center p-3 rounded-lg transition ${getLinkClass('/settings')}`}>
            ⚙️ Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button onClick={handleLogout} className="w-full text-left p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition font-medium">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}