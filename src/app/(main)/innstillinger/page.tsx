"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"

// ── types ─────────────────────────────────────────────────────
type SectionKey = "konto" | "integrasjoner" | "varsler" | "utseende"

type Integration = {
  id: string
  name: string
  desc: string
  dot: string
  connected: boolean
}

// ── data ──────────────────────────────────────────────────────
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "konto", label: "Konto" },
  { key: "integrasjoner", label: "Integrasjoner" },
  { key: "varsler", label: "Varsler" },
  { key: "utseende", label: "Utseende" },
]

const INTEGRATIONS: Integration[] = [
  {
    id: "shopify",
    name: "Shopify",
    desc: "Butikk, ordrer og produkter",
    dot: "bg-green-500",
    connected: true,
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    desc: "E-post og SMS-marketing",
    dot: "bg-yellow-500",
    connected: true,
  },
  {
    id: "meta",
    name: "Meta Ads",
    desc: "Facebook og Instagram-annonser",
    dot: "bg-indigo-500",
    connected: true,
  },
  {
    id: "google",
    name: "Google Ads",
    desc: "Søk, Shopping og Performance Max",
    dot: "bg-blue-500",
    connected: true,
  },
  {
    id: "fiken",
    name: "Fiken",
    desc: "Regnskap og bilag",
    dot: "bg-emerald-500",
    connected: true,
  },
  {
    id: "dnb",
    name: "DNB",
    desc: "Banktransaksjoner",
    dot: "bg-sky-500",
    connected: false,
  },
  {
    id: "resend",
    name: "Resend",
    desc: "Transaksjonell e-post",
    dot: "bg-gray-500",
    connected: true,
  },
  {
    id: "telegram",
    name: "Telegram",
    desc: "Varslingsbott @detoxno_ad_agent_bot",
    dot: "bg-cyan-500",
    connected: true,
  },
]

// ── component ─────────────────────────────────────────────────
export default function Innstillinger() {
  const [section, setSection] = React.useState<SectionKey>("konto")

  const [notifications, setNotifications] = React.useState({
    digest: true,
    roasAlarm: true,
    lowStock: true,
    newReview: false,
    weeklyReport: true,
  })
  const [theme, setTheme] = React.useState<"lyst" | "morkt" | "system">(
    "system",
  )

  const connectedCount = INTEGRATIONS.filter((i) => i.connected).length

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Innstillinger
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Konto, tilganger, integrasjoner
          </p>
        </div>
        <Badge variant="success">
          {connectedCount}/{INTEGRATIONS.length} tilkoblet
        </Badge>
      </div>

      {/* ── Layout ── */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* nav */}
        <nav className="lg:col-span-1">
          <ul className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <button
                  onClick={() => setSection(s.key)}
                  className={`w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                    section === s.key
                      ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* content */}
        <div className="lg:col-span-3">
          {section === "konto" && (
            <Card title="Konto" desc="Din profil og virksomhet">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="navn" label="Navn" defaultValue="Kim" />
                <Field
                  id="rolle"
                  label="Rolle"
                  defaultValue="Grunnlegger / operatør"
                />
                <Field
                  id="epost"
                  label="E-post"
                  type="email"
                  defaultValue="as.shikoba@gmail.com"
                />
                <Field
                  id="firma"
                  label="Virksomhet"
                  defaultValue="Shikoba AS"
                />
                <Field id="orgnr" label="Org.nr" defaultValue="••• ••• •••" />
                <Field id="domene" label="Domene" defaultValue="detox.no" />
              </div>
              <SaveBar />
            </Card>
          )}

          {section === "integrasjoner" && (
            <Card title="Integrasjoner" desc="Tilkoblede tjenester og API-er">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {INTEGRATIONS.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 py-4 first:pt-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${i.dot}`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                          {i.name}
                        </p>
                        <p className="text-xs text-gray-400">{i.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={i.connected ? "success" : "neutral"}>
                        {i.connected ? "Tilkoblet" : "Frakoblet"}
                      </Badge>
                      <button
                        className={`text-sm font-medium ${
                          i.connected
                            ? "text-gray-500 hover:text-red-600 dark:text-gray-400"
                            : "text-emerald-600 hover:text-emerald-700"
                        }`}
                      >
                        {i.connected ? "Koble fra" : "Koble til"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {section === "varsler" && (
            <Card title="Varsler" desc="Hva du vil bli varslet om">
              <div className="space-y-1">
                <Toggle
                  label="Daglig digest"
                  desc="ROAS-sammendrag til Telegram kl 07:00"
                  checked={notifications.digest}
                  onChange={() =>
                    setNotifications((n) => ({ ...n, digest: !n.digest }))
                  }
                />
                <Toggle
                  label="ROAS-alarm"
                  desc="Varsel når en kanal faller under terskel"
                  checked={notifications.roasAlarm}
                  onChange={() =>
                    setNotifications((n) => ({ ...n, roasAlarm: !n.roasAlarm }))
                  }
                />
                <Toggle
                  label="Lavt lager"
                  desc="Når et produkt går under minimumsnivå"
                  checked={notifications.lowStock}
                  onChange={() =>
                    setNotifications((n) => ({ ...n, lowStock: !n.lowStock }))
                  }
                />
                <Toggle
                  label="Nye anmeldelser"
                  desc="Varsel ved 1–2-stjerners anmeldelser"
                  checked={notifications.newReview}
                  onChange={() =>
                    setNotifications((n) => ({ ...n, newReview: !n.newReview }))
                  }
                />
                <Toggle
                  label="Ukentlig rapport"
                  desc="Omsetning og kampanjeresultat hver mandag"
                  checked={notifications.weeklyReport}
                  onChange={() =>
                    setNotifications((n) => ({
                      ...n,
                      weeklyReport: !n.weeklyReport,
                    }))
                  }
                />
              </div>
            </Card>
          )}

          {section === "utseende" && (
            <Card title="Utseende" desc="Tema og regionale formater">
              <div>
                <Label>Tema</Label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {(["lyst", "morkt", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`rounded-lg border p-4 text-sm font-medium transition ${
                        theme === t
                          ? "border-emerald-300 bg-emerald-50/50 text-emerald-700 ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {t === "morkt"
                        ? "Mørkt"
                        : t === "lyst"
                          ? "Lyst"
                          : "System"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="sprak" label="Språk" defaultValue="Norsk bokmål" />
                <Field id="valuta" label="Valuta" defaultValue="NOK (kr)" />
                <Field
                  id="tidssone"
                  label="Tidssone"
                  defaultValue="Europe/Oslo"
                />
                <Field
                  id="datoformat"
                  label="Datoformat"
                  defaultValue="dd.mm.åååå"
                />
              </div>
              <SaveBar />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

// ── small parts ───────────────────────────────────────────────
function Card({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{desc}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}

function Field({
  id,
  label,
  defaultValue,
  type = "text",
}: {
  id: string
  label: string
  defaultValue: string
  type?: string
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} defaultValue={defaultValue} className="mt-2" />
    </div>
  )
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-4 last:border-0 dark:border-gray-800">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
          {label}
        </p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}

function SaveBar() {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
      <button className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
        Avbryt
      </button>
      <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200">
        Lagre endringer
      </button>
    </div>
  )
}
