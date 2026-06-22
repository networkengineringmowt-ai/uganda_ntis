import { createClient } from '@supabase/supabase-js'

// Supabase config comes from Vite env (.env, gitignored). ANON key only — it is
// safe for the browser bundle. The service_role key must NEVER be used here.
// Fallbacks keep the app working if .env is absent at build time.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://vbidhkvzjigatfygnyc.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWRoa3Z6amlnYXRmeWdueWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3Mzg0NDQsImV4cCI6MjA5NzMxNDQ0NH0.4M5lsUvcoh2giNpbF5X7nMPepNVp1U9Em6Ro4aZwgY4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const SUPABASE_PROJECT_URL = SUPABASE_URL
