# Wenlan

Wenlan is a document library and lightweight content management system. It imports HTML and Markdown documents, organizes them like a file explorer, and controls access through administrator and user roles.

## Features

- Document and folder management with card/list views.
- HTML and Markdown import.
- Optional source-format rendering for imported documents.
- Email verification and invitation-based registration.
- Supabase-backed auth, database, and document storage.
- Responsive public library and admin workspace.

## Local Development

```powershell
cd apps/web
copy .env.example .env.local
npm install
npm run dev:local
```

`npm run dev:local` expects the local Supabase stack to be available. Put real secrets only in local environment files or deployment secret stores.

## Configuration

The app reads these values from environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_THUMBNAIL_BUCKET`
- `ADMIN_USERNAME`
- `ADMIN_EMAIL`

`ADMIN_USERNAME` and `ADMIN_EMAIL` are optional. They enable one administrator to log in with a short username while keeping the real account details out of source code.

## Safety Before Publishing

- Do not commit `.env`, `.env.local`, Supabase runtime folders, generated archives, or secret inventories.
- Rotate any credential that was ever shared outside a private secret store.
- Keep production secrets in the hosting platform, server environment, or a dedicated secret manager.

## License

MIT
