// Content state for /innhold. Modellerer den content-workflowen som FAKTISK
// finnes i detox-vault (brief -> draft -> claim-check -> voice/channel), ikke
// en publiseringskalender vi ikke har enda. Se supabase/migrations/0007.

export const CONTENT_STAGES = [
  "brief",
  "draft",
  "claim_check",
  "voice_channel",
] as const
export type ContentStage = (typeof CONTENT_STAGES)[number]

export const CONTENT_STAGE_STATUSES = [
  "pending",
  "complete",
  "blocked",
  "needs_research",
] as const
export type ContentStageStatus = (typeof CONTENT_STAGE_STATUSES)[number]

export type ContentItem = {
  id: string
  title: string
  topic: string | null
  stage: ContentStage
  stage_status: ContentStageStatus
  channels: string[]
  requested_by: string | null
  source_repo: string
  source_path: string
  data_mode: string
  created_at: string
  updated_at: string
  synced_at: string | null
}

export const STAGE_LABELS: Record<ContentStage, string> = {
  brief: "Brief",
  draft: "Draft",
  claim_check: "Claim-check",
  voice_channel: "Voice / kanal",
}

export const STAGE_DOT: Record<ContentStage, string> = {
  brief: "bg-indigo-500",
  draft: "bg-amber-500",
  claim_check: "bg-pink-500",
  voice_channel: "bg-green-500",
}

export const STAGE_STATUS_LABELS: Record<ContentStageStatus, string> = {
  pending: "under arbeid",
  complete: "ferdig",
  blocked: "blokkert",
  needs_research: "trenger research",
}

export const STAGE_STATUS_STYLE: Record<ContentStageStatus, string> = {
  complete: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  pending:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  needs_research:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
}

// Ferskhet utledes av synced_at, ikke av at noen muterer data_mode paa alle
// rader naar syncen ikke har kjort (Adrian 2026-08-23).
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export type Freshness = {
  mode: "live" | "stale" | "unknown"
  ageMs: number | null
}

export function freshnessOf(
  syncedAt: string | null,
  now: number = Date.now(),
): Freshness {
  if (!syncedAt) return { mode: "unknown", ageMs: null }
  const ts = Date.parse(syncedAt)
  if (Number.isNaN(ts)) return { mode: "unknown", ageMs: null }
  const ageMs = now - ts
  return { mode: ageMs > STALE_AFTER_MS ? "stale" : "live", ageMs }
}

/** Nyeste synced_at i settet — brukes til provenance-linja over tabellen. */
export function latestSyncedAt(items: readonly ContentItem[]): string | null {
  let best: string | null = null
  for (const item of items) {
    if (!item.synced_at) continue
    if (best === null || Date.parse(item.synced_at) > Date.parse(best))
      best = item.synced_at
  }
  return best
}

export function countByStage(
  items: readonly ContentItem[],
): Record<ContentStage, number> {
  const counts = { brief: 0, draft: 0, claim_check: 0, voice_channel: 0 }
  for (const item of items) {
    if (item.stage in counts) counts[item.stage] += 1
  }
  return counts
}

export type ContentQueryResult =
  | { ok: true; items: ContentItem[] }
  | { ok: false; error: string }
