import { cx } from "@/lib/utils"

type OsCardProps = {
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Standardkort for detox.OS. Mørk overflate, mono-tittel med blinkende
 * teal-prikk. Brukes som byggekloss på alle sider i stedet for rå Tremor-Card.
 */
export function OsCard({ title, children, className }: OsCardProps) {
  return (
    <div
      className={cx(
        "rounded-[var(--os-radius-lg)] border-[0.5px] border-[var(--os-border)] bg-[var(--os-bg-card)] px-4 py-[14px]",
        className,
      )}
    >
      {title && (
        <div className="mb-3 flex items-center gap-x-1.5">
          <span
            className="animate-blink size-1.5 rounded-full bg-[var(--os-accent)]"
            style={{ boxShadow: "0 0 6px var(--os-accent-glow)" }}
            aria-hidden="true"
          />
          <h3 className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Rad i et OsCard. Tekst lysner og pil dukker opp ved hover.
 */
export function OsCardRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        "group flex items-center justify-between rounded-[var(--os-radius-sm)] px-2 py-2 text-[var(--os-text-secondary)] transition-colors duration-150 hover:bg-[var(--os-bg-hover)] hover:text-[var(--os-text-primary)]",
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span
        className="ml-2 shrink-0 text-[var(--os-accent)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        aria-hidden="true"
      >
        →
      </span>
    </div>
  )
}

export default OsCard
