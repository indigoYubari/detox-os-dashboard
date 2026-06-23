# Contributing

This repository contains the internal Detox OS Dashboard. Changes should be documented, reviewed and tested before merge.

## Workflow

1. Create a focused branch.
2. Keep changes small and understandable.
3. Run local checks before opening a PR.
4. Update documentation when behavior changes.
5. Open a pull request and include screenshots for UI changes.

## Local checks

```bash
npm install
npm run lint
npm run build
```

## Documentation expectations

Update README or `/docs` when changing:

- Supabase tables or environment variables
- authentication behavior
- dashboard modules
- agents
- pipelines
- deployment setup
- troubleshooting steps

## Safety rules

- Do not commit `.env.local`.
- Do not expose service-role keys in frontend code.
- Keep protected routes behind auth.
- Treat the dashboard as internal/private.
- Keep RLS policies strict.

## Pull request checklist

- [ ] Build passes
- [ ] Lint passes
- [ ] Documentation updated where needed
- [ ] UI checked on desktop and mobile where relevant
- [ ] No secrets committed
- [ ] Production impact considered