# Security

Detox OS Dashboard is an internal operations dashboard and should be treated as private/internal software.

## Reporting issues

Report suspected security issues privately to the repository owner. Do not open public issues containing credentials, keys, tokens, customer data or exploit details.

## Secrets

Never commit:

- `.env.local`
- API keys
- Supabase service-role keys
- access tokens
- database passwords
- private operational data

## Sensitive areas

Use extra care when changing:

- Supabase authentication
- middleware
- protected routes
- RLS policies
- environment variables
- seed scripts
- deployment settings

## Pull request security checklist

- [ ] No secrets committed
- [ ] Service-role keys are not exposed to frontend code
- [ ] Protected routes remain protected
- [ ] RLS assumptions are documented
- [ ] Production deployment impact is considered