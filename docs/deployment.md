# Deployment

Detox OS Dashboard is designed for deployment on modern Next.js hosting platforms such as Vercel.

## Build commands

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

## Environment variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Optional for scripts/server-side operations:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

## Deployment checklist

Before deployment:

- Supabase project is configured
- environment variables are set in hosting provider
- authentication redirect URLs are configured in Supabase
- production domain is added to Supabase allowed URLs
- seed data is only run when intended
- no service-role keys are exposed to the client
- build passes locally or in CI

## Post-deployment checks

After deployment:

- `/login` loads
- unauthenticated users are redirected correctly
- authenticated users can access dashboard pages
- charts render correctly
- Supabase data loads
- no obvious console errors

## Security notes

- Never expose service-role keys in browser code.
- Keep RLS policies strict.
- Use separate development and production Supabase projects when needed.
- Treat operational dashboard access as internal/private.