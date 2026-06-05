import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/Drawer"
import { cx, focusRing } from "@/lib/utils"
import { RiMenuLine } from "@remixicon/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { navSections } from "./navConfig"

const itemClass = (active: boolean) =>
  cx(
    active
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 hover:dark:text-gray-50",
    "flex items-center gap-x-2.5 rounded-md px-2 py-1.5 text-base font-medium transition hover:bg-gray-100 sm:text-sm hover:dark:bg-gray-900",
    focusRing,
  )

const childClass = (active: boolean) =>
  cx(
    active
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 hover:dark:text-gray-50",
    "flex items-center rounded-md px-2 py-1.5 text-base transition hover:bg-gray-100 sm:text-sm hover:dark:bg-gray-900",
    focusRing,
  )

export default function MobileSidebar() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            aria-label="open sidebar"
            className="group flex items-center rounded-md p-2 text-sm font-medium hover:bg-gray-100 data-[state=open]:bg-gray-100 data-[state=open]:bg-gray-400/10 hover:dark:bg-gray-400/10"
          >
            <RiMenuLine
              className="size-6 shrink-0 sm:size-5"
              aria-hidden="true"
            />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>detox.OS</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <nav
              aria-label="mobil hovednavigasjon"
              className="flex flex-1 flex-col gap-y-8"
            >
              {navSections.map((section) => (
                <div key={section.title}>
                  <span className="px-2 text-sm font-medium uppercase leading-6 tracking-wide text-gray-500 sm:text-xs">
                    {section.title}
                  </span>
                  <ul role="list" className="mt-1 space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item.name}>
                        <DrawerClose asChild>
                          <Link
                            href={item.href}
                            className={itemClass(isActive(item.href))}
                          >
                            <item.icon
                              className="size-5 shrink-0"
                              aria-hidden="true"
                            />
                            {item.name}
                          </Link>
                        </DrawerClose>
                        {item.children && pathname.startsWith(item.href) && (
                          <ul
                            role="list"
                            className="ml-[1.375rem] mt-1 space-y-1 border-l border-gray-200 pl-3 dark:border-gray-800"
                          >
                            {item.children.map((child) => (
                              <li key={child.name}>
                                <DrawerClose asChild>
                                  <Link
                                    href={child.href}
                                    className={childClass(
                                      pathname === child.href,
                                    )}
                                  >
                                    {child.name}
                                  </Link>
                                </DrawerClose>
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
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
