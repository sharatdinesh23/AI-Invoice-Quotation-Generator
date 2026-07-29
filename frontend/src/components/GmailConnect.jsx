import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function GmailConnect() {
  const [connected, setConnected] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkGmailStatus()
  }, [])

  const checkGmailStatus = async () => {
    try {
      const res = await apiFetch('/api/auth/google/status')
      const data = await res.json()
      setConnected(data.connected)
      setEmail(data.email || '')
    } catch (err) {
      console.error("Failed to check Gmail status:", err)
    }
  }

  const connectGmail = () => {
    setLoading(true)
    apiFetch('/api/auth/google')
      .then(res => res.json())
      .then(data => {
        const popup = window.open(data.authorization_url, 'google_oauth', 'width=600,height=700,left=200,top=200')
        
        const handleMessage = (event) => {
          if (event.data && event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage)
            setLoading(false)
            checkGmailStatus() // Refresh the UI to show "Connected"
          }
        }
        
        window.addEventListener('message', handleMessage)
        
        // Fallback: if user closes the popup manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', handleMessage)
            setLoading(false)
            checkGmailStatus()
          }
        }, 1000)
      })
      .catch(err => {
        console.error("OAuth start failed:", err)
        setLoading(false)
        alert("Failed to start Gmail connection.")
      })
  }

  const disconnectGmail = async () => {
    if (window.confirm('Are you sure you want to disconnect your Gmail account?')) {
      try {
        await apiFetch('/api/auth/google/disconnect', { method: 'DELETE' })
        setConnected(false)
        setEmail('')
      } catch (err) {
        console.error("Disconnect failed:", err)
        alert("Failed to disconnect Gmail.")
      }
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Gmail Integration</h3>
      
      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-xl">✓</span>
            <span className="font-medium">Connected as {email}</span>
          </div>
          <button
            onClick={disconnectGmail}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm transition"
          >
            Disconnect Gmail
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm">
            Connect your Gmail account to send invoices directly to your clients from your own email address.
          </p>
          <button
            onClick={connectGmail}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:bg-gray-400 transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⟳</span> Connecting...
              </>
            ) : (
              'Connect Gmail Account'
            )}
          </button>
        </div>
      )}
    </div>
  )
}