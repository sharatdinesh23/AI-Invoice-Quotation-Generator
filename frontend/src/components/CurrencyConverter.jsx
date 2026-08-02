// frontend/src/components/CurrencyConverter.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
  { code: 'EUR', name: 'Euro (€)', symbol: '€' },
  { code: 'GBP', name: 'British Pound (£)', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee (₹)', symbol: '₹' },
  { code: 'NPR', name: 'Nepalese Rupee (Rs)', symbol: 'Rs' },
  { code: 'CAD', name: 'Canadian Dollar ($)', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar ($)', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen (¥)', symbol: '¥' },
  { code: 'AED', name: 'UAE Dirham (AED)', symbol: 'AED' },
  { code: 'SAR', name: 'Saudi Riyal (SAR)', symbol: 'SAR' },
  { code: 'SGD', name: 'Singapore Dollar ($)', symbol: 'S$' },
  { code: 'CHF', name: 'Swiss Franc (CHF)', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan (¥)', symbol: '¥' }
]

export default function CurrencyConverter({ initialAmount = 100, initialFrom = 'USD', initialTo = 'INR', isOpen, onClose }) {
  const [amount, setAmount] = useState(initialAmount)
  const [fromCurrency, setFromCurrency] = useState(initialFrom)
  const [toCurrency, setToCurrency] = useState(initialTo)
  const [convertedResult, setConvertedResult] = useState(null)
  const [exchangeRate, setExchangeRate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setAmount(initialAmount)
    setFromCurrency(initialFrom)
    setToCurrency(initialTo)
  }, [initialAmount, initialFrom, initialTo])

  useEffect(() => {
    if (amount > 0 && fromCurrency && toCurrency) {
      handleConvert()
    }
  }, [amount, fromCurrency, toCurrency])

  const handleConvert = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/currency/convert', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(amount) || 0,
          from_currency: fromCurrency,
          to_currency: toCurrency
        })
      })

      if (res.ok) {
        const data = await res.json()
        setConvertedResult(data.converted_amount)
        setExchangeRate(data.exchange_rate)
      } else {
        const err = await res.json()
        setError(err.detail || 'Conversion failed')
      }
    } catch (err) {
      console.error('Currency conversion error:', err)
      setError('Unable to fetch live exchange rates.')
    } finally {
      setLoading(false)
    }
  }

  const handleSwap = () => {
    const temp = fromCurrency
    setFromCurrency(toCurrency)
    setToCurrency(temp)
  }

  if (isOpen === false) return null

  const content = (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💱</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Universal Currency Converter</h3>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Amount
        </label>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter amount"
        />
      </div>

      {/* Currency Selectors */}
      <div className="grid grid-cols-5 gap-2 items-center mb-6">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            From
          </label>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {COMMON_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-center pt-5">
          <button
            onClick={handleSwap}
            title="Swap Currencies"
            className="p-2.5 rounded-full bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-600 transition"
          >
            ⇄
          </button>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            To
          </label>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {COMMON_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result Display */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-900 p-4 rounded-xl border border-blue-100 dark:border-gray-600 text-center">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Fetching live rates...</p>
        ) : error ? (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        ) : (
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Converted Amount</span>
            <h4 className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 my-1">
              {toCurrency} {convertedResult !== null ? convertedResult.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
            </h4>
            {exchangeRate && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                1 {fromCurrency} = {exchangeRate} {toCurrency}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        {content}
      </div>
    )
  }

  return content
}
