import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

interface ShortcutCardProps {
  name: string
  description: string
  href: string
  icon: LucideIcon
}

/** Pure navigation. A quiet hand-off into a deep section. */
export function ShortcutCard({
  name,
  description,
  href,
  icon: Icon,
}: ShortcutCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/40"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors group-hover:bg-white dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-gray-900">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {name}
          </p>
          <ArrowRight
            className="size-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
            aria-hidden="true"
          />
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
    </Link>
  )
}
