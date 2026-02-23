import { createBrowserClient, createServerClient as createSsrServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ------------------------------------------------------------
// Browser / client-side client
// Use in Client Components ('use client')
// ------------------------------------------------------------
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// ------------------------------------------------------------
// Server-side client (uses user session via cookies)
// Use in Server Components, Route Handlers, Server Actions
// Respects Row Level Security — acts as the logged-in user
// ------------------------------------------------------------
export function createServerClient() {
  const cookieStore = cookies()

  return createSsrServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Cannot set cookies in Server Components — ignore
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Cannot remove cookies in Server Components — ignore
        }
      },
    },
  })
}

// ------------------------------------------------------------
// Service-role client — BYPASSES Row Level Security
// ONLY use in server-side admin operations or trusted webhooks
// NEVER expose to the client
// ------------------------------------------------------------
export function createServiceClient() {
  return createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
