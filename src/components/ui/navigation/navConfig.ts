import {
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  Receipt,
  Settings,
  Sparkles,
  Store,
} from "lucide-react"

import { siteConfig } from "@/app/siteConfig"

export type NavChild = { name: string; href: string }
export type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  children?: NavChild[]
}
export type NavSection = { title: string; items: NavItem[] }

/**
 * Single source of truth for the sidebar IA. Shared by the desktop sidebar and
 * the mobile drawer so the two never drift. Display labels are Norwegian; the
 * URLs are ASCII (see siteConfig.baseLinks).
 */
export const navSections: NavSection[] = [
  {
    title: "Daglig drift",
    items: [
      {
        name: "Oversikt",
        href: siteConfig.baseLinks.overview,
        icon: LayoutDashboard,
      },
      {
        name: "Annonser",
        href: siteConfig.baseLinks.annonser,
        icon: Megaphone,
        children: [
          { name: "Kanaler", href: siteConfig.baseLinks.annonserKanaler },
          { name: "Kampanjer", href: siteConfig.baseLinks.annonserKampanjer },
          { name: "Søketermer", href: siteConfig.baseLinks.annonserSoketermer },
          {
            name: "Anbefalinger",
            href: siteConfig.baseLinks.annonserAnbefalinger,
          },
          {
            name: "Trafikksegment",
            href: siteConfig.baseLinks.annonserTrafikksegment,
          },
        ],
      },
      { name: "Butikk", href: siteConfig.baseLinks.butikk, icon: Store },
    ],
  },
  {
    title: "Verktøy",
    items: [
      { name: "Quiz", href: siteConfig.baseLinks.quiz, icon: ListChecks },
      { name: "AI-verktøy", href: siteConfig.baseLinks.aiVerktoy, icon: Sparkles },
      { name: "Claude", href: siteConfig.baseLinks.claude, icon: MessageSquare },
    ],
  },
  {
    title: "Virksomhet",
    items: [
      { name: "Økonomi", href: siteConfig.baseLinks.okonomi, icon: Receipt },
      {
        name: "Innstillinger",
        href: siteConfig.baseLinks.innstillinger,
        icon: Settings,
      },
    ],
  },
]
