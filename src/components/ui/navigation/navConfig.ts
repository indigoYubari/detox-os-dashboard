import {
  BarChart2,
  Bot,
  Coins,
  Cpu,
  FileText,
  GitBranch,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Map,
  Megaphone,
  MessageSquare,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
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
      { name: "I dag", href: siteConfig.baseLinks.idag, icon: LayoutDashboard },
      {
        name: "Oversikt",
        href: siteConfig.baseLinks.overview,
        icon: BarChart2,
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
      { name: "Butikk", href: siteConfig.baseLinks.butikk, icon: ShoppingBag },
      {
        name: "Kundeservice",
        href: siteConfig.baseLinks.kundeservice,
        icon: MessageSquare,
      },
      {
        name: "Anmeldelser",
        href: siteConfig.baseLinks.anmeldelser,
        icon: Star,
      },
      { name: "Innhold", href: siteConfig.baseLinks.innhold, icon: FileText },
      { name: "Quiz", href: siteConfig.baseLinks.quiz, icon: HelpCircle },
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
      {
        name: "Pipelines",
        href: siteConfig.baseLinks.pipelines,
        icon: GitBranch,
      },
      { name: "AI-verktøy", href: siteConfig.baseLinks.aiVerktoy, icon: Cpu },
      { name: "SOPs", href: siteConfig.baseLinks.sops, icon: ListChecks },
    ],
  },
  {
    title: "Virksomhet",
    items: [
      { name: "Økonomi", href: siteConfig.baseLinks.okonomi, icon: Coins },
      {
        name: "Innstillinger",
        href: siteConfig.baseLinks.innstillinger,
        icon: Settings,
      },
    ],
  },
]

/** Festet nederst i sidebaren, over avataren. */
export const navBottom: NavItem[] = [
  { name: "Roadmap", href: siteConfig.baseLinks.roadmap, icon: Map },
  { name: "Claude", href: siteConfig.baseLinks.claude, icon: Sparkles },
]
