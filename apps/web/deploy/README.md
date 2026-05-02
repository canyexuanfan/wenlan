# Wenlan Web Deployment

## Files

- `docker-compose.server.yml`: production compose for the web app
- `.env.server.example`: environment variable template for the server

## Default port

- Host: `13010`
- Container: `3000`

The container name is `wenlan-web`, so it will show up clearly in BaoTa Docker.

## Typical server flow

1. Copy the `apps/web` directory to the server.
2. Create `apps/web/deploy/.env` from `.env.server.example`.
3. Fill in the real Supabase keys and public URLs.
4. Run:

```bash
cd apps/web/deploy
docker compose -f docker-compose.server.yml up -d --build
```

## One-command deploy from Windows

If your local `.env.local` already contains the real Supabase keys, you can run:

```powershell
cd apps/web
.\scripts\deploy-self-hosted.ps1
```

What it does:

- packages the current web source
- uploads it to the server
- writes `deploy/.env`
- saves a timestamped backup copy of that env file on the server
- rebuilds and starts the `wenlan-web` container

## Notes

- `NEXT_PUBLIC_SUPABASE_URL` must be reachable by the browser, not just by the container.
- If the public site will use HTTPS, the public Supabase URL should also use HTTPS to avoid mixed-content issues.

## Email code login

The web app supports password login and email code login. Email codes are sent by Supabase Auth, so the self-hosted Supabase stack must use a real SMTP service before this works in production.

Required Supabase SMTP values:

- `SMTP_ADMIN_EMAIL`: sender address, usually the same mailbox or a monitored admin mailbox
- `SMTP_HOST`: SMTP server host, for example the host from QQ Mail, 163 Mail, Aliyun Mail, Tencent Exmail, or another mail provider
- `SMTP_PORT`: usually `465` for SSL or `587` for STARTTLS
- `SMTP_USER`: SMTP login account
- `SMTP_PASS`: SMTP password or app-specific authorization code
- `SMTP_SENDER_NAME`: sender display name

The email template must include the one-time code token, not only a magic link. In Supabase Auth email templates, include `{{ .Token }}` in the login email body so users can copy the code into the login page.

After changing SMTP values on the server, restart the Supabase auth container:

```bash
cd /opt/docker/wenlan-supabase
docker compose up -d auth
```
