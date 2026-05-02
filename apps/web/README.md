This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local Mock Mode

When you want to verify the Wenlan UI locally before connecting to a live Supabase instance, use the mock-mode scripts:

```bash
pnpm dev:mock
pnpm build:mock
pnpm start:mock -- --hostname 127.0.0.1 --port 3100
```

These commands force the app into mock content mode even if `.env.local` already contains real Supabase credentials.

## Local Supabase Mode

When the self-hosted Supabase stack is running on your machine through `infra/supabase/runtime/official-stack`, use:

```bash
pnpm dev:local
pnpm build:local
pnpm start:local -- --hostname 127.0.0.1 --port 3100
```

These commands keep the keys from `.env.local`, force mock mode off, and override `NEXT_PUBLIC_SUPABASE_URL` to `http://127.0.0.1:18000` so the app talks to your local Kong gateway instead of the remote server.

## Auth Flow

When local Supabase mode is active:

- `/admin` redirects anonymous visitors to `/login`
- `/api/admin/*` returns `401` unless the request has a valid session
- Documents or folders with `access_mode = login` redirect anonymous visitors to `/login?redirectTo=...`
- Signed-in members can open those `login` routes normally

The login form submits to the server route at `/auth/login`, and sign-out posts to `/auth/logout`.

## Local Auth Smoke Test

For a full local verification loop:

1. Start the stack in `infra/supabase/runtime/official-stack/wenlan`
2. Run `.\local-up.ps1`
3. Run `.\apply-bootstrap.ps1`
4. Start the web app with `pnpm dev:local`
5. Create a user in local Supabase Auth, then sign in through `/login`

You can create the local user through Supabase Studio or through a service-role script during development. The default local target is still `http://127.0.0.1:3000`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
