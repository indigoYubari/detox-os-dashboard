// Server-side lesing av content_items. Ligger adskilt fra `content.ts` fordi
// den modulen ogsaa brukes av ContentTable ("use client") — `next/headers` kan
// ikke naa klientbundelen. Typer og presentasjon: content.ts. Databasen: her.

import { createSupabaseServerClient } from "./auth-server"

import type { ContentItem, ContentQueryResult } from "./content"

/**
 * Leser content_items med brukerens egen session. RLS gjelder: anonyme kall og
 * brukere uten lesetilgang faar ingenting. service_role brukes aldri.
 */
export async function fetchContentItems(): Promise<ContentQueryResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("content_items")
    .select(
      "id, title, topic, stage, stage_status, channels, requested_by, source_repo, source_path, data_mode, created_at, updated_at, synced_at",
    )
    .order("updated_at", { ascending: false })

  if (error) return { ok: false, error: error.message }
  return { ok: true, items: (data ?? []) as ContentItem[] }
}
