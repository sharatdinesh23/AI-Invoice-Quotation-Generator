// frontend/src/pages/PaymentSettings.jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function PaymentSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Account Status
  const [accountStatus, setAccountStatus] = useState({
    status: 'not_connected',
    account_id: null,
    enabled: false,
    commission_percentage: 2.00,
    payout_destination_type: 'bank',
    payout_details_provided: false,
    onboard_url: null
  })
  
  // Domestic Bank/UPI Details
  const [payoutType, setPayoutType] = useState('bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [upiId, setUpiId] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [panNumber, setPanNumber] = useState('')

  // International Bank (SWIFT/IBAN) Details
  const [swiftCode, setSwiftCode] = useState('')
  const [ibanNumber, setIbanNumber] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankCountry, setBankCountry] = useState('IN')
  
  // Payout History
  const [payouts, setPayouts] = useState([])
  const [paymentSplits, setPaymentSplits] = useState([])
  
  useEffect(() => {
    fetchAccountStatus()
    fetchPayouts()
    fetchPaymentSplits()
  }, [])
  
  const fetchAccountStatus = async () => {
    try {
      const res = await apiFetch('/api/payment-account/status')
      const data = await res.json()
      setAccountStatus(data)
      
      if (data.payout_destination_type) {
        setPayoutType(data.payout_destination_type)
      }

      if (data.payout_destination_value) {
        try {
          const rawVal = data.payout_destination_value
          let parsed = null
          if (typeof rawVal === 'string' && rawVal.trim().startsWith('{')) {
            parsed = JSON.parse(rawVal)
          } else {
            parsed = rawVal
          }

          if (parsed && typeof parsed === 'object') {
            if (parsed.account_holder_name || parsed.name) {
              setAccountHolderName(parsed.account_holder_name || parsed.name || '')
            }
            if (parsed.account_number || parsed.bank_account_number) {
              setAccountNumber(parsed.account_number || parsed.bank_account_number || '')
            }
            if (parsed.ifsc_code || parsed.ifsc) {
              setIfscCode(parsed.ifsc_code || parsed.ifsc || '')
            }
            if (parsed.upi_id) {
              setUpiId(parsed.upi_id || '')
            }
            if (parsed.pan_number) {
              setPanNumber(parsed.pan_number || '')
            }
          } else if (typeof parsed === 'string') {
            if (data.payout_destination_type === 'upi') {
              setUpiId(parsed)
            }
          }
        } catch (e) {
          if (data.payout_destination_type === 'upi' && typeof data.payout_destination_value === 'string') {
            setUpiId(data.payout_destination_value)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching account status:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchPayouts = async () => {
    try {
      const res = await apiFetch('/api/payouts')
      const data = await res.json()
      setPayouts(data.payouts || [])
    } catch (error) {
      console.error('Error fetching payouts:', error)
    }
  }
  
  const fetchPaymentSplits = async () => {
    try {
      const res = await apiFetch('/api/payment-splits')
      const data = await res.json()
      setPaymentSplits(data.payment_splits || [])
    } catch (error) {
      console.error('Error fetching payment splits:', error)
    }
  }
  
  const handleConnectAccount = async () => {
    try {
      const res = await apiFetch('/api/payment-account/connect', {
        method: 'POST'
      })
      const data = await res.json()
      
      if (!res.ok) {
        alert(data.detail || 'Failed to connect Razorpay Route account')
        return
      }

      if (data.onboard_url) {
        window.open(data.onboard_url, '_blank')
        alert(data.message || 'Razorpay Route account created. Complete verification in the opened dashboard.')
      } else if (data.account_id) {
        alert(data.message || `Route account connected: ${data.account_id}`)
      } else {
        alert(data.message || 'Payment integration enabled. Add bank/UPI details below.')
      }
      fetchAccountStatus()
    } catch (error) {
      console.error('Error connecting account:', error)
      alert('Failed to initiate account connection')
    }
  }
  
  const handleSaveDetails = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      let destinationValue = ''
      
      if (payoutType === 'bank') {
        if (!accountNumber || !ifscCode || !accountHolderName) {
          alert('Please provide account holder name, account number and IFSC code')
          setSaving(false)
          return
        }
        const bankDetails = {
          account_holder_name: accountHolderName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          pan_number: panNumber
        }
        destinationValue = JSON.stringify(bankDetails)
      } else if (payoutType === 'upi') {
        if (!upiId || !accountHolderName) {
          alert('Please provide account holder name and UPI ID')
          setSaving(false)
          return
        }
        const upiDetails = {
          upi_id: upiId,
          account_holder_name: accountHolderName,
          pan_number: panNumber
        }
        destinationValue = JSON.stringify(upiDetails)
      }

      const payload = {
        payout_destination_type: payoutType,
        payout_destination_value: destinationValue,
        bank_account_number: accountNumber,
        ifsc_code: ifscCode,
        upi_id: upiId,
        account_holder_name: accountHolderName,
        pan_number: panNumber,
        swift_code: swiftCode,
        iban_number: ibanNumber,
        routing_number: routingNumber,
        bank_name: bankName,
        bank_country: bankCountry,
        payment_integration_enabled: true
      }
      
      const response = await apiFetch('/api/payment-account/update-details', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      await response.json()
      alert('Payment & International Wire details saved successfully!')
      fetchAccountStatus()
    } catch (error) {
      console.error('Error saving details:', error)
      let errorMessage = 'Failed to save payment details'
      try {
        const errData = await error.response?.json()
        errorMessage = errData?.detail || errData?.message || errorMessage
      } catch (e) {
        // Ignore
      }
      alert(errorMessage)
    } finally {
      setSaving(false)
    }
  }
  
  const handleToggleIntegration = async (enable) => {
    try {
      await apiFetch('/api/payment-account/toggle-integration', {
        method: 'POST',
        body: JSON.stringify({ enable })
      })
      
      alert(`Payment integration ${enable ? 'enabled' : 'disabled'} successfully!`)
      fetchAccountStatus()
    } catch (error) {
      const errData = await error.response?.json()
      alert(errData?.detail || `Failed to ${enable ? 'enable' : 'disable'} payment integration`)
    }
  }
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'verified':
      case 'active':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }
  
  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading payment settings...</div>
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Payment Settings & Payouts</h1>
        <p className="text-gray-600">Configure client payment routing, UTR settlement, and international SWIFT wire transfers.</p>
      </div>
      
      {/* Account Status Card */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Payment Routing Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase">Connection Status</p>
            <p className={`text-base font-bold mt-1 px-2.5 py-1 rounded inline-block ${getStatusColor(accountStatus.status)}`}>
              {accountStatus.status.replace('_', ' ').toUpperCase()}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase">Razorpay Route Account</p>
            <p className="text-sm font-mono mt-1 text-gray-800 break-all">
              {accountStatus.account_id || 'Not connected'}
            </p>
            {accountStatus.razorpay_account_status && (
              <p className="text-xs text-gray-500 mt-1">KYC: {accountStatus.razorpay_account_status}</p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase">Payment Gateway Integration</p>
            <p className="text-base font-bold mt-1">
              {accountStatus.enabled ? (
                <span className="text-green-600">✓ Enabled</span>
              ) : (
                <span className="text-gray-600">✗ Disabled</span>
              )}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase">Platform Commission</p>
            <p className="text-base font-bold mt-1 text-blue-600">{accountStatus.commission_percentage}%</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          {!accountStatus.account_id && (
            <button
              onClick={handleConnectAccount}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
            >
              Connect Razorpay Routing Account
            </button>
          )}
          
          {accountStatus.payout_details_provided && (
            <button
              onClick={() => handleToggleIntegration(!accountStatus.enabled)}
              className={`px-4 py-2 font-semibold rounded-lg shadow-sm ${
                accountStatus.enabled 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {accountStatus.enabled ? 'Disable Payment Integration' : 'Enable Payment Integration'}
            </button>
          )}
        </div>
      </div>
      
      {/* Payout Details Form */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Payout & Bank Credentials</h2>
        <form onSubmit={handleSaveDetails} className="space-y-6">
          
          {/* Domestic Method Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Domestic Payout Method (INR)</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payoutType"
                  value="bank"
                  checked={payoutType === 'bank'}
                  onChange={(e) => setPayoutType(e.target.value)}
                  className="text-blue-600 w-4 h-4"
                />
                <span className="font-medium text-gray-800">Bank Transfer (NEFT / RTGS / IMPS)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payoutType"
                  value="upi"
                  checked={payoutType === 'upi'}
                  onChange={(e) => setPayoutType(e.target.value)}
                  className="text-blue-600 w-4 h-4"
                />
                <span className="font-medium text-gray-800">UPI ID</span>
              </label>
            </div>
          </div>
          
          {/* Domestic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name *</label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Name as per bank account"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ABCDE1234F"
              />
            </div>
          </div>
          
          {payoutType === 'bank' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter bank account number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code *</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. HDFC0001234"
                />
              </div>
            </div>
          )}
          
          {payoutType === 'upi' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID *</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., yourname@upi"
              />
            </div>
          )}

          {/* International SWIFT & Wire Section */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🌐</span>
              <h3 className="text-lg font-bold text-gray-900">International Wire & SWIFT Settings</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Provide these details to display automatic international bank wire instructions for foreign clients.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. HDFC Bank Ltd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT / BIC Code</label>
                <input
                  type="text"
                  value={swiftCode}
                  onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
                  placeholder="e.g. HDFCINBBXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN Number</label>
                <input
                  type="text"
                  value={ibanNumber}
                  onChange={(e) => setIbanNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
                  placeholder="e.g. IN93HDFC00001234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Routing Number / ABA (Optional)</label>
                <input
                  type="text"
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
                  placeholder="e.g. 021000021"
                />
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow"
          >
            {saving ? 'Saving Details...' : 'Save Payment & International Credentials'}
          </button>
        </form>
      </div>
      
      {/* Payout History & UTR Logs */}
      {payouts.length > 0 && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Payout Settlement History & UTR Logs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  <th className="py-3 px-4">Invoice</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-right py-3 px-4">Fee ({accountStatus.commission_percentage}%)</th>
                  <th className="text-right py-3 px-4">Net Payout</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">UTR Number</th>
                  <th className="text-left py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 text-sm">
                    <td className="py-3 px-4 font-mono font-medium text-gray-800">{payout.invoice_id?.slice(0, 8)}...</td>
                    <td className="text-right py-3 px-4 font-medium">₹{payout.amount?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-red-600">-₹{payout.commission_amount?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-emerald-600 font-bold">₹{payout.net_payout?.toFixed(2)}</td>
                    <td className="text-center py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        payout.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-gray-800">
                      {payout.utr_number || payout.payout_reference || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {new Date(payout.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
