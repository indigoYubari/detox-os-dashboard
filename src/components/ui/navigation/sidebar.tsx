"use client"
import { cx, focusRing } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { siteConfig } from "@/app/siteConfig"
import MobileSidebar from "./MobileSidebar"
import { navBottom, navSections, type NavItem } from "./navConfig"

const AI_HREF = siteConfig.baseLinks.aiVerktoy

// Ikon-only nav-knapp, 38x38, med tooltip ved hover.
function IconLink({ item, active }: { item: NavItem; active: boolean }) {
  const isAi = item.href === AI_HREF
  return (
    <li className="group relative flex justify-center">
      <Link
        href={item.href}
        aria-label={item.name}
        className={cx(
          "flex size-[38px] items-center justify-center rounded-[9px] transition-colors duration-150",
          active
            ? "bg-[var(--os-accent-dim)] text-[var(--os-accent)] shadow-[inset_-2px_0_0_var(--os-accent),0_0_12px_rgba(0,212,170,0.5)]"
            : isAi
              ? "bg-[var(--os-purple-dim)] text-[var(--os-purple)] hover:bg-[rgba(99,102,241,0.18)]"
              : "text-[#2a5a6a] hover:bg-[rgba(0,212,170,0.04)] hover:text-[#4a8a9a]",
          focusRing,
        )}
      >
        <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
      </Link>
      {/* Tooltip */}
      <span className="jbm pointer-events-none absolute left-[60px] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-bg-surface)] px-2 py-1 text-[11px] text-[var(--os-text-secondary)] opacity-0 shadow-lg backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100">
        {item.name}
      </span>
    </li>
  )
}

function Separator() {
  return (
    <div className="my-2 flex justify-center" aria-hidden="true">
      <span className="h-[0.5px] w-6 bg-[rgba(255,255,255,0.04)]" />
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
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-[56px] lg:flex-col">
        <aside
          className="flex grow flex-col items-center gap-y-1 overflow-y-auto border-r-[0.5px] border-[rgba(0,212,170,0.08)] py-3"
          style={{
            backgroundColor: "rgba(2,5,8,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Logo med glow */}
          <Link
            href={siteConfig.baseLinks.idag}
            aria-label="detox.OS"
            className="logo-glow mb-2 flex size-8 items-center justify-center rounded-[var(--os-radius-sm)] text-[11px] font-semibold text-[#020508]"
            style={{
              backgroundImage: "linear-gradient(135deg, #00d4aa, #006655)",
            }}
          >
            OS
          </Link>

          <nav
            aria-label="hovednavigasjon"
            className="flex flex-1 flex-col items-center"
          >
            {navSections.map((section, idx) => (
              <div key={section.title} className="flex flex-col items-center">
                {idx > 0 && <Separator />}
                <ul role="list" className="flex flex-col items-center gap-y-1">
                  {section.items.map((item) => (
                    <IconLink
                      key={item.name}
                      item={item}
                      active={isActive(item.href)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-auto flex flex-col items-center gap-y-1">
            <Separator />
            <ul role="list" className="flex flex-col items-center gap-y-1">
              {navBottom.map((item) => (
                <IconLink
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                />
              ))}
            </ul>
            {/* Avatar KA */}
            <span
              className="jbm mt-2 flex size-[30px] items-center justify-center rounded-full text-[10px] font-medium text-[var(--os-accent)]"
              style={{
                backgroundColor: "rgba(0,212,170,0.1)",
                border: "0.5px solid rgba(0,212,170,0.25)",
              }}
              aria-label="Kim Andre"
            >
              KA
            </span>
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
