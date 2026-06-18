import { ArrowUpRight, type LucideIcon } from "lucide-react"

interface LaunchpadCardProps {
  name: string
  note: string
  href?: string
  icon?: LucideIcon
}

// External http(s) links open in a new tab. App-protocol links such as
// obsidian:// must stay in the same tab so the OS handler launches the app
// instead of leaving an empty browser tab behind. Cards without an href are
// rendered as static, non-clickable tiles.
function isHttpLink(href?: string): boolean {
  return !!href && /^https?:\/\//i.test(href)
}

// Ikon-boksen fargekodes per flate: Claude teal, Claude Code lilla, resten noytral.
function iconBoxStyle(name: string): React.CSSProperties {
  if (name === "Claude") {
    return { backgroundColor: "rgba(0,212,170,0.1)", color: "#00d4aa" }
  }
  if (name === "Claude Code") {
    return { backgroundColor: "rgba(99,102,241,0.1)", color: "#6366f1" }
  }
  return { backgroundColor: "rgba(255,255,255,0.04)", color: "#2a5a6a" }
}

const cardClasses =
  "group flex h-full items-start gap-3 rounded-[12px] border-[0.5px] border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 backdrop-blur-md transition-colors duration-150 ease-out"
const interactiveClasses =
  "hover:border-[rgba(0,212,170,0.2)] hover:bg-[rgba(0,212,170,0.02)]"

/** A single launchpad tile: name, short note, and a hand-off into the tool. */
export function LaunchpadCard({
  name,
  note,
  href,
  icon: Icon,
}: LaunchpadCardProps) {
  const body = (
    <>
      {Icon && (
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px]"
          style={iconBoxStyle(name)}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-[#c0d4e0]">
            {name}
          </p>
          {href && (
            <ArrowUpRight
              className="size-4 shrink-0 text-[#00d4aa] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              aria-hidden="true"
            />
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#2a5a6a]">
          {note}
        </p>
      </div>
    </>
  )

  if (!href) {
    return <div className={cardClasses}>{body}</div>
  }

  if (isHttpLink(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cardClasses} ${interactiveClasses}`}
      >
        {body}
      </a>
    )
  }

  // App-protocol link (e.g. obsidian://), same tab, lets the OS handler open.
  return (
    <a href={href} className={`${cardClasses} ${interactiveClasses}`}>
      {body}
    </a>
  )
}
