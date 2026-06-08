import { createClient } from "@supabase/supabase-js"

// Bruker anon key — fungerer etter at RLS anon full access policy er satt.
// Hvis service_role trengs: legg SUPABASE_SERVICE_ROLE_KEY i .env.local
// og bytt til den her. service_role skal ALDRI inn i frontend-kode.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller nøkkel i .env.local")
  process.exit(1)
}

const supabase = createClient(url, key)

async function seed() {
  console.log("Seeder suppliers…")
  const { error: supErr } = await supabase.from("suppliers").upsert([
    {
      id: "sup-001",
      name: "Nordic Naturals GmbH",
      category: "Omega-3 / fiskeolje",
      country: "Tyskland",
      contact: "Klaus Bauer",
      email: "k.bauer@nordicnaturals.de",
      phone: "+49 89 4521 8800",
      lead_time_days: 21,
      moq: "500 enheter",
      payment: "Net 30",
      status: "aktiv",
      coa: "ok",
      quality: 94,
    },
    {
      id: "sup-002",
      name: "Biooptimal AB",
      category: "Vitaminer / mineraler",
      country: "Sverige",
      contact: "Anna Lindqvist",
      email: "anna@biooptimal.se",
      phone: "+46 8 555 123 45",
      lead_time_days: 14,
      moq: "200 enheter",
      payment: "Forskudd",
      status: "aktiv",
      coa: "ok",
      quality: 88,
    },
    {
      id: "sup-003",
      name: "PureForm Labs",
      category: "Adaptogener / urter",
      country: "Nederland",
      contact: "Jan de Vries",
      email: "jan@pureformlabs.nl",
      phone: "+31 20 890 3400",
      lead_time_days: 28,
      moq: "1000 enheter",
      payment: "Net 60",
      status: "pause",
      coa: "utlopt",
      quality: 72,
    },
    {
      id: "sup-004",
      name: "Himalaya Botanicals",
      category: "Ayurveda / urter",
      country: "India",
      contact: "Priya Sharma",
      email: "priya@himalayabot.com",
      phone: "+91 80 4567 8900",
      lead_time_days: 45,
      moq: "2000 enheter",
      payment: "50% forskudd",
      status: "ny",
      coa: "mangler",
      quality: 65,
    },
  ])
  if (supErr) console.error("suppliers feil:", supErr.message)
  else console.log("✓ suppliers")

  console.log("Seeder batches…")
  const { error: batErr } = await supabase.from("batches").upsert([
    { id: "a1b2c3d4-0001-0001-0001-000000000001", supplier_id: "sup-001", ref: "NN-2025-0312", date: "2025-03-12", qty: "600 stk", status: "godkjent" },
    { id: "a1b2c3d4-0001-0001-0001-000000000002", supplier_id: "sup-001", ref: "NN-2025-0601", date: "2025-06-01", qty: "550 stk", status: "godkjent" },
    { id: "a1b2c3d4-0001-0001-0001-000000000003", supplier_id: "sup-002", ref: "BO-2025-0210", date: "2025-02-10", qty: "300 stk", status: "godkjent" },
    { id: "a1b2c3d4-0001-0001-0001-000000000004", supplier_id: "sup-003", ref: "PF-2024-1105", date: "2024-11-05", qty: "1200 stk", status: "karantene" },
    { id: "a1b2c3d4-0001-0001-0001-000000000005", supplier_id: "sup-004", ref: "HB-2025-0415", date: "2025-04-15", qty: "2100 stk", status: "avvist" },
  ])
  if (batErr) console.error("batches feil:", batErr.message)
  else console.log("✓ batches")

  console.log("Seeder agents…")
  const { error: agErr } = await supabase.from("agents").upsert([
    {
      id: "agent-roas-watcher",
      name: "ROAS-vakt",
      type: "Annonsering",
      description: "Overvåker ROAS på Meta og Google Ads. Varsler på Telegram ved fall under terskel.",
      status: "kjorer",
      schedule: "Hvert 15. min",
      last_run: "for 3 min siden",
      next_run: "om 12 min",
      runs_today: 62,
      success_rate: 98,
      avg_duration: "4s",
      last_message: "ROAS Meta: 4.2x — over terskel. Google: 3.8x — OK.",
    },
    {
      id: "agent-invoice-fetcher",
      name: "Faktura-henter",
      type: "Økonomi",
      description: "Henter fakturaer fra Gmail og sender til Fiken for bokføring.",
      status: "inaktiv",
      schedule: "Daglig kl 08:00",
      last_run: "i dag 08:01",
      next_run: "i morgen 08:00",
      runs_today: 1,
      success_rate: 100,
      avg_duration: "22s",
      last_message: "3 fakturaer hentet og sendt til Fiken.",
    },
    {
      id: "agent-stock-alert",
      name: "Lagervarsler",
      type: "Lager",
      description: "Sjekker Shopify lagernivåer og varsler ved lav beholdning.",
      status: "feil",
      schedule: "Hver time",
      last_run: "for 2 timer siden",
      next_run: "manuell restart kreves",
      runs_today: 4,
      success_rate: 75,
      avg_duration: "8s",
      last_message: "Feil: Shopify API timeout etter 3 forsøk.",
    },
    {
      id: "agent-seo-crawler",
      name: "SEO-sjekker",
      type: "Innhold",
      description: "Analyserer produktsider for SEO-helse og manglende metadata.",
      status: "planlagt",
      schedule: "Ukentlig mandag 06:00",
      last_run: "mandag 06:00",
      next_run: "mandag 06:00",
      runs_today: 0,
      success_rate: 91,
      avg_duration: "4m 12s",
      last_message: "12 sider med manglende alt-tekst funnet.",
    },
  ])
  if (agErr) console.error("agents feil:", agErr.message)
  else console.log("✓ agents")

  console.log("Seeder pipelines…")
  const { error: pipErr } = await supabase.from("pipelines").upsert([
    {
      id: "pipe-ad-sync",
      name: "Annonse-synk",
      description: "Henter kampanjedata fra Meta og Google, normaliserer og lagrer i databasen.",
      trigger: "Hvert 30. min",
      status: "ok",
      last_run: "for 18 min siden",
      duration: "12s",
      throughput: "~280 rader/kjøring",
      success_rate: 99,
      stages: [
        { step: 1, name: "Fetch Meta", status: "ok" },
        { step: 2, name: "Fetch Google", status: "ok" },
        { step: 3, name: "Normaliser", status: "ok" },
        { step: 4, name: "Lagre", status: "ok" },
      ],
    },
    {
      id: "pipe-fiken-reconcile",
      name: "Fiken-avstemming",
      description: "Matcher Shopify-ordrer mot Fiken-transaksjoner og flagger avvik.",
      trigger: "Daglig kl 23:00",
      status: "feil",
      last_run: "i natt 23:00",
      duration: "1m 34s",
      throughput: "~85 ordrer/kjøring",
      success_rate: 82,
      stages: [
        { step: 1, name: "Hent ordrer", status: "ok" },
        { step: 2, name: "Hent Fiken", status: "ok" },
        { step: 3, name: "Match", status: "feil" },
        { step: 4, name: "Rapport", status: "venter" },
      ],
    },
    {
      id: "pipe-klaviyo-sync",
      name: "Klaviyo-synk",
      description: "Synkroniserer kundesegmenter fra Shopify til Klaviyo-lister.",
      trigger: "Ukentlig søndag 04:00",
      status: "ok",
      last_run: "søndag 04:00",
      duration: "3m 22s",
      throughput: "~1200 profiler/kjøring",
      success_rate: 97,
      stages: [
        { step: 1, name: "Hent kunder", status: "ok" },
        { step: 2, name: "Segment", status: "ok" },
        { step: 3, name: "Push Klaviyo", status: "ok" },
      ],
    },
  ])
  if (pipErr) console.error("pipelines feil:", pipErr.message)
  else console.log("✓ pipelines")

  console.log("Seeder sops…")
  const { error: sopErr } = await supabase.from("sops").upsert([
    {
      id: "sop-leverandor-onboard",
      title: "Leverandør onboarding",
      category: "Innkjøp",
      owner: "Kim",
      frequency: "Ved behov",
      last_updated: "2025-05-20",
      status: "aktiv",
      summary: "Prosess for å godkjenne og registrere ny leverandør i systemet.",
      steps: [
        { step: 1, title: "Innhent COA og dokumentasjon", description: "Be om COA, allergenattest og produksjonssertifikat." },
        { step: 2, title: "Kvalitetsvurdering", description: "Score leverandøren 0-100 basert på COA og referanser." },
        { step: 3, title: "Testordre", description: "Bestill minimum testbatch og verifiser kvalitet." },
        { step: 4, title: "Registrer i Supabase", description: "Legg til i suppliers-tabellen med korrekt status og COA." },
      ],
    },
    {
      id: "sop-coa-fornyelse",
      title: "COA-fornyelse",
      category: "Innkjøp",
      owner: "Kim",
      frequency: "Årlig",
      last_updated: "2025-01-10",
      status: "aktiv",
      summary: "Rutine for å følge opp utløpte eller manglende COA-er fra leverandører.",
      steps: [
        { step: 1, title: "Identifiser utløpte COA-er", description: "Filtrer leverandørlisten på COA = utlopt eller mangler." },
        { step: 2, title: "Send purring", description: "E-post til leverandørkontakt med frist på 14 dager." },
        { step: 3, title: "Oppdater status", description: "Sett leverandørstatus til pause inntil COA er mottatt." },
      ],
    },
    {
      id: "sop-annonsering-uke",
      title: "Ukentlig annonsegjennomgang",
      category: "Annonsering",
      owner: "Kim",
      frequency: "Ukentlig mandag",
      last_updated: "2025-06-01",
      status: "aktiv",
      summary: "Gjennomgang av annonseresultater og justering av budsjett og kreativt materiale.",
      steps: [
        { step: 1, title: "Åpne detox.OS annonser-siden" },
        { step: 2, title: "Sjekk ROAS per kanal", description: "Meta og Google — sammenlign med terskelverdi 3.5x." },
        { step: 3, title: "Identifiser tapende annonser", description: "Pause annonser med ROAS < 2.0 over 7 dager." },
        { step: 4, title: "Juster budsjett", description: "Flytt budsjett til kanaler med høyest ROAS." },
      ],
    },
    {
      id: "sop-fiken-maned",
      title: "Månedlig regnskapsavslutning",
      category: "Økonomi",
      owner: "Iman",
      frequency: "Månedlig",
      last_updated: "2025-04-30",
      status: "utkast",
      summary: "Sjekkliste for å avslutte regnskapsmåned i Fiken og sende til revisor.",
      steps: [
        { step: 1, title: "Kjør Fiken-avstemming pipeline" },
        { step: 2, title: "Godkjenn alle transaksjoner i Fiken" },
        { step: 3, title: "Last opp bilag som mangler" },
        { step: 4, title: "Send rapport til Jarl (revisor)" },
      ],
    },
  ])
  if (sopErr) console.error("sops feil:", sopErr.message)
  else console.log("✓ sops")

  console.log("Seeder notes…")
  const { error: noteErr } = await supabase.from("notes").upsert([
    {
      id: "note-001",
      title: "Valg av Supabase som databaseplattform",
      excerpt: "Vurderte PlanetScale, Neon og Supabase. Valgte Supabase pga. built-in auth, realtime og norsk databehandleravtale tilgjengelig.",
      type: "beslutning",
      tags: ["infrastruktur", "database", "gdpr"],
      project: "detox.OS",
      updated: "2025-06-07",
      pinned: true,
    },
    {
      id: "note-002",
      title: "Ashwagandha-markedet i Norge 2025",
      excerpt: "Søkevolum øker 34% YoY. Konkurrentanalyse viser hull i kategorien høy-potens ekstrakt (KSM-66). Mulig produktlansering Q3.",
      type: "forskning",
      tags: ["adaptogener", "produktutvikling", "marked"],
      project: "Produktstrategi",
      updated: "2025-05-28",
      pinned: false,
    },
    {
      id: "note-003",
      title: "Bundle-konsept: Stressmestring-pakke",
      excerpt: "Idé: bundle med Ashwagandha + Magnesium + L-theanin. Markedsføres mot yrkesaktive 30-45 år. Estimert margin 58%.",
      type: "ide",
      tags: ["bundle", "produktutvikling", "innhold"],
      project: "Produktstrategi",
      updated: "2025-06-03",
      pinned: false,
    },
    {
      id: "note-004",
      title: "Møte med Adrian — API-integrasjoner",
      excerpt: "Diskuterte webhook-arkitektur for Shopify → Railway. Adrian tar seg av Fiken-API-integrasjon. Frist: 20. juni.",
      type: "mote",
      tags: ["adrian", "api", "railway"],
      project: "Ad automation",
      updated: "2025-06-05",
      pinned: false,
    },
  ])
  if (noteErr) console.error("notes feil:", noteErr.message)
  else console.log("✓ notes")

  console.log("\nSeed ferdig!")
}

seed().catch(console.error)
