"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { navBottom, navSections } from "./navConfig"

/** Finn et lesbart navn for aktiv sti fra nav-konfigurasjonen. */
function activeLabel(pathname: string): string {
  const items = [...navSections.flatMap((s) => s.items), ...navBottom]
  for (const item of items) {
    for (const child of item.children ?? []) {
      if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
        return `${item.name} / ${child.name}`
      }
    }
  }
  let best: { name: string; len: number } | null = null
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.len) {
        best = { name: item.name, len: item.href.length }
      }
    }
  }
  return best?.name ?? "Hjem"
}

function useClock(): string {
  const [time, setTime] = useState("")
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      setTime(
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export function Topbar() {
  const pathname = usePathname()
  const label = activeLabel(pathname)
  const clock = useClock()

  return (
    <header
      className="sticky top-0 z-30 hidden h-11 items-center justify-between border-b-[0.5px] border-[rgba(0,212,170,0.06)] px-5 lg:flex"
      style={{
        backgroundColor: "rgba(2,5,8,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <nav
        aria-label="brodsmuler"
        className="jbm flex items-center gap-x-1.5 text-[11px]"
      >
        <span className="text-[var(--os-text-muted)]">detox.OS</span>
        <span className="text-[var(--os-text-muted)]">/</span>
        <span className="text-[var(--os-accent)]">{label}</span>
      </nav>

      <div className="flex items-center gap-x-4">
        {/* Live klokke */}
        <span className="jbm text-[11px] tabular-nums text-[#1a3a4a]">
          {clock}
        </span>
        {/* Live-badge */}
        <div className="flex items-center gap-x-1.5 rounded-full border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-2.5 py-1">
          <span
            className="animate-blink size-1.5 rounded-full bg-[var(--os-accent)]"
            style={{ boxShadow: "0 0 6px var(--os-accent-glow)" }}
            aria-hidden="true"
          />
          <span className="jbm text-[10px] font-medium text-[var(--os-accent)]">
            Railway live
          </span>
        </div>
      </div>
    </header>
  )
}
