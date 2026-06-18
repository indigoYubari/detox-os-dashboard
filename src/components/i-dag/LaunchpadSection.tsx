import {
  BookOpen,
  ClipboardList,
  CreditCard,
  Database,
  Gem,
  GitBranch,
  HardDrive,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Network,
  Palette,
  Receipt,
  Search,
  Send,
  Server,
  ShoppingBag,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react"

import { LaunchpadCard } from "@/components/i-dag/LaunchpadCard"

interface LaunchpadItem {
  name: string
  note: string
  href?: string
  icon: LucideIcon
}

interface LaunchpadGroup {
  title: string
  items: LaunchpadItem[]
}

// Static launchpad in v1, no API calls. Each tile opens its tool in a new tab
// (obsidian:// stays in the same tab so the app handler fires). No em-dash
// anywhere in copy, per house style.
const GROUPS: LaunchpadGroup[] = [
  {
    title: "AI-flater",
    items: [
      {
        name: "Claude",
        note: "Planlegging, orkestrering, filgenerering",
        href: "https://claude.ai",
        icon: Sparkles,
      },
      {
        name: "Claude Code",
        note: "Kanonisk bygging i repo",
        href: "https://github.com/indigoYubari",
        icon: GitBranch,
      },
      {
        name: "Gemini",
        note: "Kontroll og validering, konkurrerende skisse",
        href: "https://gemini.google.com",
        icon: Gem,
      },
      {
        name: "Perplexity",
        note: "Research og kildesok",
        href: "https://perplexity.ai",
        icon: Search,
      },
      {
        name: "ChatGPT",
        note: "Ekstra AI-flate",
        href: "https://chatgpt.com",
        icon: MessageSquare,
      },
    ],
  },
  {
    title: "Prosjekter",
    items: [
      {
        name: "detox.no",
        note: "Hovedbutikk, Shopify WIP 2.0",
        href: "https://detox.no",
        icon: ShoppingBag,
      },
      {
        name: "detox.OS",
        note: "Denne dashboarden",
        href: "https://os.detox.no",
        icon: LayoutDashboard,
      },
      {
        name: "Ad-automation",
        note: "ROAS og Telegram-varsler",
        href: "https://railway.app",
        icon: Megaphone,
      },
      {
        name: "Quiz",
        note: "Nylig deployet WIP 2.0",
        href: "https://detox.no/quiz",
        icon: ClipboardList,
      },
      {
        name: "HealthOS-portal",
        note: "Abonnement, ikke launchet enna",
        href: "https://min.detox.no",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Infrastruktur",
    items: [
      {
        name: "GitHub",
        note: "Alle repos",
        href: "https://github.com/indigoYubari",
        icon: GitBranch,
      },
      {
        name: "Supabase",
        note: "Dashboard-backend",
        href: "https://supabase.com/dashboard/project/kwrjhyytvbcaiszbfria",
        icon: Database,
      },
      {
        name: "Railway",
        note: "Hoster detox.OS og ad-agent",
        href: "https://railway.app",
        icon: Server,
      },
      {
        name: "Fiken",
        note: "Regnskap Shikoba AS",
        href: "https://fiken.no",
        icon: Receipt,
      },
      {
        name: "Shopify Admin",
        note: "Butikkdrift",
        href: "https://admin.shopify.com",
        icon: Store,
      },
      {
        name: "Klaviyo",
        note: "E-post og SMS",
        href: "https://klaviyo.com",
        icon: Mail,
      },
      {
        name: "Telegram",
        note: "Ops-varsler",
        href: "https://web.telegram.org",
        icon: Send,
      },
      {
        name: "Canva",
        note: "Design og innhold",
        href: "https://canva.com",
        icon: Palette,
      },
    ],
  },
  {
    title: "Kunnskap",
    items: [
      {
        name: "Obsidian vault",
        note: "38 mapper, klinisk data git-crypt",
        href: "obsidian://open?vault=detox-vault",
        icon: BookOpen,
      },
      {
        name: "Graphify",
        note: "Koblet til vault",
        icon: Network,
      },
      {
        name: "Google Drive",
        note: "Dokumentlager",
        href: "https://drive.google.com",
        icon: HardDrive,
      },
    ],
  },
]

/** Top-of-page launchpad: four grouped grids of quick-access tool tiles. */
export function LaunchpadSection() {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
        Launchpad
      </h2>
      <div className="mt-4 space-y-6">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3
              className="jbm mb-2 text-[9px] uppercase text-[#1a3a4a]"
              style={{ letterSpacing: "1.2px" }}
            >
              {group.title}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => (
                <LaunchpadCard
                  key={item.name}
                  name={item.name}
                  note={item.note}
                  href={item.href}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
