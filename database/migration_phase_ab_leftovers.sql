-- Phase A + B leftovers migration (freelancing_demo)
-- Safe to re-run

-- Admin flag for platform commission dashboard
ALTER TABLE freelancing_demo.profiles
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Invoice online payment toggle (per-invoice)
ALTER TABLE freelancing_demo.invoices
    ADD COLUMN IF NOT EXISTS payment_integration_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES freelancing_demo.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON freelancing_demo.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_enabled ON freelancing_demo.invoices(payment_integration_enabled);

-- Project milestones
CREATE TABLE IF NOT EXISTS freelancing_demo.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES freelancing_demo.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'invoiced')),
    invoice_id UUID REFERENCES freelancing_demo.invoices(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON freelancing_demo.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON freelancing_demo.project_milestones(user_id);

ALTER TABLE freelancing_demo.project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own milestones" ON freelancing_demo.project_milestones;
CREATE POLICY "Users manage own milestones" ON freelancing_demo.project_milestones
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON freelancing_demo.project_milestones TO authenticated;

COMMENT ON COLUMN freelancing_demo.profiles.is_admin IS 'Platform owner — access commission dashboard across all freelancers';
COMMENT ON COLUMN freelancing_demo.invoices.payment_integration_enabled IS 'Show Razorpay pay button on public portal for this invoice';
COMMENT ON COLUMN freelancing_demo.invoices.project_id IS 'Optional link to CRM project';
