import { createClient } from '@supabase/supabase-js'

let envUrl = import.meta.env.VITE_SUPABASE_URL || '/supabase'
if (!envUrl.startsWith('http')) {
  // Supabase client requires absolute URL
  envUrl = `${window.location.origin}${envUrl.startsWith('/') ? '' : '/'}${envUrl}`
}

const supabaseUrl = envUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
