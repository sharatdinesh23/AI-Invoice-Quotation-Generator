# Pending Work Documentation

**Project:** AI Invoice Quotation Generator (Freelance Portal)  
**Last updated:** August 4, 2026  
**Repo:** `sharatdinesh23/AI-Invoice-Quotation-Generator`  
**Branch:** `main` (includes Phase A, Phase B, and leftovers)

---

## 1. Completion Snapshot

| Phase | Scope | Code Status | Production-Ready |
|-------|--------|-------------|------------------|
| **Phase A** | Payment routing / Razorpay Route | ~90% coded | Needs live Razorpay + migrations |
| **Phase B** | Project CRM + Gmail sync | ~85% coded | Needs migrations + Gmail connect |
| **Phase A/B leftovers** | Invoice pay toggle, admin gate, milestones, DnD | Done in code | Needs admin setup + migration |
| **Phase 3** | Advanced analytics | ~40% coded | Not started in full |
| **Gmail enhancements** | Beyond basic sync | ~35% coded | Partial |
| **Recurring expenses** | Automation | ~55% coded | Partial |
| **Receipt upload** | File storage + UI | ~25% coded | Mostly pending |

---

## 2. Manual Setup (Blocking — Do Before Production)

These are not code tasks; they block real money flow and CRM.

### 2.1 Database Migrations (run in Supabase SQL editor, in order)

| # | File | Purpose |
|---|------|---------|
| 1 | `database/EXECUTE_THIS.sql` | Payouts, payment splits, profile payment fields |
| 2 | `database/migration_phase_a_payment_routing.sql` | Column sync (`payment_integration_enabled` / legacy flags) |
| 3 | `database/migration_phase2_projects.sql` | `projects`, `platform_connections` (safe re-run) |
| 4 | `database/migration_phase_ab_leftovers.sql` | `is_admin`, invoice pay toggle, `project_milestones` |
| 5 | `database/migration_expense_tracker.sql` | Expenses + recurring expenses (if not run) |
| 6 | `database/migration_phase2.sql` | UTR / international wire fields (if not run) |

**Verify after run:**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'freelancing_demo' AND table_name = 'invoices'
AND column_name IN ('payment_integration_enabled', 'project_id', 'utr_number');
```

### 2.2 Environment Variables (backend `.env`)

| Variable | Status | Notes |
|----------|--------|-------|
| `SUPABASE_URL` | Required | |
| `SUPABASE_KEY` | Required | Anon key |
| `SUPABSE_SERVICE_KEY` | Required | Service role (typo preserved in code) |
| `RAZORPAY_KEY_ID` | Required | Live or test |
| `RAZORPAY_KEY_SECRET` | Required | |
| `RAZORPAY_WEBHOOK_SECRET` | **Pending setup** | Must match Razorpay Dashboard |
| `RAZORPAY_ROUTE_ENABLED` | Recommended | `true` |
| `PLATFORM_ADMIN_EMAILS` | **Pending setup** | Comma-separated admin emails |
| `ENCRYPTION_KEY` | Required | Gmail / platform token encryption |
| `GROQ_API_KEY` | Optional | AI overdue reminders |
| Google OAuth vars | Required for Gmail | Client ID/secret/redirect |

### 2.3 Razorpay Production (Manual)

| Task | Status | Owner |
|------|--------|-------|
| Enable **Razorpay Route** on merchant account | Pending | Contact Razorpay support |
| Create linked accounts for freelancers (KYC) | Partial | Auto via API; KYC in Razorpay Dashboard |
| Configure webhooks | Pending | Razorpay Dashboard |

**Webhook URLs to register:**

| Event | Endpoint |
|-------|----------|
| `payment.captured` | `https://YOUR_DOMAIN/api/webhooks/razorpay` |
| `transfer.processed` | `https://YOUR_DOMAIN/api/webhooks/razorpay-transfer` |
| `account.activated` | `https://YOUR_DOMAIN/api/payment-account/webhook` |

### 2.4 Platform Admin Setup

Commission Dashboard is admin-only. Enable one of:

```sql
UPDATE freelancing_demo.profiles SET is_admin = true WHERE user_id = 'YOUR_UUID';
```

Or in `.env`:

```
PLATFORM_ADMIN_EMAILS=admin@yourcompany.com
```

### 2.5 Deploy / Infra

| Task | Status |
|------|--------|
| Redeploy backend + frontend after latest `main` | Pending if EC2 not updated |
| Point frontend API from `127.0.0.1:8000` to production URL | **Pending** (`frontend/src/api.js`) |
| CORS: add production domain in `backend/main.py` | Verify |
| Run migrations on **production** Supabase | Pending |

---

## 3. Phase A — Payment Routing (Remaining)

### Done in Code

- Razorpay Route linked account creation
- Split math + `account_transfers` on orders
- Webhook → auto payout ledger (idempotent)
- Per-invoice **Enable online payment** toggle
- Commission Dashboard (admin) + retry payout + manual UTR settle
- Payment Settings UI

### Still Pending

| Item | Type | Priority | Notes |
|------|------|----------|-------|
| Live Razorpay Route activation | Manual | **Critical** | Code calls API; account must have Route enabled |
| Webhook configuration | Manual | **Critical** | Without this, auto settlement won't complete |
| End-to-end payment test (test mode) | QA | **High** | Invoice → pay → split → transfer webhook |
| Refund flow | Code | Medium | Not implemented |
| Failed transfer auto-retry (cron) | Code | Medium | Manual retry API exists; no scheduler |
| Email notify on payout failed/completed | Code | Medium | Not implemented |
| International payout via Stripe (`stripe_account_id` column) | Code | Low | Schema hint only; no implementation |
| Hardcoded `localhost` in PDF send path | Bug | Medium | `main.py` ~line 1361 uses `http://localhost:8000` |

---

## 4. Phase B — Project / CRM (Remaining)

### Done in Code

- `projects` + `platform_connections` tables (migration)
- Kanban board (5 columns) + HTML5 drag-and-drop
- Gmail parsing engine (budget, links, dedup by `gmail_message_id`)
- Background sync every 6 hours
- Platform API credential storage (encrypted)
- Project ↔ invoice linking
- Milestones CRUD + create invoice from milestone
- Project detail side panel

### Still Pending

| Item | Type | Priority | Notes |
|------|------|----------|-------|
| Run `migration_phase2_projects.sql` + `migration_phase_ab_leftovers.sql` | Manual | **High** | Required for milestones |
| Real **Upwork API** integration | Code + Partner | Medium | Stub only; Gmail is primary source |
| Real **Fiverr API** integration | Code + Partner | Medium | Stub only |
| OAuth flow for Upwork/Fiverr (not just API keys) | Code | Medium | |
| Gmail connect in Settings (user action) | Manual | **High** | Required for sync |
| Invoice mention parsing from email body (AI) | Code | Medium | Subject/keyword only today |
| Payment reminder detection from inbox | Code | Medium | Not built |
| Project timeline / Gantt view | UI | Low | |
| Milestone edit/delete in UI | UI | Low | API exists; UI only has add + invoice |
| Platform-wise earnings report | Code | Low | |

---

## 5. Phase 3 — Advanced Analytics (Not Started in Full)

### Done (~40%)

- `/api/expenses/analytics`, `/api/profit-loss`
- `Analytics.jsx`: summary cards, category bars, monthly expense list
- Section 44ADA tax estimator (basic slabs)
- CSV export (client-side P&L)

### Pending

| Item | Priority | Notes |
|------|----------|-------|
| **Revenue trend charts** (monthly line/bar) | High | No chart library installed |
| **Client-wise revenue** breakdown | High | No API or UI |
| **Platform-wise earnings** (Upwork/Fiverr/manual) | Medium | |
| **Profit & Loss chart** visualization | Medium | Numbers only today |
| **PDF export** for financial reports | Medium | Invoice PDF exists; not analytics |
| Wire **tax regime toggle** (new vs old) | Medium | UI exists; logic ignores `taxRegime` |
| Receivables aging report | Low | |
| Install chart library (e.g. Recharts) | High | `package.json` has no chart dep |

---

## 6. Gmail Integration (Remaining)

### Done

- OAuth connect / disconnect
- Send invoice with PDF attachment (Pro)
- Groq AI overdue reminders (daily 9 AM cron)
- Project auto-create from inbox (manual + 6h background)

### Pending

| Item | Priority |
|------|----------|
| Parse invoice/payment mentions from email **body** (not just subject) | Medium |
| Auto-create **invoices** from payment confirmation emails | Medium |
| Incoming mail **payment reminder** detection | Medium |
| Groq parsing for unstructured emails | Low |
| Gmail push notifications (Pub/Sub) vs polling | Low |

---

## 7. Recurring Expenses (Remaining)

### Done

- `recurring_expenses` table + CRUD API
- `RecurringExpenses.jsx` UI
- Manual **Process Due** button

### Pending

| Item | Priority |
|------|----------|
| **APScheduler cron** for auto-processing (like recurring invoices) | High |
| Email/in-app notification when expense auto-created | Medium |
| Support weekly/yearly frequency properly in date math | Low | Currently +30 days only |
| `is_active` toggle in UI | Low |

---

## 8. Receipt Upload (Remaining)

### Done

- `POST /api/expenses/upload-receipt` (base64 → DB)
- `receipt_url` column on expenses
- `uploadExpenseReceipt` in `api.js`

### Pending

| Item | Priority |
|------|----------|
| **Supabase Storage** or S3 (replace inline base64) | High |
| File picker + preview in `Expenses.jsx` | High |
| Wire `uploadExpenseReceipt` from expense form | High |
| Attach receipts in expense reports / PDF | Medium |
| OCR on receipts (optional) | Low |

---

## 9. Infrastructure, Docs, and Polish

| Item | Priority | Notes |
|------|----------|-------|
| Replace README (still Vite template) | Medium | |
| Single **MIGRATION_RUNBOOK.md** with ordered steps | Medium | Migrations scattered |
| Add `__pycache__/` to `.gitignore` | Low | Was committed then removed |
| Frontend API base URL from env (`VITE_API_URL`) | **High** | Hardcoded `127.0.0.1:8000` |
| E2E / integration tests | Low | None today |
| Rate limiting on public payment endpoints | Medium | Security |
| Webhook idempotency keys (explicit store) | Medium | Partial via DB checks |

---

## 10. Future / Low Priority (from Original Plan)

| Module | Status |
|--------|--------|
| Subscription tiers (Free / Pro / Enterprise) | Pro only today |
| Usage limits (invoices/month) | Not built |
| Trial period + dunning | Not built |
| Multi-currency settlement reporting | Partial |
| Mobile-responsive audit | Not done |
| Dark mode consistency pass | Partial |

---

## 11. Recommended Execution Order

```
1. Run all DB migrations (Section 2.1)
2. Configure .env + PLATFORM_ADMIN_EMAILS (Section 2.2–2.4)
3. Enable Razorpay Route + webhooks (Section 2.3)
4. Fix VITE_API_URL + redeploy (Section 9)
5. E2E test: invoice with pay toggle → client pays → admin sees commission
6. Connect Gmail → test project sync
7. Phase 3: charts + client revenue + PDF export
8. Recurring expenses cron + receipt upload UI
```

---

## 12. Quick Reference — Migration Files

```
database/
├── EXECUTE_THIS.sql                   ← payments / splits
├── migration_phase_a_payment_routing.sql
├── migration_phase2_projects.sql      ← CRM (re-run safe)
├── migration_phase_ab_leftovers.sql   ← admin, milestones, invoice toggle
├── migration_expense_tracker.sql      ← expenses
├── migration_phase2.sql               ← UTR / international
├── migration_phase1.sql               ← older; may overlap EXECUTE_THIS
└── migration_expenses.sql             ← older expense schema
```

---

## 13. Key API Endpoints (Implemented vs Pending)

### Implemented

| Endpoint | Purpose |
|----------|---------|
| `POST /api/payment-account/connect` | Razorpay Route linked account |
| `POST /api/invoices/{id}/create-payment-order` | Split payment order |
| `POST /api/webhooks/razorpay` | Payment capture + payout ledger |
| `GET /api/admin/platform-transactions` | Admin commission ledger |
| `POST /api/invoices/{id}/retry-payout` | Retry failed Route transfer |
| `POST /api/projects/sync-gmail` | Gmail → CRM projects |
| `GET /api/projects/{id}` | Project + milestones + invoices |
| `GET /api/me/context` | Admin flag + payment readiness |

### Pending / Not Built

| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics/revenue-trends` | Monthly revenue chart data |
| `GET /api/analytics/client-revenue` | Per-client breakdown |
| `GET /api/analytics/export-pdf` | P&L PDF report |
| `POST /api/expenses/upload-receipt` (storage) | Needs Supabase Storage bucket |
| Upwork/Fiverr OAuth callbacks | Real platform sync |
