"use client"
import { cx, focusRing } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import MobileSidebar from "./MobileSidebar"
import { navSections } from "./navConfig"
import { UserProfileDesktop, UserProfileMobile } from "./UserProfile"

const itemClass = (active: boolean) =>
  cx(
    active
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-gray-700 hover:text-gray-900 dark:text-gray-400 hover:dark:text-gray-50",
    "flex items-center gap-x-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition hover:bg-gray-100 hover:dark:bg-gray-900",
    focusRing,
  )

const childClass = (active: boolean) =>
  cx(
    active
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 hover:dark:text-gray-50",
    "flex items-center rounded-md px-2 py-1.5 text-sm transition hover:bg-gray-100 hover:dark:bg-gray-900",
    focusRing,
  )

function Brand() {
  return (
    <div className="flex items-center gap-x-2.5 px-1 py-1">
      <span
        className="flex aspect-square size-8 items-center justify-center rounded bg-indigo-600 text-xs font-semibold text-white dark:bg-indigo-500"
        aria-hidden="true"
      >
        OS
      </span>
      <div className="truncate">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
          detox.OS
        </p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          Operator
        </p>
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      {/* sidebar (lg+) */}
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <aside className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <Brand />
          <nav
            aria-label="hovednavigasjon"
            className="flex flex-1 flex-col gap-y-8"
          >
            {navSections.map((section) => (
              <div key={section.title}>
                <span className="px-2 text-xs font-medium uppercase leading-6 tracking-wide text-gray-500 dark:text-gray-500">
                  {section.title}
                </span>
                <ul role="list" className="mt-1 space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={itemClass(isActive(item.href))}
                      >
                        <item.icon
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                      {item.children && pathname.startsWith(item.href) && (
                        <ul
                          role="list"
                          className="ml-[1.0625rem] mt-0.5 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-800"
                        >
                          {item.children.map((child) => (
                            <li key={child.name}>
                              <Link
                                href={child.href}
                                className={childClass(pathname === child.href)}
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-auto">
            <UserProfileDesktop />
          </div>
        </aside>
      </nav>
      {/* top navbar (xs-lg) */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-2 shadow-sm sm:gap-x-6 sm:px-4 lg:hidden dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-x-2.5">
          <span
            className="flex aspect-square size-7 items-center justify-center rounded bg-indigo-600 text-xs font-semibold text-white dark:bg-indigo-500"
            aria-hidden="true"
          >
            OS
          </span>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            detox.OS
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <UserProfileMobile />
          <MobileSidebar />
        </div>
      </div>
    </>
  )
}
