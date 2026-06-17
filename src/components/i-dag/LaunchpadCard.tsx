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

const cardClasses =
  "group flex h-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors dark:border-gray-800 dark:bg-gray-900"
const interactiveClasses =
  "hover:border-gray-300 hover:bg-gray-50/60 dark:hover:border-gray-700 dark:hover:bg-gray-800/40"

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
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors group-hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-900">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
            {name}
          </p>
          {href && (
            <ArrowUpRight
              className="size-4 shrink-0 text-gray-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
              aria-hidden="true"
            />
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
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
