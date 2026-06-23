# Detox OS Dashboard

Intern operativ plattform for Detox.no.

Detox OS er et Next.js-basert dashboard utviklet for å samle drift, kundeservice, leverandørstyring, SOP-er, automatiseringer og forretningsdata i ett grensesnitt.

## Hovedfunksjoner

- Leverandør- og kvalitetsstyring
- Batch- og produksjonsoversikt
- SOP-bibliotek (Standard Operating Procedures)
- AI-agenter og automatiseringer
- Pipeline-overvåkning
- Integrasjon mot Supabase
- Rollebasert autentisering
- Operasjonelt dashboard for Detox.no

## Teknologistack

- Next.js 14
- React 18
- TypeScript
- Supabase
- Tailwind CSS
- Radix UI
- Recharts

## Autentisering

Prosjektet bruker Supabase Authentication. Alle sider er beskyttet via middleware og krever innlogging.

## Lokal utvikling

### Installer avhengigheter

```bash
npm install
```

### Start utviklingsserver

```bash
npm run dev
```

Åpne http://localhost:3000

## Miljøvariabler

Opprett en `.env.local` fil:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Database

Prosjektet bruker Supabase som primær database.

Seed-data kan lastes inn med:

```bash
npm run seed
```

Eksempler på datasett:

- Suppliers
- Batches
- Agents
- Pipelines
- SOPs

## Formål

Målet med Detox OS er å fungere som et sentralt operativsystem for drift av Detox.no, inkludert innkjøp, markedsføring, økonomi, automatisering, kundeservice og intern dokumentasjon.

## Deployment

Prosjektet er designet for kontinuerlig deployment via moderne hosting-plattformer som Vercel.

## Status

Aktiv utvikling.