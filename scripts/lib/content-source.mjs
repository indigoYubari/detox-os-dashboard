// Leser den ekte content-workflowen i detox-vault og oversetter den til rader
// for `content_items`. Ren funksjon av filsystemet — ingen nettverk, ingen
// Supabase — slik at parsingen kan testes uten database.
//
// Kilden er `workflows/content/stages/<NN-navn>/output/*.md`. Workflowens egen
// state-modell (workflows/content/CLAUDE.md) er: "Skann stages/*/output/. Filer
// utover .gitkeep = COMPLETE". Denne modulen er den samme regelen, gjort
// eksplisitt og persisterbar.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

export const STAGE_BY_DIR = {
  "01-brief": "brief",
  "02-draft": "draft",
  "03-claim-check": "claim_check",
  "04-voice-channel": "voice_channel",
}

// Vaultens norske frontmatter-status -> vaar stage_status. Ukjent status blir
// 'pending' framfor aa gjette modenhet vi ikke har belegg for.
const STATUS_MAP = {
  "klar-til-utkast": "complete",
  "klar-til-claim-check": "complete",
  "klar-til-kanal": "complete",
  ferdig: "complete",
  godkjent: "complete",
  "trenger-research": "needs_research",
  needs_research: "needs_research",
  blokkert: "blocked",
  "under-arbeid": "pending",
  utkast: "pending",
}

/**
 * Parser YAML-frontmatter grunt (skalarer + inline-lister). Ingen yaml-avhengighet.
 * @param {string} raw
 * @returns {Record<string, string | string[]>}
 */
export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
  /** @type {Record<string, string | string[]>} */
  const out = {}
  if (!match) return out
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-zÆØÅæøå0-9_-]+):\s*(.*)$/.exec(line)
    if (!kv) continue
    const key = kv[1]
    const value = kv[2].trim()
    if (value.startsWith("[") && value.endsWith("]")) {
      out[key] = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    } else {
      out[key] = value.replace(/^["']|["']$/g, "")
    }
  }
  return out
}

/** Forste avsnitt under en gitt mellomtittel, eller null. */
export function sectionParagraph(raw, heading) {
  const re = new RegExp(`^##+\\s+${heading}\\s*$`, "im")
  const m = re.exec(raw)
  if (!m) return null
  const rest = raw.slice(m.index + m[0].length)
  for (const block of rest.split(/\r?\n\r?\n/)) {
    const text = block.trim()
    if (text && !text.startsWith("#")) return text.replace(/\s+/g, " ")
  }
  return null
}

export function humaniseFilename(filename) {
  const base = filename.replace(/\.md$/i, "").replace(/[-_]+/g, " ")
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export function stageStatusFrom(frontmatterStatus) {
  if (!frontmatterStatus) return "pending"
  return STATUS_MAP[frontmatterStatus.toLowerCase()] ?? "pending"
}

/** Oversetter én markdown-fil til en content_items-rad. */
export function toContentItem({ raw, stage, sourcePath, sourceRepo = "detox-vault", filename }) {
  const fm = parseFrontmatter(raw)
  const title = sectionParagraph(raw, "Temasetning") ?? humaniseFilename(filename)
  const channels = Array.isArray(fm.kanaler)
    ? fm.kanaler
    : typeof fm.kanaler === "string" && fm.kanaler
      ? [fm.kanaler]
      : []

  return {
    title,
    topic: typeof fm.tema === "string" && fm.tema ? fm.tema : null,
    stage,
    stage_status: stageStatusFrom(typeof fm.status === "string" ? fm.status : null),
    channels,
    requested_by: typeof fm["bestilt-av"] === "string" ? fm["bestilt-av"] : null,
    source_repo: sourceRepo,
    source_path: sourcePath,
    data_mode: "live",
  }
}

/**
 * Skanner vaultens content-workflow og returnerer én rad per outputfil.
 * `.gitkeep` og ikke-markdown ignoreres — det er nettopp det som skiller en
 * tom stage fra en fullfort en i workflowens egen definisjon.
 */
export function collectContentItems(vaultRoot) {
  const stagesRoot = join(vaultRoot, "workflows", "content", "stages")
  const items = []

  for (const [dir, stage] of Object.entries(STAGE_BY_DIR)) {
    const outputDir = join(stagesRoot, dir, "output")
    let entries
    try {
      entries = readdirSync(outputDir)
    } catch {
      continue // stagen finnes ikke i denne vault-versjonen
    }
    for (const filename of entries.sort()) {
      if (!filename.toLowerCase().endsWith(".md")) continue
      const full = join(outputDir, filename)
      if (!statSync(full).isFile()) continue
      items.push(
        toContentItem({
          raw: readFileSync(full, "utf8"),
          stage,
          sourcePath: relative(vaultRoot, full).split("\\").join("/"),
          filename,
        }),
      )
    }
  }

  return items
}
