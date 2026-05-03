# PRD: One Touch IT Audit AI

## Original Problem Statement
Build a production-grade, AI-powered IT Audit Command Center for CIOs/CISOs/Auditors of Indian enterprises. The app must answer 5 CIO questions instantly:
1. Are we audit-ready today?
2. What are the top IT risks right now?
3. Which systems/vendors/users are creating the highest risk?
4. What is the business and financial impact?
5. What should be fixed first, by whom, and by when?

Spec called for FastAPI + Postgres + Redis + Celery + MinIO + Docker + k8s. Adapted to Emergent stack: **FastAPI + MongoDB + React** with simpler equivalents (FastAPI BackgroundTasks instead of Celery, local file storage instead of MinIO, in-process scheduling).

## Tech Stack
- Backend: FastAPI, MongoDB (motor), JWT, bcrypt, ReportLab (PDF), openpyxl (Excel)
- AI: Claude Sonnet 4.5 via Emergent Universal Key (`emergentintegrations`)
- Frontend: React 19, Tailwind, Shadcn UI, Recharts, lucide-react, Phosphor
- Design: Swiss/Bloomberg-Terminal aesthetic (Chivo + IBM Plex Sans), Zinc monochrome + functional semantic colors, sharp 1px borders, dense data grids

## Personas
- CIO / Board Viewer — read-only executive dashboards
- CISO — cyber posture, identity, cloud risks
- IT Head / App Owner — remediation execution
- Auditor — full audit lifecycle
- Compliance Officer — frameworks, policies, evidence
- Admin — user management

## Implemented (v1.0 — Feb 2026)
### Phase 1 — Foundation
- JWT auth with bcrypt, lockout after 5 failures, role-based RBAC (8 roles, permission JSON)
- Mongo schema + idempotent seed: 11 users, 5 depts, 50 controls (cross-mapped to 8 frameworks), 20 entities, 15 apps, 30 assets, 10 vendors, 20 risks, 20 observations, 15 remediations, 10 policies, 5 audits, 30 days IAM snapshots, 90 days score history, 6 CCM alerts

### Phase 2 — CIO Dashboard Suite
- Enterprise score engine (9-axis, weighted)
- CIO Home: 8 KPIs + 9-axis radar + 5×5 risk heatmap + framework readiness bar + top 10 risks + business impact + AI anomalies + 90-day trend
- Identity Dashboard (dormant/orphan/MFA/SoD + trends)
- Compliance (radar, framework cards, regulatory deadlines, cross-framework reuse)
- Application Risk (vuln stacks, sensitivity-vs-vuln scatter)
- Cloud (AWS/Azure/GCP tabs, FinOps leakage)
- Vendor Risk (sortable register)
- Remediation Tracker (severity bands, owner leaderboard, top overdue)

### Phase 3 — Audit Workflow
- Audit lifecycle CRUD + create
- Control library (filter by category × framework, search)
- Risk register + AI Prioritizer (board-ready P1-P10 cards with rupee exposure + urgency)
- Observations: state machine (9 statuses, transitions enforced), drawer with AI remediation plan accordion
- Evidence upload + SHA-256 hash + AI sufficiency validation (relevance/completeness/freshness)
- Reports: CIO Summary PDF (ReportLab), Remediation Excel (openpyxl)

### Phase 4 — AI Layer
- AI Copilot: intent-aware context retrieval + Claude Sonnet 4.5; conversation history; suggested questions; sources displayed
- AI Risk Prioritizer (top 10 → board-ready)
- AI Remediation Advisor (immediate / short-term / long-term / validation)
- AI Evidence Validator
- AI Policy Gap Analysis
- Anomaly detection (score deltas + IAM changes + CCM)
- Audit narrative generator

### Phase 5 — Hardening (light)
- Notifications (drawer + page, mark-read), mock unread counter polling
- CCM alerts list + acknowledge
- Analytics (90d trend, readiness prediction, control failure patterns, dept ranking)
- Admin user management
- Light/dark theme toggle persisted; security headers on all responses

## Deferred (P1 backlog)
- ~~True WebSocket push for CCM alerts~~ ✅ done in v1.1 (Feb 2026)
- ~~MFA/TOTP enforcement screen~~ ✅ done in v1.1
- ~~Real LDAP / AWS / GitHub / ServiceNow connector implementations~~ ✅ done in v1.1 (test-connection real, batch-fetch deferred)
- ~~pgvector RAG~~ → ✅ TF-IDF cosine RAG over Mongo in v1.1 (lightweight, no model download)
- ~~Prometheus /metrics endpoint~~ ✅ done in v1.1
- ~~Refine cybersecurity sub-score formula~~ ✅ done in v1.1 (per-app density + floor at 30)
- Celery/Redis async (currently FastAPI BackgroundTasks + asyncio.create_task for CCM ticker)
- Field-level Fernet encryption for vendor auth_config
- k8s manifests + CI/CD pipeline
- Backup task

## Implemented in v1.4 (Feb 2026)
- **Universal AI Insights** across every sidebar page: 14 scope-specific builders (cio, identity, compliance, applications, cloud, vendors, remediation, risks, observations, audits, controls, evidence, policies, analytics) behind `GET /api/dashboard/insights/{scope}`. Each returns `{mode, generated_at, insights[], recommendations[], action_items[]}` tailored to the page's domain (e.g. Identity surfaces MFA coverage + SoD; Cloud surfaces public buckets + encryption gaps; Vendors surfaces DPA signings).
- Generic `<InsightsSection scope=... />` React component powers all pages. Theme matches the dashboard (light `crt-card` palette).
- CIO Dashboard: AI Insights section **pinned to top** (right under PageHeader, above the 8-KPI row).

## Implemented in v1.3 (Feb 2026)
- **CIO AI Insights section** on the CIO Dashboard: 3-column layout (Insights · Recommendations · Action Items) driven by `/api/dashboard/cio-insights` → `insights.build_insights()`. Heuristic engine derives exposure totals, SLA breaches, category hotspots, MFA coverage, SoD & public-bucket risks. LLM augmentation hook reserved behind `LLM_PAUSED` flag.
- **Admin-togglable MFA enforcement**: Added `system_settings` Mongo collection + `settings_store.py`. New admin endpoints `GET/PATCH /api/admin/settings` (Admin-only). Login flow now checks `mfa_enforcement_enabled` globally AND role before issuing an MFA challenge. Default: **DISABLED** — all users log in with email + password only; TOTP code path, secrets, and `/auth/mfa/*` endpoints remain intact.
- UI: new "Authentication Settings" card on /admin/users with a Switch to flip MFA enforcement live.

## Implemented in v1.2 (Feb 2026)
- **Real connector batch-sync**: AWS sync (boto3 — S3 public-access-block + bucket encryption + IAM unused keys + EC2 SG misconfigs → upserts cloud_audit_results), LDAP sync (ldap3 → upserts iam_snapshots), ServiceNow + GitHub stub sync. New POST /api/admin/integrations/{id}/sync (Admin/CIO/CISO only). Frontend: Sync button on each integration card.
- **Redis-or-Mongo cache** (`cache.py`): unified setex/get/delete API. Uses Redis if `REDIS_URL` set + reachable, else falls back to Mongo `kv_cache` collection with TTL index + process-local LRU. MFA challenges migrated off in-memory dict.
- **Field-level Fernet encryption** (`crypto.py`): encrypts every string in integration `auth_config` with `fernet:v1:` prefix at rest. List endpoint masks all values to `••• set` for UI (never returns raw or encrypted to client). PATCH merges + skips masked placeholder values + idempotent re-encryption.
- Integration_logs now carry `operation` field (`test` / `sync`)
- /health/deep exposes cache mode + fernet status

## Implemented in v1.1 (Feb 2026)
- TOTP MFA enrollment + verification (`pyotp`); enforced for CIO / CISO / Admin roles
- Three-stage Login flow: credentials → mfa-setup (with QR + base32 secret) → mfa-verify
- WebSocket `/api/ws/alerts` (JWT auth via query param), in-process CCM ticker fires synthetic alerts every 90-180s, frontend toast on receipt
- Real connector test-connection: AWS (boto3 list_buckets), LDAP/AD (ldap3 bind), ServiceNow (REST GET incident), GitHub (REST GET /user)
- Integrations admin page: 5 cards with Configure dialog (auth_config schema-driven by detected kind) + Test button (live result toast) + last_sync_status badge + integration_logs trail
- Embeddings module: TF-IDF tokenisation + cosine similarity over `embeddings` Mongo collection (~63 docs: controls + observations + policies); reindexed on startup; injected into Copilot RAG
- Prometheus /api/metrics endpoint with counters (api_requests_total, api_latency_seconds, llm_calls_total, ccm_alerts_fired_total, active_websocket_connections)
- Cybersecurity sub-score: per-app vulnerability density formula with min floor 30 (was bottoming at 0)

## Next Tasks
- P2: Real connector batch-sync (currently only test-connection); upsert into iam_snapshots / cloud_audit_results / observations
