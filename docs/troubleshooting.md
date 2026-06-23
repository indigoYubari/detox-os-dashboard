# Troubleshooting

Common issues and checks for Detox OS Dashboard.

## Login redirects to `/login`

Check:

- Supabase URL is set
- Supabase anon key is set
- user exists in Supabase Auth
- cookies are not blocked
- production URL is allowed in Supabase auth settings

## Supabase data does not load

Check:

- environment variables
- RLS policies
- table names
- seed data
- browser console
- network requests

## Build fails

Run locally:

```bash
npm install
npm run build
```

Check:

- TypeScript errors
- missing dependencies
- invalid imports
- environment variable assumptions during build

## Charts do not render

Check:

- data shape
- empty datasets
- Recharts component props
- date formatting
- client/server component boundaries

## Seed script fails

Check:

- `.env.local` exists
- Supabase URL and key are correct
- service role key is only used server-side
- RLS policies allow the intended operation or service role is used

## Middleware issues

If public routes are blocked unexpectedly, check middleware matcher and login/API exceptions.

## Production checklist

- confirm environment variables in hosting provider
- confirm Supabase auth redirect settings
- test login/logout
- test protected pages
- check logs after deployment