import type { Metadata } from "next"
import Link from "next/link"

import "./lys.css"

// Den nye flaten for Indigo og Anniken. Lyst, rolig, ett svar per seksjon.
// Fra 2026-09-25 er dette det ene dashbordet; den gamle (main)-flaten er
// pensjonert (Retning A, Adrian 24.09).
//
// force-dynamic: alt her er dagens tall. En
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
          <nav className="ny-nav" aria-label="Sider">
            <Link href="/">I dag</Link>
            <Link href="/koe">Venter på deg</Link>
            <Link href="/eiere">Anakin</Link>
            <Link href="/radar">Funnene</Link>
            <Link href="/butikk">Butikken</Link>
            <Link href="/annonser">Annonsene</Link>
            <Link href="/kort">Kortene</Link>
            <Link href="/ideer">Idéer</Link>
          </nav>
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
