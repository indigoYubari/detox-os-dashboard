/**
 * Standard placeholder for routes that are part of the IA but not yet built.
 * Mirrors the header rhythm of the shipped Oversikt page (same h1 scale and
 * subtitle spacing) so the shell feels consistent while sections are stubbed.
 */
export function PlaceholderPage({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          {title}
        </h1>
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:ring-gray-700">
          Under utvikling
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  )
}

export default PlaceholderPage
