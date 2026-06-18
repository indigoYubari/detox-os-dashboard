"use client"
import { cx, focusRing } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { siteConfig } from "@/app/siteConfig"
import MobileSidebar from "./MobileSidebar"
import { navBottom, navSections, type NavItem } from "./navConfig"

// Nav-rad med ikon + tekst.
function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={cx(
          "flex items-center gap-x-[9px] rounded-[8px] px-[9px] py-[7px] text-[12px] transition-colors duration-150",
          active
            ? "bg-[rgba(0,212,170,0.08)] text-[#00d4aa] shadow-[inset_2px_0_0_var(--os-accent),0_0_8px_rgba(0,212,170,0.5)]"
            : "text-[#2a5a6a] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#7a9ab0]",
          focusRing,
        )}
      >
        <item.icon className="size-[15px] shrink-0" aria-hidden="true" />
        {item.name}
      </Link>
    </li>
  )
}

function Separator() {
  return (
    <div
      className="mx-2 my-1.5 h-[0.5px] bg-[rgba(255,255,255,0.04)]"
      aria-hidden="true"
    />
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      {/* sidebar (lg+) */}
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-[200px] lg:flex-col">
        <aside
          className="flex grow flex-col gap-y-2 overflow-y-auto border-r-[0.5px] border-[rgba(0,212,170,0.08)] p-3"
          style={{
            backgroundColor: "rgba(2,5,8,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <Link
            href={siteConfig.baseLinks.idag}
            aria-label="detox.OS"
            className="flex items-center gap-x-2.5 px-1 py-1"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-[var(--os-radius-sm)] text-[11px] font-semibold text-[#020508]"
              style={{
                backgroundImage: "linear-gradient(135deg, #00d4aa, #006655)",
              }}
              aria-hidden="true"
            >
              OS
            </span>
            <span className="truncate">
              <span className="block truncate text-[13px] font-medium text-[var(--os-text-primary)]">
                detox.OS
              </span>
              <span className="block truncate text-[10px] text-[var(--os-text-muted)]">
                Operator
              </span>
            </span>
          </Link>

          <nav aria-label="hovednavigasjon" className="flex flex-1 flex-col">
            {navSections.map((section, idx) => (
              <div key={section.title}>
                {idx > 0 && <Separator />}
                <ul role="list" className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavRow
                      key={item.name}
                      item={item}
                      active={isActive(item.href)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-auto">
            <Separator />
            <ul role="list" className="space-y-0.5">
              {navBottom.map((item) => (
                <NavRow
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                />
              ))}
            </ul>
            {/* Avatar */}
            <div
              className="mt-2 flex items-center gap-x-2.5 px-1 pt-3"
              style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}
            >
              <span
                className="jbm flex size-[30px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-[var(--os-accent)]"
                style={{
                  backgroundColor: "rgba(0,212,170,0.1)",
                  border: "0.5px solid rgba(0,212,170,0.25)",
                }}
                aria-hidden="true"
              >
                KA
              </span>
              <div className="truncate">
                <p className="truncate text-[11px] font-medium text-[var(--os-text-primary)]">
                  Kim
                </p>
                <p className="truncate text-[9px] text-[var(--os-text-muted)]">
                  Daglig leder
                </p>
              </div>
            </div>
          </div>
        </aside>
      </nav>

      {/* top navbar (xs-lg) */}
      <div
        className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b-[0.5px] border-[rgba(0,212,170,0.06)] px-3 lg:hidden"
        style={{
          backgroundColor: "rgba(2,5,8,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-x-2.5">
          <span
            className="flex size-7 items-center justify-center rounded-[var(--os-radius-sm)] text-[11px] font-semibold text-[#020508]"
            style={{
              backgroundImage: "linear-gradient(135deg, #00d4aa, #006655)",
            }}
            aria-hidden="true"
          >
            OS
          </span>
          <p className="text-[13px] font-medium text-[var(--os-text-primary)]">
            detox.OS
          </p>
        </div>
        <MobileSidebar />
      </div>
    </>
  )
}
