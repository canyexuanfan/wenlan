# Security Policy

## Reporting

Please report security issues privately to the project maintainer. Do not open a public issue for credential leaks, authentication bypasses, or access-control problems.

## Secret Handling

- Never commit real `.env` files, Supabase runtime folders, SMTP credentials, database passwords, service-role keys, or deployment archives.
- Rotate any credential that may have been exposed in logs, screenshots, local handoff notes, or chat history.
- Use environment variables or a deployment secret manager for production.

## Supported Version

The main branch is the only supported development line until the project publishes stable releases.
