import type { ReactNode } from "react"

// Presentasjonsdelene av «Rolig brief». Ingen hooks, ingen «use client» — de
// brukes baade av server-komponenter (som leser Supabase) og av klient-oyene
// (som henter Shopify og Gmail). Én form, ett sted.

export function Seksjon({
  merkelapp,
  children,
}: {
  merkelapp: string
  children: ReactNode
}) {
  return (
    <section className="ny-seksjon">
      <div className="ny-rad">
        <div className="ny-merkelapp">{merkelapp}</div>
        <div className="ny-kropp">{children}</div>
      </div>
    </section>
  )
}

/** Det ene svaret. Skal kunne leses alene, uten detaljene under. */
export function Svar({ children }: { children: ReactNode }) {
  return <p className="ny-svar">{children}</p>
}

/** Én linje som utfyller svaret. Aldri en liste — det er Detaljer sin jobb. */
export function Hjelp({ children }: { children: ReactNode }) {
  return <p className="ny-hjelp">{children}</p>
}

/** Tomt eller feil. Skal se tomt eller feil ut — aldri et nulltall. */
export function Stille({ children }: { children: ReactNode }) {
  return <p className="ny-stille">{children}</p>
}

export function Liste({ children }: { children: ReactNode }) {
  return <ul>{children}</ul>
}

export function Linje({ n, children }: { n: string; children: ReactNode }) {
  return (
    <li>
      <span className="n">{n}</span>
      <span className="t">{children}</span>
    </li>
  )
}

export function Knapper({ children }: { children: ReactNode }) {
  return <div className="ny-knapper">{children}</div>
}
