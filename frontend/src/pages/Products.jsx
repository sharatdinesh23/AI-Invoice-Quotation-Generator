// // frontend/src/pages/Products.jsx
// import { useState, useEffect } from 'react'
// import { apiFetch } from '../api'

// export default function Products() {
//   const [products, setProducts] = useState([])
//   const [editingId, setEditingId] = useState(null)
//   const [name, setName] = useState('')
//   const [rate, setRate] = useState('')

//   useEffect(() => { fetchProducts() }, [])

//   const fetchProducts = async () => {
//     const res = await apiFetch('/api/products')
//     const data = await res.json()
//     setProducts(data.products || [])
//   }

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     const payload = { name, rate: parseFloat(rate) }
    
//     if (editingId) {
//       await apiFetch(`/api/products/${editingId}`, {
//         method: 'PATCH',
//         body: JSON.stringify(payload)
//       })
//     } else {
//       await apiFetch('/api/products', {
//         method: 'POST',
//         body: JSON.stringify(payload)
//       })
//     }
    
//     setEditingId(null)
//     setName('')
//     setRate('')
//     fetchProducts()
//   }

//   const handleEdit = (product) => {
//     setEditingId(product.id)
//     setName(product.name)
//     setRate(product.rate.toString())
//   }

//   const handleCancel = () => {
//     setEditingId(null)
//     setName('')
//     setRate('')
//   }

//   const deleteProduct = async (id) => {
//     if(window.confirm('Are you sure you want to delete this service?')) {
//       await apiFetch(`/api/products/${id}`, { method: 'DELETE' })
//       fetchProducts()
//     }
//   }

//   return (
//     <div>
//       <h2 className="text-2xl font-bold text-gray-800 mb-6">Products & Services</h2>
      
//       <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
//         <div className="flex-1 min-w-[200px]">
//           <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
//           <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
//             className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
//         </div>
//         <div className="w-40">
//           <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
//           <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required
//             className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
//         </div>
//         <div className="flex gap-2">
//           <button type="submit" className={`px-6 py-2 text-white rounded-lg font-medium transition ${editingId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
//             {editingId ? 'Update Service' : 'Add Service'}
//           </button>
//           {editingId && (
//             <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
//               Cancel
//             </button>
//           )}
//         </div>
//       </form>

//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//         <table className="w-full text-left">
//           <thead className="bg-gray-50 border-b border-gray-200">
//             <tr>
//               <th className="p-4 text-sm font-semibold text-gray-600">Service Name</th>
//               <th className="p-4 text-sm font-semibold text-gray-600">Rate</th>
//               <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {products.length === 0 ? (
//               <tr><td colSpan="3" className="p-8 text-center text-gray-500">No services yet. Add your first one above!</td></tr>
//             ) : (
//               products.map(product => (
//                 <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
//                   <td className="p-4 font-medium text-gray-800">{product.name}</td>
//                   <td className="p-4 text-gray-600">${product.rate}</td>
//                   <td className="p-4 text-right space-x-2">
//                     <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
//                       Edit
//                     </button>
//                     <button onClick={() => deleteProduct(product.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   )
// }
// frontend/src/pages/Products.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => { fetchProducts() }, [])

  const fetchProducts = async () => {
    const res = await apiFetch('/api/products')
    const data = await res.json()
    setProducts(data.products || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editingId) {
      // UPDATE existing product
      await apiFetch(`/api/products/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, rate: parseFloat(rate) })
      })
      setEditingId(null)
    } else {
      // CREATE new product
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({ name, rate: parseFloat(rate) })
      })
    }
    
    setName('')
    setRate('')
    fetchProducts()
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    setName(product.name)
    setRate(product.rate)
  }

  const handleCancel = () => {
    setEditingId(null)
    setName('')
    setRate('')
  }

  const deleteProduct = async (id) => {
    if(window.confirm('Are you sure?')) {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' })
      fetchProducts()
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Products & Services</h2>
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            {editingId ? 'Update Service' : 'Add Service'}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Service Name</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Rate</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan="3" className="p-8 text-center text-gray-500">No services yet. Add your first one above!</td></tr>
            ) : (
              products.map(product => (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800">{product.name}</td>
                  <td className="p-4 text-gray-600">${product.rate}</td>
                  <td className="p-4 text-right space-x-3">
                    <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    <button onClick={() => deleteProduct(product.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}