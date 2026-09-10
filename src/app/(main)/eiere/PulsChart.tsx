import React from "react"

import { kr, num } from "@/components/i-dag/format"
import {
  linePath,
  scaleBars,
  shortDate,
  type Puls,
  type PulsPoint,
} from "@/lib/eiere"

// Grafene i PULS. Ren SVG fra serveren — ingen chart-bibliotek, ingen
// klient-JS, ingen tall som ikke kommer fra Anakins puls i basen.
//  1. Uke mot uke: forrige uke (daempet) mot siste 7 dager (accent), for
//     ordrer og omsetning.
//  2. Trend: én puls per radar-dag, naar minst to dager kan tolkes.

const W = 220
const H = 64
const BAR_H = 40

function WeekBars({
  label,
  prev,
  cur,
  fmt,
}: {
  label: string
  prev: number
  cur: number
  fmt: (n: number) => string
}) {
  const [hPrev, hCur] = scaleBars([prev, cur], BAR_H)
  const down = cur < prev
  const curFill = down ? "var(--os-danger)" : "var(--os-accent)"
  return (
    <svg
      viewBox="0 0 120 64"
      className="h-16 w-[120px]"
      role="img"
      aria-label={`${label}: forrige uke ${fmt(prev)}, siste 7 dager ${fmt(cur)}`}
    >
      <title>{`${label} — forrige uke ${fmt(prev)} · siste 7 dager ${fmt(cur)}`}</title>
      <rect
        x="14"
        y={4 + BAR_H - hPrev}
        width="36"
        height={hPrev}
        rx="2"
        fill="var(--os-text-muted)"
        opacity="0.55"
      />
      <rect
        x="70"
        y={4 + BAR_H - hCur}
        width="36"
        height={hCur}
        rx="2"
        fill={curFill}
      />
      <line
        x1="8"
        x2="112"
        y1={4 + BAR_H + 0.5}
        y2={4 + BAR_H + 0.5}
        stroke="var(--os-border)"
      />
      <text
        x="32"
        y="60"
        textAnchor="middle"
        fontSize="8"
        fill="var(--os-text-muted)"
        className="jbm"
      >
        forrige
      </text>
      <text
        x="88"
        y="60"
        textAnchor="middle"
        fontSize="8"
        fill={curFill}
        className="jbm"
      >
        siste 7 d
      </text>
    </svg>
  )
}

function Trend({
  label,
  points,
  values,
  fmt,
}: {
  label: string
  points: PulsPoint[]
  values: number[]
  fmt: (n: number) => string
}) {
  const path = linePath(values, W, H, 6)
  if (!path) return null
  const first = points[0]
  const last = points[points.length - 1]
  const [lx, ly] = path.coords[path.coords.length - 1]
  return (
    <div className="min-w-0">
      <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
        {label} · siste 7 dager per radar-dag
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-16 w-full max-w-[220px]"
        role="img"
        aria-label={`${label}: ${points.map((p) => `${shortDate(p.period)} ${fmt(values[points.indexOf(p)])}`).join(", ")}`}
      >
        <title>
          {points
            .map((p, i) => `${shortDate(p.period)}: ${fmt(values[i])}`)
            .join(" · ")}
        </title>
        <path
          d={path.d}
          fill="none"
          stroke="var(--os-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {path.coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill="var(--os-accent)">
            <title>{`${shortDate(points[i].period)}: ${fmt(values[i])}`}</title>
          </circle>
        ))}
        <circle
          cx={lx}
          cy={ly}
          r="3.5"
          fill="none"
          stroke="var(--os-accent)"
          opacity="0.5"
        />
      </svg>
      <div className="jbm mt-0.5 flex justify-between text-[9px] text-[var(--os-text-muted)]">
        <span>
          {shortDate(first.period)} · {fmt(values[0])}
        </span>
        <span>
          {shortDate(last.period)} · {fmt(values[values.length - 1])}
        </span>
      </div>
      <p className="jbm text-[9px] text-[var(--os-text-muted)]">
        laveste {fmt(path.min)} · høyeste {fmt(path.max)} · {points.length}{" "}
        radar-dager
      </p>
    </div>
  )
}

export function PulsChart({
  puls,
  history,
}: {
  puls: Puls
  history: PulsPoint[]
}) {
  const hasTrend = history.length >= 2
  return (
    <div className="mt-4 grid gap-5 md:grid-cols-[auto_1fr]">
      <div className="flex gap-4">
        <div>
          <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
            Ordrer · uke mot uke
          </p>
          <WeekBars
            label="Ordrer"
            prev={puls.ordersPrev}
            cur={puls.orders7d}
            fmt={num}
          />
        </div>
        <div>
          <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
            Omsetning · uke mot uke
          </p>
          <WeekBars
            label="Omsetning"
            prev={puls.revenuePrev}
            cur={puls.revenue7d}
            fmt={kr}
          />
        </div>
      </div>
      {hasTrend ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Trend
            label="Omsetning"
            points={history}
            values={history.map((p) => p.puls.revenue7d)}
            fmt={kr}
          />
          <Trend
            label="Ordrer"
            points={history}
            values={history.map((p) => p.puls.orders7d)}
            fmt={num}
          />
        </div>
      ) : (
        <p className="jbm self-end text-[10px] text-[var(--os-text-muted)]">
          Trend kommer når minst to radar-dager har en puls som kan tolkes (nå:{" "}
          {history.length}).
        </p>
      )}
    </div>
  )
}
