# Supabase

Detox OS Dashboard uses Supabase for authentication and application data.

## Environment variables

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` must only be used server-side or in trusted scripts.

## Authentication

Middleware creates a Supabase server client and checks the current user. Unauthenticated users are redirected to `/login`.

## Seed data

Seed data can be loaded with:

```bash
npm run seed
```

The seed script includes operational demo data for:

- suppliers
- batches
- agents
- pipelines
- SOPs

## Suggested table groups

### Suppliers

Used for supplier onboarding, quality tracking, COA status and procurement information.

### Batches

Used for batch references, quantities, dates and approval status.

### Agents

Used for AI/automation agent status, schedules, run history and last messages.

### Pipelines

Used for operational pipeline monitoring, stage status, throughput and success rate.

### SOPs

Used for standard operating procedures and internal process documentation.

## Future database documentation

Add table-level docs as the schema stabilizes:

- table purpose
- columns
- relationships
- RLS policies
- sample queries
- operational owner