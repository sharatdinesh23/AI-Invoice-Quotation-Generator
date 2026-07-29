// frontend/src/pages/CreateRecurringInvoice.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function CreateRecurringInvoice() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  
  const [clientId, setClientId] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [dueDateOffset, setDueDateOffset] = useState(15)
  const [currency, setCurrency] = useState('USD')
  
  const [items, setItems] = useState([{ product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])

  useEffect(() => {
    const fetchData = async () => {
      const resC = await apiFetch('/api/clients')
      const dataC = await resC.json()
      setClients(dataC.clients || [])

      const resP = await apiFetch('/api/products')
      const dataP = await resP.json()
      setProducts(dataP.products || [])
    }
    fetchData()
  }, [])

  const addItem = () => {
    setItems([...items, { product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])
  }

  const removeItem = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    
    if (field === 'product_id' && value) {
      const p = products.find(p => p.id === value)
      if (p) { 
        newItems[index].description = p.name
        newItems[index].rate = parseFloat(p.rate) || 0
      }
    }
    
    const qty = parseFloat(newItems[index].quantity) || 0
    const rt = parseFloat(newItems[index].rate) || 0
    newItems[index].amount = qty * rt
    
    setItems(newItems)
  }

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const taxAmount = subtotal * (parseFloat(taxRate) / 100)
  const total = subtotal + taxAmount - (parseFloat(discount) || 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientId) return alert('Please select a client')
    if (!startDate) return alert('Please select a start date')

    const payload = { 
      client_id: clientId, 
      frequency,
      start_date: startDate,
      day_of_month: frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly' ? dayOfMonth : null,
      day_of_week: frequency === 'weekly' ? dayOfWeek : null,
      due_date_offset: parseInt(dueDateOffset),
      currency,
      tax: taxAmount,
      discount,
      subtotal,
      total,
      items 
    }

    try {
      const res = await apiFetch('/api/recurring', { 
        method: 'POST', 
        body: JSON.stringify(payload) 
      })
      
      if (res.ok) {
        alert('✅ Recurring invoice template created successfully!')
        navigate('/recurring')
      } else {
        const err = await res.json()
        alert(`Failed to create: ${err.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Error:", error)
      alert('Network error while creating recurring invoice.')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Create Recurring Invoice Template</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required 
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} 
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>

          {(frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day of Month</label>
              <select value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                {[...Array(28)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}{getOrdinal(i+1)}</option>
                ))}
              </select>
            </div>
          )}

          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day of Week</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                <option value={0}>Monday</option>
                <option value={1}>Tuesday</option>
                <option value={2}>Wednesday</option>
                <option value={3}>Thursday</option>
                <option value={4}>Friday</option>
                <option value={5}>Saturday</option>
                <option value={6}>Sunday</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} 
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="INR">INR (₹)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date Offset (days)</label>
            <input type="number" value={dueDateOffset} onChange={(e) => setDueDateOffset(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Line Items</h3>
            <button type="button" onClick={addItem} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">+ Add Item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="col-span-5">
                  <select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)} 
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100">
                    <option value="">Select a product/service...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100" required />
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} 
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100" required />
                </div>
                <div className="col-span-2 text-right font-medium text-gray-700 dark:text-gray-300 text-sm">
                  {currency} {item.amount.toFixed(2)}
                </div>
                <div className="col-span-1 text-right">
                  <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full md:w-1/3 space-y-3">
            <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal:</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400"><span>Tax (%):</span><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" /></div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400"><span>Discount ({currency}):</span><input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" /></div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-lg font-bold text-gray-800 dark:text-gray-100"><span>Total:</span><span>{currency} {total.toFixed(2)}</span></div>
          </div>
          <div className="flex items-end gap-3">
            <button type="button" onClick={() => navigate('/recurring')} className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold">Cancel</button>
            <button type="submit" className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md">
              Save Recurring Template
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}