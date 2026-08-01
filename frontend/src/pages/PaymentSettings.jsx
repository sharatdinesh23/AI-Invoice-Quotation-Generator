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
  
  // Bank/UPI Details
  const [payoutType, setPayoutType] = useState('bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [upiId, setUpiId] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [panNumber, setPanNumber] = useState('')
  
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
      
      if (data.onboard_url && data.onboard_url !== 'https://onboarding.razorpay.com/mock') {
        window.open(data.onboard_url, '_blank')
        alert('Please complete the onboarding process in the new window')
      } else {
        alert('Razorpay Route is not yet enabled. Please add your bank/UPI details manually below.')
      }
    } catch (error) {
      const errData = await error.response?.json()
      alert(errData?.detail || 'Failed to initiate account connection')
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
        destinationValue = upiId
      }

      const payload = {
        payout_destination_type: payoutType,
        payout_destination_value: destinationValue,
        payment_integration_enabled: accountStatus.enabled,
        commission_percentage: accountStatus.commission_percentage
      }

      console.log('Sending payload:', payload)
      
      const response = await apiFetch('/api/payment-account', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      const result = await response.json()
      console.log('Response:', result)
      
      alert('Payment details saved successfully!')
      fetchAccountStatus()
    } catch (error) {
      console.error('Error saving details:', error)
      let errorMessage = 'Failed to save payment details'
      try {
        const errData = await error.response?.json()
        errorMessage = errData?.detail || errData?.message || errorMessage
      } catch (e) {
        // Ignore parsing error
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
    return <div className="p-8 text-center">Loading payment settings...</div>
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Payment Settings</h1>
        <p className="text-gray-600">Configure how you receive payments from clients</p>
      </div>
      
      {/* Account Status Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Account Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-600">Connection Status</p>
            <p className={`text-lg font-semibold mt-1 px-2 py-1 rounded inline-block ${getStatusColor(accountStatus.status)}`}>
              {accountStatus.status.replace('_', ' ').toUpperCase()}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-600">Payment Integration</p>
            <p className="text-lg font-semibold mt-1">
              {accountStatus.enabled ? (
                <span className="text-green-600">✓ Enabled</span>
              ) : (
                <span className="text-gray-600">✗ Disabled</span>
              )}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-600">Platform Commission</p>
            <p className="text-lg font-semibold mt-1">{accountStatus.commission_percentage}%</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          {!accountStatus.account_id && (
            <button
              onClick={handleConnectAccount}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Connect Razorpay Account
            </button>
          )}
          
          {accountStatus.payout_details_provided && (
            <button
              onClick={() => handleToggleIntegration(!accountStatus.enabled)}
              className={`px-4 py-2 rounded ${
                accountStatus.enabled 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {accountStatus.enabled ? 'Disable Payment Integration' : 'Enable Payment Integration'}
            </button>
          )}
        </div>
        
        {accountStatus.onboard_url && accountStatus.status === 'pending' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800">
              ⚠️ Please complete your Razorpay onboarding: 
              <a href={accountStatus.onboard_url} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                Complete Onboarding
              </a>
            </p>
          </div>
        )}
      </div>
      
      {/* Payout Details Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Payout Destination</h2>
        <form onSubmit={handleSaveDetails} className="space-y-4">
          {/* Payout Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Payout Method</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payoutType"
                  value="bank"
                  checked={payoutType === 'bank'}
                  onChange={(e) => setPayoutType(e.target.value)}
                  className="text-blue-600"
                />
                <span>Bank Transfer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payoutType"
                  value="upi"
                  checked={payoutType === 'upi'}
                  onChange={(e) => setPayoutType(e.target.value)}
                  className="text-blue-600"
                />
                <span>UPI</span>
              </label>
            </div>
          </div>
          
          {/* Common Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Account Holder Name</label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="As per bank records"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PAN Number</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="ABCDE1234F"
                pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                title="Enter valid PAN (e.g., ABCDE1234F)"
              />
            </div>
          </div>
          
          {/* Bank-specific Fields */}
          {payoutType === 'bank' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter account number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., SBIN0001234"
                />
              </div>
            </div>
          )}
          
          {/* UPI-specific Fields */}
          {payoutType === 'upi' && (
            <div>
              <label className="block text-sm font-medium mb-1">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., yourname@oksbi"
              />
            </div>
          )}
          
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Payment Details'}
          </button>
        </form>
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            ℹ️ <strong>Note:</strong> Once you enable payment integration, when clients pay your invoices:
            <ul className="list-disc list-inside mt-2">
              <li>{accountStatus.commission_percentage}% will be deducted as platform fee</li>
              <li>The remaining amount will be automatically transferred to your {payoutType === 'bank' ? 'bank account' : 'UPI ID'}</li>
              <li>You can track all transactions in the Payout History below</li>
            </ul>
          </p>
        </div>
      </div>
      
      {/* Payment Splits Table */}
      {paymentSplits.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Payment Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Invoice ID</th>
                  <th className="text-right py-3 px-4">Total Amount</th>
                  <th className="text-right py-3 px-4">Commission ({accountStatus.commission_percentage}%)</th>
                  <th className="text-right py-3 px-4">Your Payout</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentSplits.map((split) => (
                  <tr key={split.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{split.invoice_id.slice(0, 8)}...</td>
                    <td className="text-right py-3 px-4">₹{split.total_amount?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-red-600">-₹{split.commission_amount?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-green-600 font-semibold">₹{split.freelancer_amount?.toFixed(2)}</td>
                    <td className="text-center py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        split.split_status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {split.split_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(split.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Payout History */}
      {payouts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Payout History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Invoice</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-right py-3 px-4">Commission</th>
                  <th className="text-right py-3 px-4">Net Payout</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Reference</th>
                  <th className="text-left py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{payout.invoice_id?.slice(0, 8)}...</td>
                    <td className="text-right py-3 px-4">₹{payout.amount?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-red-600">-₹{payout.commission_amount?.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-green-600 font-semibold">₹{payout.net_payout?.toFixed(2)}</td>
                    <td className="text-center py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        payout.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : payout.status === 'pending_manual'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {payout.payout_reference ? payout.payout_reference.slice(0, 12) + '...' : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(payout.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {payouts.length === 0 && paymentSplits.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No payout transactions yet. Once clients start paying your invoices, you'll see the breakdown here.</p>
        </div>
      )}
    </div>
  )
}
