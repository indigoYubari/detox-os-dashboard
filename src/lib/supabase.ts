import { createBrowserClient } from "@supabase/ssr"

// TODO: RLS er satt til anon full access (MVP bak Railway Basic Auth).
// Stram inn til autentiserte policies før eventuell public eksponering.
// service_role skal ALDRI brukes i frontend — kun i server-side scripts.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
