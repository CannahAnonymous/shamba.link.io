# ShambaLink API

This small Node.js API provides the first persistent backend for the static site:

- `GET /api/health` — service health check
- `GET /api/listings?search=maize&role=farmer` — marketplace listings
- `POST /api/interests` — stores farmer, agent, or buyer onboarding interest
- `POST /api/questions` — records an unanswered AI question for the ShambaLink team
- `POST /api/visits` — records an anonymous page visit
- `GET /api/visits` — returns recent visits for the owner with `Authorization: Bearer $ADMIN_TOKEN`
- `POST /api/auth/register` — stores a profile with a unique phone or email and hashed password

## Run locally

```bash
cd backend
copy .env.example .env
npm start
```

The API currently stores development data in `backend/data/store.json` (ignored from version control). Set `DATA_FILE` to a durable volume in production. The relational production schema is in `backend/database.sql`; it creates `listings`, `interests`, and `unanswered_questions` tables for PostgreSQL. Apply it to a managed PostgreSQL database before migrating the API storage layer:

```bash
psql "$DATABASE_URL" -f database.sql
```

Set `ALLOWED_ORIGIN` to the exact frontend origin rather than `*`.
Set a long random `ADMIN_TOKEN` to protect the owner visit log. Set `VISIT_WEBHOOK_URL` to an HTTPS webhook for an external notification on each new visit. The webhook receives only the page path, referrer, language, ID, and timestamp.
For SMS alerts when someone submits the Join ShambaLink form, configure Twilio with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and a verified `TWILIO_FROM_NUMBER`. `TWILIO_TO_NUMBER` defaults to `+255741998751`. Keep these values only in the backend host's secret environment settings; never place them in frontend JavaScript.
Phone verification is paused. Registration currently accepts a phone number or email without a verification code, rejects duplicate contacts, and stores a salted password hash. Re-enable contact verification before treating contact details as verified.

The current frontend remains usable without an API. To connect it, set `window.SHAMBALINK_API_URL` before `script.js` loads, for example:

```html
<script>window.SHAMBALINK_API_URL = "https://api.Shambalink.com";</script>
<script src="script.js"></script>
```

For a live connection without editing the published files, open the site once with `?api=https%3A%2F%2Fyour-service.onrender.com`; the frontend accepts HTTPS API URLs only. You can also save the URL in the browser console with `localStorage.setItem("shambalink-api-url", "https://your-service.onrender.com")`. Confirm the service first with `/api/health`; it must return `{"ok":true,"service":"shambalink-api"}`.

This is an initial production-shaped API, not an authentication or payment system. The JSON adapter remains the local fallback; use the schema and a managed PostgreSQL connection for production data, then add managed authentication, rate limiting, and HTTPS before accepting sensitive or commercial data.

## Deploy

`render.yaml` defines a Render web service with a persistent disk for the JSON store. After deploying, copy the service URL into `window.SHAMBALINK_API_URL` in `index.html`, then redeploy the GitHub Pages site. GitHub Pages can host the frontend, but it cannot run this Node.js process itself.
