-- Expense Tracking Module Database Migration
-- Execute this in your Supabase SQL Editor
-- Adds comprehensive expense tracking for freelancers

-- ============================================================================
-- 1. CREATE expenses TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  expense_date DATE NOT NULL,
  payment_method TEXT, -- Cash, Card, UPI, Bank Transfer, etc.
  receipt_url TEXT,
  receipt_image BYTEA,
  vendor_name TEXT,
  vendor_gstin TEXT,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  is_tax_deductible BOOLEAN DEFAULT TRUE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed', -- completed, pending, reimbursable
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- ============================================================================
-- 2. CREATE expense_categories TABLE (for standardized categories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_category TEXT,
  color_code TEXT DEFAULT '#6B7280',
  icon_name TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON expense_categories(user_id);

-- ============================================================================
-- 3. SEED default expense categories
-- ============================================================================

INSERT INTO expense_categories (name, parent_category, color_code, icon_name, is_default) VALUES
('Software & Subscriptions', NULL, '#3B82F6', 'computer', TRUE),
('Hosting & Domain', 'Software & Subscriptions', '#60A5FA', 'server', TRUE),
('Development Tools', 'Software & Subscriptions', '#93C5FD', 'code', TRUE),
('Design Tools', 'Software & Subscriptions', '#A78BFA', 'palette', TRUE),
('Office Supplies', NULL, '#10B981', 'office', TRUE),
('Hardware & Equipment', NULL, '#F59E0B', 'device', TRUE),
('Marketing & Advertising', NULL, '#EF4444', 'megaphone', TRUE),
('Social Media Ads', 'Marketing & Advertising', '#F87171', 'users', TRUE),
('Google Ads', 'Marketing & Advertising', '#FB923C', 'search', TRUE),
('Professional Services', NULL, '#8B5CF6', 'briefcase', TRUE),
('Legal & Accounting', 'Professional Services', '#A78BFA', 'scale', TRUE),
('Consulting', 'Professional Services', '#C4B5FD', 'users', TRUE),
('Travel & Transportation', NULL, '#06B6D4', 'airplane', TRUE),
('Meals & Entertainment', NULL, '#F97316', 'coffee', TRUE),
('Utilities', NULL, '#64748B', 'bolt', TRUE),
('Internet & Phone', 'Utilities', '#94A3B8', 'phone', TRUE),
('Electricity', 'Utilities', '#CBD5E1', 'lightbulb', TRUE),
('Rent & Workspace', NULL, '#EC4899', 'home', TRUE),
('Insurance', NULL, '#14B8A6', 'shield', TRUE),
('Education & Training', NULL, '#84CC16', 'book', TRUE),
('Courses', 'Education & Training', '#A3E635', 'graduation-cap', TRUE),
('Books & Resources', 'Education & Training', '#BEF264', 'book-open', TRUE),
('Bank Fees & Charges', NULL, '#6366F1', 'bank', TRUE),
('Taxes & Licenses', NULL, '#F43F5E', 'document', TRUE),
('Other', NULL, '#737373', 'dots', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on expenses table
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

-- Users can only view their own expenses
CREATE POLICY "Users can view own expenses"
ON expenses FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own expenses
CREATE POLICY "Users can insert own expenses"
ON expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own expenses
CREATE POLICY "Users can update own expenses"
ON expenses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own expenses
CREATE POLICY "Users can delete own expenses"
ON expenses FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all expenses
DROP POLICY IF EXISTS "Service role can manage expenses" ON expenses;
CREATE POLICY "Service role can manage expenses"
ON expenses FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 5. RLS for expense_categories
-- ============================================================================

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Users can manage own expense categories" ON expense_categories;

-- Everyone can view default categories and their own
CREATE POLICY "Users can view expense categories"
ON expense_categories FOR SELECT
USING (is_default = TRUE OR auth.uid() = user_id);

-- Users can manage their own custom categories
CREATE POLICY "Users can manage own expense categories"
ON expense_categories FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all categories
DROP POLICY IF EXISTS "Service role can manage categories" ON expense_categories;
CREATE POLICY "Service role can manage categories"
ON expense_categories FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 6. CREATE helper functions
-- ============================================================================

-- Function to get expense summary by category
CREATE OR REPLACE FUNCTION get_expense_summary_by_category(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  average_amount DECIMAL(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.category,
    SUM(e.amount) as total_amount,
    COUNT(*)::BIGINT as transaction_count,
    AVG(e.amount) as average_amount
  FROM expenses e
  WHERE e.user_id = auth.uid()
    AND (start_date IS NULL OR e.expense_date >= start_date)
    AND (end_date IS NULL OR e.expense_date <= end_date)
  GROUP BY e.category
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get monthly expense trends
CREATE OR REPLACE FUNCTION get_monthly_expense_trends(
  months INTEGER DEFAULT 12
)
RETURNS TABLE (
  month TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('month', (CURRENT_DATE - (i * INTERVAL '1 month'))), 'YYYY-MM') as month,
    COALESCE(SUM(e.amount), 0) as total_amount,
    COUNT(e.id)::BIGINT as transaction_count
  FROM generate_series(0, months - 1) i
  LEFT JOIN expenses e ON 
    DATE_TRUNC('month', e.expense_date) = DATE_TRUNC('month', (CURRENT_DATE - (i * INTERVAL '1 month')))
    AND e.user_id = auth.uid()
  GROUP BY i, month
  ORDER BY i DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate profit (revenue - expenses)
CREATE OR REPLACE FUNCTION calculate_profit_loss(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_revenue DECIMAL(12,2),
  total_expenses DECIMAL(12,2),
  net_profit DECIMAL(12,2),
  profit_margin DECIMAL(5,2)
) AS $$
DECLARE
  revenue_sum DECIMAL(12,2);
  expense_sum DECIMAL(12,2);
BEGIN
  -- Calculate total revenue from paid invoices
  SELECT COALESCE(SUM(amount), 0) INTO revenue_sum
  FROM invoices
  WHERE user_id = auth.uid()
    AND status = 'Paid'
    AND (start_date IS NULL OR created_at >= start_date)
    AND (end_date IS NULL OR created_at <= end_date);
  
  -- Calculate total expenses
  SELECT COALESCE(SUM(amount), 0) INTO expense_sum
  FROM expenses
  WHERE user_id = auth.uid()
    AND (start_date IS NULL OR expense_date >= start_date)
    AND (end_date IS NULL OR expense_date <= end_date);
  
  net_profit := revenue_sum - expense_sum;
  
  IF revenue_sum > 0 THEN
    profit_margin := ROUND((net_profit / revenue_sum * 100), 2);
  ELSE
    profit_margin := 0;
  END IF;
  
  total_revenue := revenue_sum;
  total_expenses := expense_sum;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. CREATE trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. VERIFICATION QUERIES
-- ============================================================================

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'freelancing_demo' AND table_name IN ('expenses', 'expense_categories');

-- Verify default categories
-- SELECT name, color_code FROM expense_categories WHERE is_default = TRUE LIMIT 10;

-- Test profit calculation function
-- SELECT * FROM calculate_profit_loss();
