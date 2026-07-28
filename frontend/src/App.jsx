// // // import { useState, useEffect } from 'react'
// // // import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// // // import Auth from './pages/Auth'
// // // import Dashboard from './pages/Dashboard'

// // // function App() {
// // //   const [apiMessage, setApiMessage] = useState('Connecting to backend...')

// // //   // This runs when the page loads to check if the backend is alive
// // //   useEffect(() => {
// // //     fetch('http://localhost:8000/')
// // //       .then(res => res.json())
// // //       .then(data => setApiMessage(data.message))
// // //       .catch(err => setApiMessage('Error: Backend is not running!'))
// // //   }, [])

// // //      return (
// // //     <BrowserRouter>
// // //       <Routes>
// // //         {/* Default route goes to Dashboard */}
// // //         <Route path="/" element={<Dashboard />} />
// // //         {/* Login route */}
// // //         <Route path="/login" element={<Auth />} />
// // //         {/* Catch-all route redirects to login */}
// // //         <Route path="*" element={<Navigate to="/login" />} />
// // //       </Routes>
// // //     </BrowserRouter>
// // //   )
  
// // // }

// // // export default App

// // // frontend/src/App.jsx
// // import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// // import { useEffect, useState } from 'react'
// // import { supabase } from './supabaseClient'

// // import Layout from './components/Layout'
// // import Auth from './pages/Auth'
// // import Dashboard from './pages/Dashboard'
// // import Clients from './pages/Clients'
// // import Products from './pages/Products'
// // import CreateInvoice from './pages/CreateInvoice'
// // import Invoices from './pages/Invoices'
// // import ViewInvoice from './pages/ViewInvoice'
// // import Settings from './pages/Settings'


// // function App() {
// //   const [session, setSession] = useState(null)
// //   const [loading, setLoading] = useState(true)

// //   useEffect(() => {
// //     // Check initial session
// //     supabase.auth.getSession().then(({ data: { session } }) => {
// //       setSession(session)
// //       setLoading(false)
// //     })

// //     // Listen for auth changes (login/logout)
// //     const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
// //       setSession(session)
// //     })

// //     return () => subscription.unsubscribe()
// //   }, [])

// //   if (loading) return <div className="p-8 text-center">Loading app...</div>

// //   return (
// //     <BrowserRouter>
// //       <Routes>
// //         {/* If no session, show Auth page. If session exists, show the Layout with nested routes */}
// //         {!session ? (
// //           <Route path="/login" element={<Auth />} />
// //         ) : (
// //           <Route element={<Layout />}>
// //             <Route path="/" element={<Dashboard />} />
// //             <Route path="/clients" element={<Clients />} />
// //             <Route path="/invoices/create" element={<CreateInvoice />} />
// //             <Route path="/products" element={<Products />} />
// //             <Route path="/invoices" element={<Invoices />} />
// //             <Route path="/invoices/:id" element={<ViewInvoice />} />
// //             <Route path="/invoices/:id/edit" element={<CreateInvoice />} />
// //             <Route path="/settings" element={<Settings />} />
// //           </Route>
// //         )}
        
// //         {/* Catch-all redirects */}
// //         <Route path="*" element={<Navigate to={session ? "/" : "/login"} />} />
// //       </Routes>
// //     </BrowserRouter>
// //   )
// // }

// // export default App

// // frontend/src/App.jsx
// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// import { useEffect, useState } from 'react'
// import { supabase } from './supabaseClient'

// import Layout from './components/Layout'
// import Auth from './pages/Auth'
// import Dashboard from './pages/Dashboard'
// import Clients from './pages/Clients'
// import Products from './pages/Products'
// import Invoices from './pages/Invoices'
// import CreateInvoice from './pages/CreateInvoice'
// import Settings from './pages/Settings'

// function App() {
//   const [session, setSession] = useState(null)
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       setSession(session)
//       setLoading(false)
//     })

//     const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
//       setSession(session)
//     })

//     return () => subscription.unsubscribe()
//   }, [])

//   if (loading) return <div className="p-8 text-center">Loading app...</div>

//   return (
//     <BrowserRouter>
//       <Routes>
//         {!session ? (
//           <Route path="/login" element={<Auth />} />
//         ) : (
//           <Route element={<Layout />}>
//             <Route path="/" element={<Dashboard />} />
//             <Route path="/clients" element={<Clients />} />
//             <Route path="/products" element={<Products />} />
//             <Route path="/invoices" element={<Invoices />} />
//             <Route path="/invoices/new" element={<CreateInvoice />} />
//             {/* THIS IS THE CRUCIAL ROUTE FOR EDITING */}
//             <Route path="/invoices/:id/edit" element={<CreateInvoice />} /> 
//             <Route path="/settings" element={<Settings />} />
//           </Route>
//         )}
//         <Route path="*" element={<Navigate to={session ? "/" : "/login"} />} />
//       </Routes>
//     </BrowserRouter>
//   )
// }

// export default App

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
import Settings from './pages/Settings'

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
        {!session ? (
          <Route path="/login" element={<Auth />} />
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            
            {/* INVOICE ROUTES */}
            <Route path="/invoices/new" element={<CreateInvoice />} />
            <Route path="/invoices/:id/edit" element={<CreateInvoice />} />
            <Route path="/invoices/:id/view" element={<CreateInvoice />} /> {/* Reusing CreateInvoice for now to view data */}
            
            <Route path="/settings" element={<Settings />} />
          </Route>
        )}
        {/* Catch-all route */}
        <Route path="*" element={<Navigate to={session ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App