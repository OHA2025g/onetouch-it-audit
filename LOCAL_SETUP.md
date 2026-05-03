# One Touch IT Audit AI — Local Setup Guide

End-to-end steps to run the app on your local machine (macOS / Linux / Windows-WSL).

## 1. Prerequisites

| Tool     | Version   | Check                 |
| -------- | --------- | --------------------- |
| Python   | 3.11+     | `python3 --version`   |
| Node.js  | 20+       | `node --version`      |
| Yarn     | 1.22+     | `yarn --version`      |
| MongoDB  | 6.0+      | `mongod --version`    |

Optional: Redis 7+ (falls back to Mongo cache if not installed).

---

## 2. Unzip & enter the project

```bash
unzip one-touch-it-audit-ai.zip
cd one-touch-it-audit-ai
```

---

## 3. Start MongoDB

Any local Mongo is fine. Quickest option with Docker:

```bash
docker run -d --name audit-mongo -p 27017:27017 mongo:7
```

Or install natively (`brew install mongodb-community` / `apt install mongodb`) and run `mongod`.

---

## 4. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate                # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Create the env file
cp .env.example .env
# Then edit .env and fill in:
#   - JWT_SECRET   (generate: python -c "import secrets; print(secrets.token_urlsafe(48))")
#   - FERNET_KEY   (generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
#   - EMERGENT_LLM_KEY (optional — for AI Copilot; leave blank to use heuristic fallbacks)
```

Start the backend:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

On first boot the backend **auto-seeds** Mongo with 11 users, 50 controls, 20 entities,
20 risks, 5 audits, 90 days of score history, 6 CCM alerts, etc.

Verify:

```bash
curl http://localhost:8001/api/health
# → {"status":"ok","db":"connected"}
```

---

## 5. Frontend (React)

Open a **new terminal**:

```bash
cd frontend
cp .env.example .env       # REACT_APP_BACKEND_URL already points at http://localhost:8001
yarn install
yarn start
```

The app opens at **http://localhost:3000**.

---

## 6. Log in

| Role   | Email                    | Password     |
| ------ | ------------------------ | ------------ |
| Admin  | admin@auditai.com        | Admin@123    |
| CIO    | rohan.mehta@auditai.com  | Welcome@123  |
| CISO   | priya.iyer@auditai.com   | Welcome@123  |
| Auditor| karan.malhotra@auditai.com | Welcome@123 |

MFA enforcement is **disabled by default** — users log in with email + password only.
An Admin can re-enable it at `/admin/users` → *Authentication Settings*.

---

## 7. Features you can try immediately

- **CIO Command Center** (`/dashboard`) — 8 KPIs, 9-axis radar, risk heatmap, CIO AI Insights.
- **AI Insights** — every sidebar page (Identity, Compliance, Cloud, Vendors, …) has its own
  scope-specific *Insights / Recommendations / Action Items* panel at the top.
- **AI Copilot** (`/copilot`) — requires `EMERGENT_LLM_KEY`. Without it the UI still loads
  but replies come from a simple fallback.
- **Integrations** (`/admin/integrations`) — configure AWS / LDAP / ServiceNow / GitHub
  credentials (Fernet-encrypted at rest) and click *Test* / *Sync*.
- **Reports** (`/reports`) — downloads CIO PDF + Remediation Excel.
- **Real-time CCM Alerts** — WebSocket ticker fires a synthetic alert every 90-180 s.

---

## 8. Common issues

| Symptom                              | Fix                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `pymongo.errors.ServerSelectionTimeoutError` | Mongo isn't running or `MONGO_URL` in `backend/.env` is wrong.                       |
| `401 Unauthorized` after login       | `JWT_SECRET` changed after login — clear localStorage and log in again.                      |
| Frontend shows blank page            | `REACT_APP_BACKEND_URL` in `frontend/.env` must match the backend URL exactly (no trailing /). |
| AI Copilot says "LLM not configured" | Set `EMERGENT_LLM_KEY` in `backend/.env` and restart `uvicorn`.                              |
| Evidence upload fails                | Create `backend/uploaded_evidence/` — the directory must be writable.                        |

---

## 9. Running the test suite

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

---

## 10. Production tips (optional)

- Run the backend behind Gunicorn + Uvicorn workers:
  `gunicorn -k uvicorn.workers.UvicornWorker server:app -b 0.0.0.0:8001 -w 4`
- Build the frontend statically:
  `cd frontend && yarn build` → serve `frontend/build/` via Nginx / Caddy.
- Put Mongo, the API, and the static frontend behind a single reverse proxy with
  `/api/*` → :8001 and `/*` → the build output.
- Rotate `JWT_SECRET` and `FERNET_KEY` at least every 90 days.
