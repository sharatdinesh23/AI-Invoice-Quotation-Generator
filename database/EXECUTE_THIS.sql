-- Migration for RazorpayX Payment Routing & Commission System
-- Schema: freelancing_demo

-- 1. Add payment routing fields to profiles table
ALTER TABLE freelancing_demo.profiles 
ADD COLUMN IF NOT EXISTS razorpay_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_integration_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS payout_destination_type VARCHAR(20) DEFAULT 'bank', -- 'bank' or 'upi'
ADD COLUMN IF NOT EXISTS payout_destination_value TEXT; -- Bank Account JSON or UPI ID

-- 2. Create payouts tracking table
CREATE TABLE IF NOT EXISTS freelancing_demo.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freelancer_id UUID REFERENCES freelancing_demo.profiles(id),
    invoice_id UUID REFERENCES freelancing_demo.invoices(id),
    amount DECIMAL(10,2),
    commission_amount DECIMAL(10,2),
    net_payout DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    payout_reference VARCHAR(255), -- RazorpayX Payout ID
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create payment splits tracking table
CREATE TABLE IF NOT EXISTS freelancing_demo.payment_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES freelancing_demo.invoices(id),
    total_amount DECIMAL(10,2),
    commission_percentage DECIMAL(5,2),
    commission_amount DECIMAL(10,2),
    freelancer_amount DECIMAL(10,2),
    split_status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed
    razorpay_split_id VARCHAR(255), -- Razorpay Split Payment ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payouts_freelancer ON freelancing_demo.payouts(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_invoice ON freelancing_demo.payouts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON freelancing_demo.payouts(status);
CREATE INDEX IF NOT EXISTS idx_splits_invoice ON freelancing_demo.payment_splits(invoice_id);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE freelancing_demo.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancing_demo.payment_splits ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for payouts
-- Freelancers can view their own payouts
CREATE POLICY "Freelancers can view own payouts" ON freelancing_demo.payouts
    FOR SELECT USING (auth.uid() = freelancer_id);

-- System/Service role can insert/update payouts (handled in backend)
CREATE POLICY "System can manage payouts" ON freelancing_demo.payouts
    FOR ALL USING (true); -- Restrict this in production to specific service roles if needed

-- 7. RLS Policies for payment_splits
-- Freelancers can view splits related to their invoices
CREATE POLICY "Freelancers can view own splits" ON freelancing_demo.payment_splits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM freelancing_demo.invoices i 
            WHERE i.id = invoice_id AND i.user_id = auth.uid()
        )
    );

-- System can manage splits
CREATE POLICY "System can manage splits" ON freelancing_demo.payment_splits
    FOR ALL USING (true);

-- 8. Grant permissions to authenticated users
GRANT SELECT ON freelancing_demo.payouts TO authenticated;
GRANT SELECT ON freelancing_demo.payment_splits TO authenticated;
GRANT INSERT, UPDATE ON freelancing_demo.payouts TO authenticated; -- Limited via RLS
GRANT INSERT, UPDATE ON freelancing_demo.payment_splits TO authenticated; -- Limited via RLS

COMMENT ON COLUMN freelancing_demo.profiles.commission_percentage IS 'Platform commission % charged from freelancer (default 2%)';
COMMENT ON COLUMN freelancing_demo.profiles.payout_destination_type IS 'Type of payout destination: bank or upi';
COMMENT ON COLUMN freelancing_demo.profiles.payout_destination_value IS 'JSON for bank details {account_number, ifsc, name} or UPI ID string';
