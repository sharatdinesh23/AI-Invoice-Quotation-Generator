-- Phase A: Payment routing column sync (freelancing_demo schema)
-- Run in Supabase SQL editor after EXECUTE_THIS.sql / migration_phase1.sql

-- Align both boolean flags used across migrations
ALTER TABLE freelancing_demo.profiles
ADD COLUMN IF NOT EXISTS payment_integration_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enable_payment_integration BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS razorpay_account_status TEXT DEFAULT 'not_connected';

-- Mirror values when only one column was populated historically
UPDATE freelancing_demo.profiles
SET payment_integration_enabled = COALESCE(payment_integration_enabled, enable_payment_integration, FALSE),
    enable_payment_integration = COALESCE(enable_payment_integration, payment_integration_enabled, FALSE)
WHERE payment_integration_enabled IS DISTINCT FROM enable_payment_integration
   OR payment_integration_enabled IS NULL
   OR enable_payment_integration IS NULL;

-- Invoice routing + transfer tracking
ALTER TABLE freelancing_demo.invoices
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS platform_commission_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS freelancer_payout_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payout_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS utr_number TEXT,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- Payout ledger UTR (used by auto Route settlement webhooks)
ALTER TABLE freelancing_demo.payouts
ADD COLUMN IF NOT EXISTS utr_number TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_razorpay_account ON freelancing_demo.profiles(razorpay_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_payment ON freelancing_demo.invoices(razorpay_payment_id);

COMMENT ON COLUMN freelancing_demo.profiles.payment_integration_enabled IS 'Primary flag: freelancer opted into Razorpay Route split payouts';
COMMENT ON COLUMN freelancing_demo.profiles.enable_payment_integration IS 'Legacy alias kept in sync with payment_integration_enabled';
