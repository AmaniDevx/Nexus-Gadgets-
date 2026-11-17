import { createBrowserClient } from '@supabase/ssr'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export { isSupabaseConfigured }

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
})
