# Virtum

Production-oriented wellness web application: metrics, charts, hydration tracking, and **Jeffrey** (AI assistant via OpenRouter).

## Requirements

- Node.js 18+
- OpenRouter API key (or compatible OpenAI-style endpoint configured in `.env`)

## Install & run

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: OPENROUTER_API_KEY, JWT_SECRET, ALLOWED_ORIGINS (for production)
npm start
```

### Email — verification & login codes

Codes are sent **to** whatever address users enter. The backend can send mail in three ways (first match wins if `EMAIL_PROVIDER` is unset or `auto`):

1. **Resend (recommended)** — HTTPS API, works when **SMTP ports are blocked** on your network.

   ```env
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=Virtum <onboarding@resend.dev>
   ```

   Get a key at [resend.com](https://resend.com). For production, verify a domain in Resend and set `EMAIL_FROM` to your domain.

2. **SendGrid** — HTTPS API.

   ```env
   SENDGRID_API_KEY=SG.xxxxx
   EMAIL_FROM=Virtum <your-verified-sender@domain.com>
   ```

3. **SMTP** (Gmail, etc.) — set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Gmail needs an **App Password** (2‑Step Verification). If you see **`ETIMEDOUT`**, your network likely blocks SMTP — use Resend/SendGrid instead, or try port `465` with `SMTP_SECURE=true`.

Optional: `EMAIL_PROVIDER=resend|sendgrid|smtp|auto` to force a mode.

**Production:** set `NODE_ENV=production` in `backend/.env`. Verification and login codes are **only** delivered by email (no codes are returned in API responses).

### Auth0 (optional)

You can enable Auth0 login in addition to local username/password auth:

```env
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_AUDIENCE=your_api_audience_or_client_id
```

When configured, the login screen shows a **Continue with Auth0** button. The backend verifies Auth0 JWTs via JWKS and then issues a local Virtum session token.

### Firebase Auth (email/password, optional)

You can also enable Firebase email/password login and verification flow.

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY=your_web_api_key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

- Frontend uses Firebase client SDK for `createUserWithEmailAndPassword` and verification email.
- Backend verifies Firebase ID token and issues local Virtum JWT via `POST /api/auth/login-firebase`.
- Keep Email/Password local auth if you want; Firebase buttons are shown only when Firebase env is configured.

Open **http://localhost:5001/virtum.html** (or your deployed host).

Health check: `GET /api/health`

## Production deployment checklist

| Area | Notes |
|------|--------|
| **HTTPS** | Terminate TLS (nginx, Caddy, cloud load balancer). |
| **Secrets** | Never commit `.env`. Use a secrets manager in production. |
| **CORS** | Set `ALLOWED_ORIGINS` to your real domain(s), not `*`. |
| **Auth** | Current client uses localStorage for session UX; migrate to server-side sessions + httpOnly cookies or OAuth for strict production. |
| **Database** | SQLite is fine for small scale; plan PostgreSQL/MySQL for HA. |
| **Legal** | Have `terms.html` / `privacy.html` reviewed by counsel for your market. |
| **AI** | Configure data processing agreement with your AI vendor; minimize PHI in prompts. |

## v1.0 Go-Live Checklist (Practical)

Use this before tagging `v1.0.0`.

### P0 — Must pass before release

- [ ] Auth isolation: all private routes read user identity from JWT (not from `userId` in body/query).
- [ ] Secrets: strong `JWT_SECRET`, valid `OPENROUTER_API_KEY`, no secrets committed to git.
- [ ] CORS: `ALLOWED_ORIGINS` set to real host(s), no wildcard in production.
- [ ] Backend health: `GET /api/health` returns `ok: true` after restart.
- [ ] Smoke tests (manual): register → login → dashboard load → save custom metrics → charts screen → chat response.
- [ ] Error handling: user-facing errors are understandable (no raw stack traces in production).
- [ ] Data integrity: quick-add and exact inputs for `steps/calories/sleep` persist and reload correctly.

### P1 — Strongly recommended

- [ ] Add API integration tests (`auth`, `data/custom`, `data/history`, `ai/chat`) with pass/fail script.
- [ ] Add DB indexes for main queries (at least `biomarkers(userId, timestamp)`).
- [ ] Add account recovery flow (`forgot/reset password`).
- [ ] Add structured logs for request id, endpoint, status, and latency.
- [ ] Review mobile UX (bottom nav one-line, forms, keyboard overlap, toast placement).

### P2 — Nice to have for post-v1.0

- [ ] Migrate auth storage to secure cookies (`httpOnly`) for stricter production setup.
- [ ] Add period filters for full charts (`7d / 14d / 30d`).
- [ ] Add provider summary export (`JSON/CSV`) from Provider Mode v2.
- [ ] Add CI pipeline (lint + test on every push/PR).

### Release day steps

1. Pull latest, run backend, test critical user flows.
2. Run DB backup (`backend/virtum.db`) before any schema changes.
3. Freeze changes, tag release (`v1.0.0`), and deploy.
4. Monitor health endpoint and logs for first 24h.

## Stack

- Frontend: HTML, CSS, JavaScript, Chart.js
- Backend: Node.js, Express, SQLite
- AI: OpenRouter (configurable model)

## License

Use and license terms are defined by your organization.
