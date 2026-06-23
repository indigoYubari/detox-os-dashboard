# Detox OS Dashboard Architecture

Detox OS Dashboard is an internal operations dashboard for Detox.no.

## Overview

The dashboard is a Next.js application with Supabase authentication and Supabase-backed operational data.

```text
User
 ↓
Next.js app
 ↓
Supabase Auth middleware
 ↓
Protected dashboard routes
 ↓
Supabase database
```

## Main responsibilities

The dashboard is intended to centralize operational visibility across Detox.no workflows.

Possible modules include:

- supplier management
- batch and quality tracking
- SOPs
- AI agents
- pipelines
- operational metrics
- internal dashboards

## Frontend

Built with:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Radix UI
- Recharts

## Authentication

The app uses Supabase authentication. Middleware protects dashboard routes and redirects unauthenticated users to `/login`.

## Data layer

Supabase is used for application data. Seed data includes suppliers, batches, agents, pipelines and SOPs.

## Development principle

Keep dashboard features modular and documented. Each major module should eventually have its own document in `/docs` describing its tables, pages and operational purpose.