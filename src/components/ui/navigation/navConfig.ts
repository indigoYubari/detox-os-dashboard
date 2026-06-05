import {
  Bot,
  Compass,
  FileText,
  Headphones,
  Inbox,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  Newspaper,
  NotebookPen,
  Receipt,
  Settings,
  Sparkles,
  Star,
  Store,
  Truck,
  Workflow,
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
    title: "Daglig",
    items: [
      { name: "I dag", href: siteConfig.baseLinks.idag, icon: Inbox },
      {
        name: "Oversikt",
        href: siteConfig.baseLinks.overview,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Vekst",
    items: [
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
      {
        name: "Kundeservice",
        href: siteConfig.baseLinks.kundeservice,
        icon: Headphones,
      },
      { name: "Anmeldelser", href: siteConfig.baseLinks.anmeldelser, icon: Star },
      { name: "Innhold", href: siteConfig.baseLinks.innhold, icon: Newspaper },
      { name: "Quiz", href: siteConfig.baseLinks.quiz, icon: ListChecks },
    ],
  },
  {
    title: "Operasjon",
    items: [
      {
        name: "Leverandører",
        href: siteConfig.baseLinks.leverandorer,
        icon: Truck,
      },
      { name: "Agenter", href: siteConfig.baseLinks.agenter, icon: Bot },
      { name: "Pipelines", href: siteConfig.baseLinks.pipelines, icon: Workflow },
      {
        name: "AI-verktøy",
        href: siteConfig.baseLinks.aiVerktoy,
        icon: Sparkles,
      },
      { name: "SOPs", href: siteConfig.baseLinks.sops, icon: FileText },
    ],
  },
  {
    title: "Kunnskap",
    items: [
      { name: "Notater", href: siteConfig.baseLinks.notater, icon: NotebookPen },
      { name: "Roadmap", href: siteConfig.baseLinks.roadmap, icon: Compass },
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
