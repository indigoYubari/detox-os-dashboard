"use client"

import { useEffect, useState } from "react"
import { cx } from "@/lib/utils"

/** Seksjon som fader opp ved innlasting. delay i ms gir staggered effekt. */
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div
      className={cx("fade-up", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/**
 * Sparkline med 7 stolper som bygger seg opp, 80 ms forsinkelse per stolpe.
 * values er normaliserte høyder mellom 0 og 1.
 */
export function Sparkline({
  values,
  color = "var(--os-accent)",
}: {
  values: number[]
  color?: string
}) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    const timers = values.map((_, i) =>
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), i * 80),
    )
    return () => timers.forEach(clearTimeout)
  }, [values])

  return (
    <div className="flex h-8 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className="w-full rounded-[2px]"
          style={{
            height: i < revealed ? `${Math.max(8, v * 100)}%` : "0%",
            backgroundColor: color,
            opacity: 0.55 + v * 0.45,
            transition: "height 0.4s ease-out",
          }}
        />
      ))}
    </div>
  )
}

const DOT_COLOR: Record<string, string> = {
  info: "var(--os-accent)",
  warning: "var(--os-warning)",
  system: "var(--os-purple)",
}

/** Liten fargekodet prikk for varsler. teal=info, amber=warning, purple=system. */
export function StatusDot({ kind }: { kind: "info" | "warning" | "system" }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: DOT_COLOR[kind] }}
      aria-hidden="true"
    />
  )
}
