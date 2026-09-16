import { ParticleBackground } from "@/components/ui/ParticleBackground"
import { Topbar } from "@/components/ui/navigation/Topbar"
import { Sidebar } from "@/components/ui/navigation/sidebar"

// Den gamle, moerke flaten. Ramme flyttet hit fra rot-layouten 2026-09-16:
// rot-layouten skal bare vaere html/fonter/tema, slik at den nye lyse flaten
// i (ny)/ kan ha sin egen ramme uten aa arve denne.
//
// Alle sider under (main) ligger bak innlogging og leser levende data i
// nettleseren. Uten dette ble ti av dem forhaandsrendret ved BYGG, og HTML-en
// som ble servert var oeyeblikksbildet fra deploy-dagen: /i-dag viste
// "loerdag 12. september" og fire n/a til hydreringen tok over (Orion 15.09).
// Paa en treg linje er det ikke et glimt - det er siden. Vurdert per side:
// ingen av dem har innhold som er gyldig uten en sesjon, saa ingen tjener paa
// statisk prerender. Settes en gang her, ikke ti ganger.
export const dynamic = "force-dynamic"

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="mx-auto max-w-screen-2xl">
      <Sidebar />
      <main className="lg:pl-[200px]">
        <div className="relative">
          <ParticleBackground />
          <div className="relative z-[1]">
            <Topbar />
            <div className="p-4 sm:px-6 sm:pb-10 sm:pt-10 lg:px-10 lg:pt-7">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
