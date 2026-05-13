import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Manjkata NEXT_PUBLIC_SUPABASE_URL in/ali NEXT_PUBLIC_SUPABASE_ANON_KEY env spremenljivki.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
