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

## Stack

- Frontend: HTML, CSS, JavaScript, Chart.js
- Backend: Node.js, Express, SQLite
- AI: OpenRouter (configurable model)

## License

Use and license terms are defined by your organization.
