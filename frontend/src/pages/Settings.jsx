// frontend/src/pages/Settings.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { apiFetch } from '../api'

export default function Settings() {
  const [orgName, setOrgName] = useState('')
  const [gstin, setGstin] = useState('')
  const [prefix, setPrefix] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    const res = await apiFetch('/api/settings')
    const data = await res.json()
    if (data.profile) {
      setOrgName(data.profile.organization_name || '')
      setGstin(data.profile.gstin || '')
      setPrefix(data.profile.invoice_prefix || '')
      setLogoUrl(data.profile.logo_url || '')
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
      body: JSON.stringify({ organization_name: orgName, gstin, invoice_prefix: prefix, logo_url: logoUrl })
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
      setOldPass(''); setNewPass('')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Settings</h2>

      {/* Profile & Invoice Settings */}
      <form onSubmit={saveSettings} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Business Profile & Invoicing</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg" placeholder="e.g. Sharath Designs" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN / Tax ID</label>
            <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg" placeholder="e.g. 22AAAAA0000A1Z5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix (Optional)</label>
            <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Leave blank to use Org Name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            {logoUrl && <img src={logoUrl} alt="Logo" className="mt-2 h-16 object-contain" />}
          </div>
        </div>
        <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={changePassword} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Security</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength="6"
              className="w-full p-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
        <button type="submit" className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-medium">
          Update Password
        </button>
      </form>
    </div>
  )
}