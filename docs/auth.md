# Auth-gateway (Mission 01, 2026-08-22)

Kanonisk dokumentasjon: `detox-os-architecture` (docs/iam.md, docs/security.md,
decisions/ADR-010-gateway-implementation.md). Dette er kortversjonen for dette repoet.

## Modell

- `middleware.ts`: alt beskyttet by default; kun `/login` er offentlig
  (allow-list i `src/lib/auth-policy.ts`). API-stier får 401 JSON, sider redirectes.
- `src/lib/auth-policy.ts`: roller/scopes (ren logikk, enhetstestet).
- `src/lib/auth-server.ts`: `requireDetoxUser()` / `authorize(scope)` for route handlers,
  pluss `recordActivityEvent()` (append-only audit).
- `/api/detox/[...path]`: krever `detox:read` (GET) / `action:approve` (approve/reject);
  setter `decided_by` server-side fra faktisk bruker; sender `X-Correlation-Id`.
- `/api/v1/me` og `/api/v1/approvals`: første GPT-klare endepunkter (`openapi/`).

## Roller

`app_metadata.detox_role`: `admin` | `founder` | `operator` | `service`.
Uten rolle: kun `detox:read` (approve gir 403). Tildeling: se
`detox-os-architecture:docs/iam.md` (SQL kjøres av admin).

## Deploy-steg (i rekkefølge)

1. Kjør `supabase/migrations/0001` og `0002` i Supabase SQL Editor (Dashboard-DB).
2. Sett `detox_role` for Kim/Anniken (iam.md).
3. Deploy denne branchen.
4. Verifiser: anonym `GET /api/detox/metrics` → 401; innlogget → 200; approve uten
   founder-rolle → 403; anon REST-kall mot `clients` → nektet (se 0002 for kommando).
