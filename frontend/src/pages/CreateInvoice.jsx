// frontend/src/pages/CreateInvoice.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../api'

export default function CreateInvoice() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState('Draft') // Fix #4: Status is now updatable
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  
  const [items, setItems] = useState([{ product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])

  // useEffect(() => {
  //   const fetchData = async () => {
  //     const resC = await apiFetch('/api/clients')
  //     const dataC = await resC.json()
  //     setClients(dataC.clients || [])

  //     const resP = await apiFetch('/api/products')
  //     const dataP = await resP.json()
  //     setProducts(dataP.products || [])

  //     if (isEditing) {
  //       const res = await apiFetch(`/api/invoices/${id}`)
  //       const data = await res.json()
  //       const inv = data.invoice
        
  //       setClientId(inv.client_id)
  //       setInvoiceNumber(inv.invoice_number)
  //       setCurrency(inv.currency || 'USD')
  //       setStatus(inv.status || 'Draft')
  //       setDiscount(inv.discount || 0)
        
  //       // Calculate tax rate from tax amount and subtotal to pre-fill the input
  //       const calculatedTaxRate = inv.subtotal > 0 ? ((inv.tax / inv.subtotal) * 100).toFixed(2) : 0
  //       setTaxRate(calculatedTaxRate)

  //       // Fix #3: Prevent NaN by ensuring all numeric fields are properly parsed as floats
  //       const formattedItems = data.items.map(item => ({
  //         ...item,
  //         quantity: parseFloat(item.quantity) || 1,
  //         rate: parseFloat(item.rate) || 0,
  //         amount: parseFloat(item.amount) || 0
  //       }))
  //       setItems(formattedItems.length > 0 ? formattedItems : [{ product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])
  //     } else {
  //       const res = await apiFetch('/api/invoices/next-number')
  //       const data = await res.json()
  //       setInvoiceNumber(data.next_number)
  //     }
  //   }
  //   fetchData()
  // }

    useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Clients and Products for the dropdowns
        const resC = await apiFetch('/api/clients')
        const dataC = await resC.json()
        setClients(dataC.clients || [])

        const resP = await apiFetch('/api/products')
        const dataP = await resP.json()
        setProducts(dataP.products || [])

        // 2. Handle Edit Mode vs Create Mode
        if (isEditing) {
          const res = await apiFetch(`/api/invoices/${id}`)
          const data = await res.json()
          const inv = data.invoice // <--- The actual invoice data is nested here
          
          if (inv) {
            // Set basic details
            setClientId(inv.client_id || '')
            setInvoiceNumber(inv.invoice_number || '')
            setCurrency(inv.currency || 'USD')
            setStatus(inv.status || 'Draft')
            setDiscount(inv.discount || 0)
            
            // Calculate and set Tax Rate
            const taxAmount = inv.tax_amount || inv.tax || 0;
            const calculatedTaxRate = inv.subtotal > 0 ? (taxAmount / inv.subtotal) * 100 : 0
            setTaxRate(calculatedTaxRate.toFixed(2))

            // FIX: Read items from inv.items, not data.items!
            const formattedItems = (inv.items || []).map(item => ({
              ...item,
              product_id: item.product_id || '', // Ensure product_id is explicitly set for the dropdown
              description: item.description || '',
              quantity: parseFloat(item.quantity) || 1,
              rate: parseFloat(item.rate) || 0,
              amount: parseFloat(item.amount) || 0
            }))
            
            // Set the items, or default to one empty row if none exist
            setItems(formattedItems.length > 0 ? formattedItems : [{ product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])
          }
        } else {
          // 3. Fetch Next Invoice Number for new invoices
          const res = await apiFetch('/api/invoices/next-number')
          if (res.ok) {
            const data = await res.json()
            setInvoiceNumber(data.next_number || 'INV-1')
          } else {
            setInvoiceNumber('INV-1') 
          }
        }
      } catch (error) {
        console.error("Error fetching invoice data:", error)
        if (!isEditing) setInvoiceNumber('INV-1')
      }
    }
    fetchData()
  }, [id, isEditing])
 

  const addItem = () => {
    setItems([...items, { product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])
  }

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    
    // Auto-fill description and rate when a product is selected
    if (field === 'product_id' && value) {
      const p = products.find(p => p.id === value)
      if (p) { 
        newItems[index].description = p.name // Fix #2: Auto-fills description, removing need for manual input
        newItems[index].rate = parseFloat(p.rate) || 0
      }
    }
    
    // Fix #3: Safe math to prevent NaN
    const qty = parseFloat(newItems[index].quantity) || 0
    const rt = parseFloat(newItems[index].rate) || 0
    newItems[index].amount = qty * rt
    
    setItems(newItems)
  }

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const taxAmount = subtotal * (parseFloat(taxRate) / 100)
  const total = subtotal + taxAmount - (parseFloat(discount) || 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientId) return alert('Please select a client')

    const payload = { 
      client_id: clientId, 
      invoice_number: invoiceNumber, 
      currency, 
      status, // Fix #4: Status is now included in the payload
      subtotal, 
      tax: taxAmount, 
      discount, 
      total, 
      items 
    }
    
    const url = isEditing ? `/api/invoices/${id}` : '/api/invoices'
    const method = isEditing ? 'PUT' : 'POST'

    const res = await apiFetch(url, { method, body: JSON.stringify(payload) })
    if (res.ok) {
      alert(isEditing ? 'Invoice updated!' : 'Invoice created!')
      navigate('/invoices')
    } else {
      alert('Error saving invoice')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{isEditing ? 'Edit Invoice' : 'Create New Invoice'}</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required readOnly={isEditing}
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            {/* Fix #5: Expanded currency list */}
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="INR">INR (₹)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="SGD">SGD (S$)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CNY">CNY (¥)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            {/* Fix #4: Status is now an interactive dropdown */}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Line Items</h3>
            <button type="button" onClick={addItem} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">+ Add Item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg">
                {/* Fix #2: Removed manual description input. Dropdown is wider (col-span-5) and auto-fills description */}
                <div className="col-span-5">
                  <select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Select a product/service...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
                <div className="col-span-2 text-right font-medium text-gray-700 text-sm">
                  {currency} {item.amount.toFixed(2)}
                </div>
                <div className="col-span-1 text-right">
                  <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full md:w-1/3 space-y-3">
            <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between items-center text-gray-600"><span>Tax (%):</span><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-20 p-1 border border-gray-300 rounded text-right text-sm" /></div>
            <div className="flex justify-between items-center text-gray-600"><span>Discount ({currency}):</span><input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-20 p-1 border border-gray-300 rounded text-right text-sm" /></div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold text-gray-800"><span>Total:</span><span>{currency} {total.toFixed(2)}</span></div>
          </div>
          <div className="flex items-end">
            <button type="submit" className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md">
              {isEditing ? 'Update Invoice' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}