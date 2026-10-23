# Deploying for free (no credit card)

A demo deployment on free plans that don't ask for a card. Good for a portfolio; not for real users (see
[Limits](#limits)). For a server of your own, `docker-compose.prod.yml` runs everything on one machine instead.

```
Browser ──▶ Vercel: web (Next.js), always on
              └── /api/v1/*  ── forwarded ──▶ Render: API (NestJS + BullMQ workers), free web service
                                               ├── Neon: Postgres + pgvector (also stores uploaded files)
                                               ├── Redis Cloud: job queues
                                               ├── Brevo: email over SMTP
                                               └── Gemini: AI
```

Why this shape:

- **One address for the browser.** The session cookies are `SameSite=Lax`; `*.vercel.app` and `*.onrender.com`
  are different sites, so the web app forwards `/api/v1/*` to Render (`API_PROXY_TARGET`) and the browser only sees
  Vercel.
- **Uploads in Postgres.** A free Render instance loses its disk on every restart, spin-down and deploy, but CVs are
  read again for every analysis and cover letter: `STORAGE_DRIVER=database`.
- **Redis Cloud, not Upstash.** BullMQ polls Redis even when idle; Upstash's free plan counts commands (500K a
  month), Redis Cloud's free plan doesn't (30 MB is plenty for queues).

## 1. Create the accounts

| Service                                   | Sign up         | What you need from it                      |
| ----------------------------------------- | --------------- | ------------------------------------------ |
| [Neon](https://neon.com)                  | GitHub or email | Connection string                          |
| [Redis Cloud](https://redis.io/try-free/) | Email or Google | Endpoint and password of a free database   |
| [Brevo](https://www.brevo.com)            | Email           | SMTP login and SMTP key, a verified sender |
| [Render](https://render.com)              | GitHub          | Connected to the repository                |
| [Vercel](https://vercel.com)              | GitHub          | Connected to the repository                |

Pick regions close to each other (e.g. Singapore / `ap-southeast-1` where offered): every API request crosses
Vercel → Render → Neon/Redis.

## 2. Database (Neon)

1. Create a project (Postgres 17). Copy the **direct** connection string (the host _without_ `-pooler`), e.g.
   `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
2. From your machine, create the tables (pgvector is enabled by a migration) and seed the taxonomies and the root
   admin. Variables on the command line win over your local `.env`, so this never touches your dev database:

   ```bash
   cd apps/api
   export NEON_URL='postgresql://…?sslmode=require'
   DATABASE_URL=$NEON_URL pnpm db:deploy
   DATABASE_URL=$NEON_URL ROOT_ADMIN_EMAIL=you@example.com ROOT_ADMIN_PASSWORD='a-long-password' pnpm db:seed
   ```

   Do this again (`db:deploy` only) **before** pushing code that adds a migration: Render has no pre-deploy step on
   the free plan.

## 3. Redis (Redis Cloud)

Create the free database (30 MB). From its page, build
`REDIS_URL=redis://default:<password>@<public-endpoint-host>:<port>` — use `rediss://` if you turn on TLS. Percent-
encode special characters in the password (`@` → `%40`).

## 4. Email (Brevo)

1. **Senders**: add and verify the address mail will come from.
2. **SMTP & API → SMTP**: create an SMTP key. Note the login shown there.
3. Values: `SMTP_USER=<login>`, `SMTP_PASSWORD=<SMTP key>`, `MAIL_FROM=OfferLeap <the verified address>`
   (`SMTP_HOST`/`SMTP_PORT` are preset in `render.yaml`).

Free plan: 300 emails a day, with Brevo branding. Without a domain of your own, mail may land in spam.

## 5. API (Render)

1. **New → Blueprint**, pick the repository: Render reads `render.yaml` and creates `offerleap-api`.
2. Fill in the values it asks for. `WEB_ORIGIN` and `API_PUBLIC_URL` are the Vercel address, which you don't
   have yet: put a placeholder (`https://example.com`) and fix it in step 7.

   | Variable                                   | Value                                               |
   | ------------------------------------------ | --------------------------------------------------- |
   | `DATABASE_URL`                             | Neon direct connection string                       |
   | `REDIS_URL`                                | from step 3                                         |
   | `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`  | from step 4                                         |
   | `GEMINI_API_KEY`                           | your key                                            |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | leave empty to hide "Continue with Google" (step 8) |

3. Wait for the first deploy, then open `https://offerleap-api.onrender.com/api/v1/health` (your service name may
   differ): it answers `{"status":"ok", …}`.

## 6. Web (Vercel)

1. **Add New → Project**, import the repository. **Root Directory: `apps/web`** (build and install commands come
   from `apps/web/vercel.json`).
2. **Settings → Build → Node.js Version: 24.x.**
3. Environment variables (Production):

   | Variable                       | Value                                       |
   | ------------------------------ | ------------------------------------------- |
   | `NEXT_PUBLIC_API_URL`          | `/api/v1`                                   |
   | `API_PROXY_TARGET`             | `https://offerleap-api.onrender.com`        |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` (installs with the repo's pnpm version) |

4. Deploy and note the address, e.g. `https://offerleap.vercel.app`.

## 7. Connect them

In Render, set `WEB_ORIGIN` **and** `API_PUBLIC_URL` to the Vercel address (no trailing slash) and redeploy. Links in
emails and the Google callback are built from them.

## 8. Sign in with Google (optional)

In Google Cloud Console → Credentials → OAuth client (Web application):

- Authorised JavaScript origin: `https://offerleap.vercel.app`
- Authorised redirect URI: `https://offerleap.vercel.app/api/v1/auth/google/callback`

Put the client id and secret in Render and redeploy.

## 9. Check it works

1. Open the Vercel address. The first request after a quiet spell waits ~1 minute while Render wakes up.
2. Register: the verification email arrives (check spam). Verify, then onboard with a small CV (< 4 MB).
3. Run an analysis, write a cover letter (it should appear word by word), sign out and back in.
4. **Large upload:** try a CV of 5–10 MB. If the request fails with 413, Vercel limits forwarded request bodies;
   lower the upload limit (`RESUME_MAX_BYTES` / `KNOWLEDGE_LIMITS` in `packages/shared`) to 4 MB.
5. **Client IP (`TRUST_PROXY`):** in Neon's SQL editor run
   `select "ipAddress", "createdAt" from refresh_tokens order by "createdAt" desc limit 3;`. It should be your own
   public IP. A Render/Vercel address means one proxy more: raise `TRUST_PROXY` by one.

## Keeping the API awake (optional)

Free Render services sleep after 15 minutes without requests, and background jobs wait until they wake. A free
monitor such as UptimeRobot or cron-job.org calling `/api/v1/health` on the Render address every 10 minutes keeps it
up; 750 free hours a month cover one service running all month.

## Limits

- **Speed:** 0.1 CPU and 512 MB RAM — signing in (argon2) and reading PDF/DOCX are slow; one cold start a quiet spell.
- **Backups:** Neon free keeps 6 hours of history. Export what matters.
- **Storage:** Neon free has 1 GB, shared by data and uploaded files.
- **AI:** your Gemini quota is shared by every visitor; `AI_DAILY_QUOTA` (20 in `render.yaml`) caps each account.
- **Rate limits** count per client IP as forwarded by Vercel. Someone calling the Render address directly can fake
  that header; keep the Render address to yourself.
- **Accounts:** Render may still ask some accounts for a card as anti-abuse verification.

## Updating

Push to `main`: Vercel and Render redeploy on their own. If the push adds a migration, run `db:deploy` against Neon
first (step 2).
