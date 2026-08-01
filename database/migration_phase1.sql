-- Phase 1: Payment Routing Database Migration
-- Execute this in your Supabase SQL Editor
-- This script adds support for RazorpayX Route payment routing with configurable commission

-- ============================================================================
-- 1. UPDATE profiles TABLE
-- ============================================================================

-- Add commission and payment routing fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_account_status TEXT DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS enable_payment_integration BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS upi_id TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
ADD COLUMN IF NOT EXISTS pan_number TEXT,
ADD COLUMN IF NOT EXISTS razorpay_onboard_url TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_razorpay_account_id ON profiles(razorpay_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_enable_payment ON profiles(enable_payment_integration);

-- ============================================================================
-- 2. UPDATE invoices TABLE
-- ============================================================================

-- Track payment integration status per invoice
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_integration_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS platform_commission_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS freelancer_payout_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payout_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS payout_failure_reason TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_enabled ON invoices(payment_integration_enabled);
CREATE INDEX IF NOT EXISTS idx_invoices_payout_status ON invoices(payout_status);

-- ============================================================================
-- 3. CREATE payouts TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  transfer_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, reversed
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payouts
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_invoice_id ON payouts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);

-- ============================================================================
-- 4. CREATE commission_transactions TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for commission_transactions
CREATE INDEX IF NOT EXISTS idx_commission_user_id ON commission_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_invoice_id ON commission_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_commission_created_at ON commission_transactions(created_at DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

-- Payouts policies: Users can only see their own payouts
DROP POLICY IF EXISTS "Users can view own payouts" ON payouts;
CREATE POLICY "Users can view own payouts"
ON payouts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage payouts" ON payouts;
CREATE POLICY "Service role can manage payouts"
ON payouts FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Commission transactions policies: Users can only see their own commissions
DROP POLICY IF EXISTS "Users can view own commissions" ON commission_transactions;
CREATE POLICY "Users can view own commissions"
ON commission_transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage commissions" ON commission_transactions;
CREATE POLICY "Service role can manage commissions"
ON commission_transactions FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 6. UPDATE existing RLS on profiles for new columns
-- ============================================================================

-- Ensure users can update their own payment settings
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. CREATE helper function to calculate commission
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_payout_amount(
  total_amount DECIMAL(10,2),
  commission_pct DECIMAL(5,2)
)
RETURNS TABLE(
  commission_amount DECIMAL(10,2),
  payout_amount DECIMAL(10,2)
) AS $$
BEGIN
  commission_amount := ROUND((total_amount * commission_pct / 100), 2);
  payout_amount := ROUND((total_amount - commission_amount), 2);
  RETURN QUERY SELECT commission_amount, payout_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. SEED default commission percentage for existing users
-- ============================================================================

-- Set default 2% commission for all existing profiles
UPDATE profiles 
SET commission_percentage = 2.00 
WHERE commission_percentage IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (Uncomment to run)
-- ============================================================================

-- Verify new columns exist
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- AND column_name IN ('commission_percentage', 'razorpay_account_id', 'enable_payment_integration')
-- ORDER BY ordinal_position;

-- Verify new tables exist
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'freelancing_demo' AND table_name IN ('payouts', 'commission_transactions');

-- Sample payout query
-- SELECT * FROM payouts LIMIT 5;

-- Sample commission query
-- SELECT * FROM commission_transactions LIMIT 5;
