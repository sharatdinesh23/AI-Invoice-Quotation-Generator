// frontend/src/api.js
import { supabase } from './supabaseClient'

// This helper automatically attaches the user's token to every request to our FastAPI backend
export const apiFetch = async (endpoint, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
    ...options.headers,
  }

  const response = await fetch(`http://localhost:8000${endpoint}`, {
    ...options,
    headers,
  })
  
  return response
}