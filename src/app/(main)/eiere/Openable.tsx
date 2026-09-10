import React from "react"

// «Trykk for aa aapne»: overskriften staar alltid, resten ligger bak en
// Åpne-knapp. Bygget paa <details>, saa det virker uten klient-JS og rendres
// ferdig fra serveren. Tailwinds group-open bytter knappeteksten.

const SUMMARY_BTN =
  "inline-flex shrink-0 cursor-pointer select-none items-center rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-2 py-0.5 text-[10px] text-[var(--os-text-secondary)] transition-colors hover:bg-[var(--os-bg-hover)] hover:text-[var(--os-text-primary)] [&::-webkit-details-marker]:hidden"

export function Openable({
  headline,
  children,
  open,
  label = "Åpne",
  closeLabel = "Lukk",
  className,
}: {
  /** Det som alltid er synlig — én linje, gjerne line-clamp. */
  headline: React.ReactNode
  /** Det som kommer fram naar eieren trykker. */
  children: React.ReactNode
  open?: boolean
  label?: string
  closeLabel?: string
  className?: string
}) {
  return (
    <details className={`group ${className ?? ""}`} open={open}>
      <summary className="flex list-none items-start justify-between gap-3">
        <span className="min-w-0 flex-1">{headline}</span>
        <span className={SUMMARY_BTN} aria-hidden="true">
          <span className="group-open:hidden">{label}</span>
          <span className="hidden group-open:inline">{closeLabel}</span>
        </span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

/** Sporbarhetslinja: alltid med, men kollapset bak «Vis metadata». */
export function Provenance({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="jbm inline-flex cursor-pointer list-none items-center gap-1 text-[10px] text-[var(--os-text-muted)] hover:text-[var(--os-text-secondary)] [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Vis metadata</span>
        <span className="hidden group-open:inline">Skjul metadata</span>
      </summary>
      <p className="jbm mt-1 text-[10px] leading-relaxed text-[var(--os-text-muted)]">
        {children}
      </p>
    </details>
  )
}
