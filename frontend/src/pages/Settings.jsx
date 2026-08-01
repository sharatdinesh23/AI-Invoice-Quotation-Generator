// frontend/src/pages/Settings.jsx
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { apiFetch } from '../api'
import { THEMES, getStoredTheme, setStoredTheme, applyTheme } from '../utils/theme'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Profile State
  const [orgName, setOrgName] = useState('')
  const [gstin, setGstin] = useState('')
  const [prefix, setPrefix] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [taxLabel, setTaxLabel] = useState('GST')
  const [preferredCurrency, setPreferredCurrency] = useState('USD')
  const [subPlan, setSubPlan] = useState('free')
  const [subStatus, setSubStatus] = useState('inactive')

  // Password State
  const [newPass, setNewPass] = useState('')

  // Gmail State
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: '' })
  const [gmailLoading, setGmailLoading] = useState(false)

  // Theme State
  const [theme, setTheme] = useState(THEMES.SYSTEM)

  useEffect(() => { 
    fetchSettings() 
    checkGmailStatus()
    setTheme(getStoredTheme())
    
    // Clear URL params after showing them
    if (searchParams.has('gmail_connected') || searchParams.has('gmail_error')) {
      setTimeout(() => setSearchParams({}), 3000)
    }
  }, [])

  const fetchSettings = async () => {
    const res = await apiFetch('/api/settings')
    const data = await res.json()
    if (data.profile) {
      setOrgName(data.profile.organization_name || '')
      setGstin(data.profile.gstin || '')
      setTaxLabel(data.profile.tax_label || 'GST')
      setPrefix(data.profile.invoice_prefix || '')
      setLogoUrl(data.profile.logo_url || '')
      setPreferredCurrency(data.profile.preferred_currency || 'USD')

      setSubPlan(data.profile.subscription_plan || 'free')
      setSubStatus(data.profile.subscription_status || 'inactive')
    }
  }

  const checkGmailStatus = async () => {
    try {
      const res = await apiFetch('/api/auth/google/status')
      const data = await res.json()
      setGmailStatus(data)
    } catch (error) {
      console.error("Error checking Gmail status:", error)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const { data: { user } } = await supabase.auth.getUser()
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`

    const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true })
    if (error) return alert('Error uploading logo')

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
    setLogoUrl(publicUrl)
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    setLoading(true)
    await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ 
        organization_name: orgName, 
        gstin, 
        tax_label: taxLabel,
        invoice_prefix: prefix, 
        logo_url: logoUrl,
        preferred_currency: preferredCurrency
      })
    })
    alert('Settings saved!')
    setLoading(false)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) alert(error.message)
    else {
      alert('Password changed successfully!')
      setNewPass('')
    }
  }

  const connectGmail = async () => {
    try {
      setGmailLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return alert("Please log in first.")

      const res = await apiFetch('/api/auth/google')
      const data = await res.json()

      const scopeString = data.scopes.join(' ')
      const googleAuthUrl = `${data.auth_url}?` + 
        `client_id=${data.client_id}&` +
        `redirect_uri=${encodeURIComponent(data.redirect_uri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopeString)}&` +
        `state=${encodeURIComponent(session.access_token)}&` +
        `access_type=offline&` +
        `prompt=consent`

      window.location.href = googleAuthUrl
    } catch (error) {
      console.error("Error connecting Gmail:", error)
      alert("Failed to initiate Gmail connection.")
      setGmailLoading(false)
    }
  }

  const disconnectGmail = async () => {
    if(!window.confirm("Are you sure you want to disconnect your Gmail account? You won't be able to send invoices via email until you reconnect.")) return
    
    try {
      setGmailLoading(true)
      await apiFetch('/api/auth/google/disconnect', { method: 'DELETE' })
      setGmailStatus({ connected: false, email: '' })
      alert('Gmail disconnected successfully.')
    } catch (error) {
      alert('Failed to disconnect Gmail.')
    } finally {
      setGmailLoading(false)
    }
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    setStoredTheme(newTheme)
    applyTheme(newTheme)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h2>

      {/* Success/Error Banners */}
      {searchParams.get('gmail_connected') === 'true' && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded-lg flex items-center gap-2">
          <span>✅</span> Gmail account connected successfully!
        </div>
      )}
      {searchParams.get('gmail_error') && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-lg flex items-center gap-2">
          <span>❌</span> Failed to connect Gmail. Please try again.
        </div>
      )}

      {/* ============ THEME MODE SECTION ============ */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Appearance</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose how the app looks to you</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Light Theme */}
          <button
            onClick={() => handleThemeChange(THEMES.LIGHT)}
            className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
              theme === THEMES.LIGHT 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-xl">
              ☀️
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 dark:text-gray-100">Light</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Classic bright mode</p>
            </div>
          </button>

          {/* Dark Theme */}
          <button
            onClick={() => handleThemeChange(THEMES.DARK)}
            className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
              theme === THEMES.DARK 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center text-xl">
              🌙
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 dark:text-gray-100">Dark</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Easy on the eyes</p>
            </div>
          </button>

          {/* System Theme */}
          <button
            onClick={() => handleThemeChange(THEMES.SYSTEM)}
            className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
              theme === THEMES.SYSTEM 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-white to-gray-800 border-2 border-gray-300 flex items-center justify-center text-xl">
              💻
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 dark:text-gray-100">System</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Match your device</p>
            </div>
          </button>
        </div>
      </div>

      {/* ============ GMAIL INTEGRATION SECTION ============ */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">Email Integration</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Connect your Gmail account to send invoices directly from your professional email address with the PDF attached.</p>
        
        {gmailStatus.connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center text-green-600 dark:text-green-300 font-bold text-xl">
                {gmailStatus.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">Gmail Connected</p>
                  <span className="px-2 py-0.5 bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-100 text-xs rounded-full font-medium">Active</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{gmailStatus.email}</p>
              </div>
            </div>
            <button 
              onClick={disconnectGmail} 
              disabled={gmailLoading}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-medium text-sm disabled:opacity-50"
            >
              {gmailLoading ? 'Disconnecting...' : 'Disconnect Gmail'}
            </button>
          </div>
        ) : (
          <button 
            onClick={connectGmail} 
            disabled={gmailLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {gmailLoading ? 'Connecting...' : 'Connect Gmail Account'}
          </button>
        )}
      </div>

            {/* ============ SMART AUTOMATION ============ */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">Smart Automation (AI)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Automatically send polite, AI-generated follow-up emails to clients who haven't paid. 
          <br/><span className="text-xs text-gray-500">Day 3: Friendly nudge • Day 7: Firm reminder • Day 14: Final notice</span>
        </p>
        
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100">Enable Auto-Reminders</p>
            {/* <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Groq AI (100% Free)</p> */}
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* ============ BUSINESS PROFILE ============ */}
      <form onSubmit={saveSettings} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">Business Profile & Invoicing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization Name</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferred Currency</label>
            <select 
              value={preferredCurrency} 
              onChange={(e) => setPreferredCurrency(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="INR">INR - Indian Rupee</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
              <option value="CNY">CNY - Chinese Yuan</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="SGD">SGD - Singapore Dollar</option>
              <option value="CHF">CHF - Swiss Franc</option>
              <option value="NZD">NZD - New Zealand Dollar</option>
              <option value="ZAR">ZAR - South African Rand</option>
              <option value="BRL">BRL - Brazilian Real</option>
              <option value="MXN">MXN - Mexican Peso</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This currency will be used for CSV downloads and amount display
            </p>
          </div>
                    <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Type Label</label>
            <select 
              value={taxLabel} 
              onChange={(e) => setTaxLabel(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            >
              <option value="GST">GST (India, Australia, etc.)</option>
              <option value="VAT">VAT (Europe, UK, UAE, etc.)</option>
              <option value="Sales Tax">Sales Tax (USA, etc.)</option>
              <option value="Tax">Generic Tax</option>
              <option value="None">No Tax</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GSTIN / Tax ID</label>
            <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice Prefix</label>
            <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Logo</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload}
              className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"/>
            {logoUrl && <img src={logoUrl} alt="Logo" className="mt-2 h-16 object-contain border dark:border-gray-600 rounded" />}
          </div>
        </div>
        <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* ============ SECURITY ============ */}
      {/* <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-xl shadow-lg text-white space-y-4">
        <h3 className="text-xl font-bold">Unlock Pro Features 🚀</h3>
        <p className="text-purple-100 text-sm">Get unlimited invoices, recurring billing, and AI follow-ups for ₹299/mo.</p>
        <button onClick={async () => {
          const orderRes = await apiFetch('/api/subscription/create-checkout', { method: 'POST' })
          const orderData = await orderRes.json()
          const rzp = new window.Razorpay({
            key: orderData.key_id, amount: orderData.amount, currency: orderData.currency, name: "FreelanceOS", description: "Pro Subscription", order_id: orderData.order_id,
            handler: async (response) => {
              await apiFetch('/api/subscription/activate', { method: 'POST', body: JSON.stringify(response) })
              alert('🎉 Upgraded to Pro!'); window.location.reload()
            }
          })
          rzp.open()
        }} className="px-6 py-2 bg-white text-purple-700 rounded-lg font-bold hover:bg-gray-100 transition">
          Upgrade to Pro - ₹299/mo
        </button>
      </div> */}
{/* ============ SUBSCRIPTION MANAGEMENT ============ */}
{subPlan === 'pro' ? (
  <div className={`p-6 rounded-xl shadow-lg text-white space-y-4 ${
    subStatus === 'canceled' 
      ? 'bg-gradient-to-r from-orange-600 to-amber-600' 
      : 'bg-gradient-to-r from-green-600 to-emerald-600'
  }`}>
    <h3 className="text-xl font-bold">
      {subStatus === 'canceled' ? 'Pro Plan Canceling ⏳' : 'Pro Plan Active ✅'}
    </h3>
    <p className="text-sm opacity-90">
      {subStatus === 'canceled' 
        ? 'Your Pro features will remain active until the end of your current billing cycle. You won\'t be charged next month.'
        : 'You have unlimited invoices, recurring billing, and AI follow-ups.'}
    </p>
    {subStatus !== 'canceled' && (
      <button 
        onClick={async () => {
          if(!window.confirm("Are you sure? Your Pro features will remain active until the end of your current billing cycle.")) return;
          const res = await apiFetch('/api/subscription/cancel', { method: 'POST' })
          if(res.ok) {
            alert('Subscription canceled. You will keep Pro access until the end of your billing cycle.');
            window.location.reload();
          }
        }} 
        className="px-6 py-2 bg-white text-orange-700 rounded-lg font-bold hover:bg-gray-100 transition"
      >
        Cancel Subscription
      </button>
    )}
  </div>
      ) : (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-xl shadow-lg text-white space-y-4">
          <h3 className="text-xl font-bold">Unlock Pro Features 🚀</h3>
          <p className="text-purple-100 text-sm">Get unlimited invoices, recurring billing, and AI follow-ups for ₹299/mo.</p>
          <button 
            onClick={async () => {
              const orderRes = await apiFetch('/api/subscription/create-checkout', { method: 'POST' })
              const orderData = await orderRes.json()
              
              const rzp = new window.Razorpay({
                key: orderData.key_id,
                name: "FreelanceOS Pro",
                description: "Monthly Subscription (₹299/mo)",
                subscription_id: orderData.subscription_id,
                handler: async (response) => {
                  // Call the NEW dedicated activation endpoint
                  const res = await apiFetch('/api/subscription/activate', { method: 'POST' })
                  
                  if (res.ok) {
                    alert('🎉 Upgraded to Pro!'); 
                    window.location.reload()
                  } else {
                    alert('Payment successful, but activation failed. Please contact support.');
                  }
                },
              })
              rzp.open()
            }} 
            className="px-6 py-2 bg-white text-purple-700 rounded-lg font-bold hover:bg-gray-100 transition"
          >
            Subscribe to Pro - ₹299/mo
          </button>
        </div>
      )}

      {/* ============ SECURITY ============ */}
      {/* <form onSubmit={changePassword} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"></form> */}
      <form onSubmit={changePassword} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">Security</h3>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
          <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength="6"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
        </div>
        <button type="submit" className="px-6 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium">
          Update Password
        </button>
      </form>
    </div>
  )
}