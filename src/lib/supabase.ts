import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// TODO: RLS er satt til anon full access (MVP bak Railway Basic Auth).
// Stram inn til autentiserte policies før eventuell public eksponering.
// service_role skal ALDRI brukes i frontend — kun i server-side scripts.
export const supabase = createClient(url, key)
