// frontend/src/pages/CreateQuotation.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../api'

export default function CreateQuotation() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [clientId, setClientId] = useState('')
  const [quoteNumber, setQuoteNumber] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState('Draft')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [items, setItems] = useState([{ product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])

  useEffect(() => {
    const fetchData = async () => {
      const resC = await apiFetch('/api/clients'); setClients((await resC.json()).clients || [])
      const resP = await apiFetch('/api/products'); setProducts((await resP.json()).products || [])

      if (isEditing) {
        const res = await apiFetch(`/api/quotations/${id}`)
        const data = await res.json()
        const q = data.quotation
        setClientId(q.client_id); setQuoteNumber(q.quote_number); setCurrency(q.currency || 'USD');
        setStatus(q.status || 'Draft'); setDiscount(q.discount || 0); setNotes(q.notes || '');
        setValidUntil(q.valid_until || '');
        const calculatedTaxRate = q.subtotal > 0 ? ((q.tax / q.subtotal) * 100).toFixed(2) : 0
        setTaxRate(calculatedTaxRate)
        setItems(q.items.length > 0 ? q.items.map(i => ({...i, quantity: parseFloat(i.quantity)||1, rate: parseFloat(i.rate)||0, amount: parseFloat(i.amount)||0})) : [{ product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])
      } else {
        const res = await apiFetch('/api/quotations/next-number')
        const data = await res.json()
        setQuoteNumber(data.next_number || 'QUO-1')
      }
    }
    fetchData()
  }, [id, isEditing])

  const addItem = () => setItems([...items, { product_id: '', description: '', quantity: 1, rate: 0, amount: 0 }])
  const removeItem = (index) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)) }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    if (field === 'product_id' && value) {
      const p = products.find(p => p.id === value)
      if (p) { newItems[index].description = p.name; newItems[index].rate = parseFloat(p.rate) || 0 }
    }
    newItems[index].amount = (parseFloat(newItems[index].quantity) || 0) * (parseFloat(newItems[index].rate) || 0)
    setItems(newItems)
  }

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const taxAmount = subtotal * (parseFloat(taxRate) / 100)
  const total = subtotal + taxAmount - (parseFloat(discount) || 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientId) return alert('Please select a client')
    const payload = { client_id: clientId, quote_number: quoteNumber, currency, status, valid_until: validUntil, notes, subtotal, tax: taxAmount, discount, total, items }
    const url = isEditing ? `/api/quotations/${id}` : '/api/quotations'
    const method = isEditing ? 'PUT' : 'POST'
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) })
    if (res.ok) { alert(isEditing ? 'Quotation updated!' : 'Quotation created!'); navigate('/quotations') } 
    else { alert('Error saving quotation') }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{isEditing ? 'Edit Quotation' : 'Create New Quotation'}</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quote Number</label>
            <input type="text" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} required readOnly={isEditing} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid Until</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100">
              <option value="Draft">Draft</option><option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option><option value="Rejected">Rejected</option>
              <option value="Converted">Converted</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Line Items</h3>
            <button type="button" onClick={addItem} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">+ Add Item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="col-span-5">
                  <select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100">
                    <option value="">Select product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100" required /></div>
                <div className="col-span-2"><input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(index, 'rate', e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100" required /></div>
                <div className="col-span-2 text-right font-medium text-gray-700 dark:text-gray-300 text-sm">{currency} {item.amount.toFixed(2)}</div>
                <div className="col-span-1 text-right"><button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 text-sm">✕</button></div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full md:w-1/3 space-y-3">
            <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal:</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400"><span>Tax (%):</span><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" /></div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400"><span>Discount:</span><input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded text-right text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" /></div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between text-lg font-bold text-gray-800 dark:text-gray-100"><span>Total:</span><span>{currency} {total.toFixed(2)}</span></div>
            <textarea placeholder="Notes / Terms & Conditions" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 mt-2" rows="3"></textarea>
          </div>
          <div className="flex items-end gap-3">
            <button type="button" onClick={() => navigate('/quotations')} className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold">Cancel</button>
            <button type="submit" className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow-md">{isEditing ? 'Update Quote' : 'Save Quote'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}