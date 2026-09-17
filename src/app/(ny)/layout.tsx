import type { Metadata } from "next"
import Link from "next/link"

import "./lys.css"

// Den nye flaten for Indigo og Anniken. Lyst, rolig, ett svar per seksjon.
// Ligger ved siden av den gamle (main)-flaten, som beholder sin moerke drakt
// og sine egne tokens — se lys.css.
//
// force-dynamic av samme grunn som i (main): alt her er dagens tall. En
// forhaandsrendret HTML ville vaert et oyeblikksbilde fra deploy-dagen.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Dagens — detox.OS",
  description: "Det Indigo og Anniken trenger å vite i dag",
}

export default function NyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="lys">
      <div className="ny-ramme">
        <header className="ny-topp">
          <div className="ny-merke">
            detox<span>.OS</span>
          </div>
          <div className="ny-topp-hoyre">
            <Link href="/overview">Gammelt dashbord</Link>
          </div>
        </header>

        <main>{children}</main>

        <footer className="ny-bunn">
          <span>Detox · eiere</span>
          <span>Raphael svarer i Telegram</span>
        </footer>
      </div>
    </div>
  )
}
