# Supabase Migration Runbook

This document provides step-by-step instructions for executing all database migrations required for the **AI Invoice Quotation Generator** portal.

---

## Migration Execution Order

Run the following SQL files in your **Supabase SQL Editor** strictly in order:

| Step | Migration File | Purpose |
|------|---------------|---------|
| 1 | `database/EXECUTE_THIS.sql` | Core payouts, payment splits, profiles, payment integration fields |
| 2 | `database/migration_phase_a_payment_routing.sql` | Sync payment integration flags (`payment_integration_enabled`) |
| 3 | `database/migration_phase2_projects.sql` | Project CRM (`projects`, `project_milestones`, `platform_connections`) |
| 4 | `database/migration_phase_ab_leftovers.sql` | Admin gate (`is_admin`), per-invoice payment toggle (`payment_integration_enabled`) |
| 5 | `database/migration_expense_tracker.sql` | Expense tracking, expense categories, recurring expenses |
| 6 | `database/migration_phase2.sql` | UTR settlement fields and international payout columns |

---

## Verification SQL

After running all migrations, verify your schema by executing this query in Supabase:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'freelancing_demo' 
  AND table_name = 'invoices'
  AND column_name IN ('payment_integration_enabled', 'project_id', 'utr_number', 'payout_status', 'razorpay_payment_id');
```

Expect 5 rows returned.

---

## Admin Role Verification

To grant a user Platform Admin permissions:

```sql
UPDATE freelancing_demo.profiles 
SET is_admin = true 
WHERE user_id = 'YOUR_USER_UUID';
```
Or set `PLATFORM_ADMIN_EMAILS=your.email@example.com` in your `backend/.env`.
