// frontend/src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Vite exposes env variables on the special import.meta.env object
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey,
    {
        db:{
            schema :'freelancing_demo'
        }
    }
)

