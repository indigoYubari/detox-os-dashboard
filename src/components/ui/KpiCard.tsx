"use client"
import { useEffect, useState } from "react"
import { cx } from "@/lib/utils"
import { StatTooltip } from "@/components/ui/StatTooltip"

type KpiCardProps = {
  label: string
  value: string | number
  delta?: string
  /** Valgfri forklaring som vises i tooltip ved hover paa label. */
  tooltip?: string
  /** Retning styrer fargen. Utledes fra delta hvis ikke satt. */
  trend?: "up" | "down"
  /** Maal-bredde paa bunn-progressbaren, f.eks. "72%". */
  width?: string
  /** Gradient for bunnlinjen. Default teal til transparent. */
  barGradient?: string
  className?: string
}

const DEFAULT_BAR = "linear-gradient(90deg, var(--os-accent), transparent)"

/**
 * Hi-tech KPI-kort. Tynn gradient-linje oeverst, animert progressbar nederst.
 * Mono label og delta, stor Inter-verdi. Gloed paa hover.
 */
export function KpiCard({
  label,
  value,
  delta,
  tooltip,
  trend,
  width = "0%",
  barGradient = DEFAULT_BAR,
  className,
}: KpiCardProps) {
  const direction = trend ?? (delta?.trim().startsWith("-") ? "down" : "up")
  const deltaColor =
    direction === "down" ? "text-[var(--os-danger)]" : "text-[var(--os-accent)]"

  const [barWidth, setBarWidth] = useState("0%")
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarWidth(width))
    return () => cancelAnimationFrame(id)
  }, [width])

  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-[var(--os-radius-md)] px-3 py-2.5 transition-colors duration-150 hover:border-[rgba(0,212,170,0.2)] hover:bg-[rgba(0,212,170,0.06)]",
        className,
      )}
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        boxShadow: "inset 0 0 20px rgba(0,212,170,0.04)",
      }}
    >
      {/* Topplinje */}
      <span
        className="absolute inset-x-0 top-0 h-px opacity-100"
        style={{
          background:
            "linear-gradient(90deg, transparent, #00d4aa, transparent)",
        }}
        aria-hidden="true"
      />
      <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
        {tooltip ? (
          <StatTooltip explanation={tooltip}>{label}</StatTooltip>
        ) : (
          label
        )}
      </p>
      <p
        className="mt-1 text-[22px] font-medium leading-tight text-[var(--os-text-primary)]"
        style={{ letterSpacing: "-0.6px" }}
      >
        {value}
      </p>
      {delta && (
        <p className={cx("jbm mt-0.5 text-[10px]", deltaColor)}>{delta}</p>
      )}
      {/* Bunn-progressbar */}
      <span
        className="absolute bottom-0 left-0 h-0.5"
        style={{
          width: barWidth,
          background: barGradient,
          transition: "width 1.5s ease-out",
        }}
        aria-hidden="true"
      />
    </div>
  )
}

export default KpiCard
