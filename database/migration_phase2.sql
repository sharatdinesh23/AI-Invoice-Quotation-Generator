-- Phase 2: Payment Lifecycle, UTR Settlement & International Client Migration
-- Execute this in your Supabase SQL Editor (freelancing_demo schema or public)

-- ============================================================================
-- 1. UPDATE invoices TABLE FOR UTR & SETTLEMENT
-- ============================================================================

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS utr_number TEXT,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending', -- pending, processing, settled, failed
ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS international_payment_method TEXT; -- stripe, paypal, swift_wire, wise

CREATE INDEX IF NOT EXISTS idx_invoices_utr_number ON invoices(utr_number);
CREATE INDEX IF NOT EXISTS idx_invoices_settlement_status ON invoices(settlement_status);

-- ============================================================================
-- 2. UPDATE profiles TABLE FOR INTERNATIONAL BANKING & GATEWAYS
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS swift_code TEXT,
ADD COLUMN IF NOT EXISTS iban_number TEXT,
ADD COLUMN IF NOT EXISTS routing_number TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_country TEXT DEFAULT 'IN',
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- ============================================================================
-- 3. UPDATE payouts TABLE FOR UTR
-- ============================================================================

ALTER TABLE payouts
ADD COLUMN IF NOT EXISTS utr_number TEXT;

CREATE INDEX IF NOT EXISTS idx_payouts_utr_number ON payouts(utr_number);

-- ============================================================================
-- 4. UPDATE existing invoices status
-- ============================================================================

UPDATE invoices
SET status = 'Completed', settlement_status = 'settled'
WHERE status = 'Paid' AND (payout_status = 'completed' OR payout_transfer_id IS NOT NULL);
