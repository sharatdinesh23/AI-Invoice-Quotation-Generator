-- Expense Tracking Module Migration
-- Schema: freelancing_demo

-- 1. Expense Categories Table
CREATE TABLE IF NOT EXISTS freelancing_demo.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for UI
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Expenses Table
CREATE TABLE IF NOT EXISTS freelancing_demo.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES freelancing_demo.expense_categories(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT NOT NULL,
    vendor_name VARCHAR(255),
    invoice_number VARCHAR(100),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50), -- Cash, Card, UPI, Bank Transfer, etc.
    receipt_url TEXT,
    tags TEXT[], -- Array of tags
    is_tax_deductible BOOLEAN DEFAULT TRUE,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed', -- completed, pending, recurring
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Recurring Expenses Table (for subscriptions, rent, etc.)
CREATE TABLE IF NOT EXISTS freelancing_demo.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    expense_template JSONB NOT NULL, -- Template for creating expenses
    frequency VARCHAR(20) NOT NULL, -- daily, weekly, monthly, yearly
    next_due_date DATE NOT NULL,
    last_generated_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON freelancing_demo.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON freelancing_demo.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON freelancing_demo.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON freelancing_demo.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON freelancing_demo.expense_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id ON freelancing_demo.recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON freelancing_demo.recurring_expenses(next_due_date);

-- Insert default expense categories
INSERT INTO freelancing_demo.expense_categories (user_id, name, description, color, is_default)
SELECT 
    auth.uid(), -- This will be replaced by actual user_id during migration or use a trigger
    category_name,
    category_desc,
    category_color,
    TRUE
FROM (
    VALUES 
        ('Software & Tools', 'Subscriptions for software, SaaS tools, etc.', '#3B82F6'),
        ('Office Supplies', 'Physical office supplies and equipment.', '#10B981'),
        ('Internet & Phone', 'Internet, phone bills, communication costs.', '#F59E0B'),
        ('Marketing & Advertising', 'Ads, promotions, marketing campaigns.', '#EF4444'),
        ('Professional Services', 'Legal, accounting, consulting fees.', '#8B5CF6'),
        ('Travel & Transportation', 'Business travel, fuel, public transport.', '#EC4899'),
        ('Education & Training', 'Courses, certifications, books.', '#14B8A6'),
        ('Bank Fees & Charges', 'Transaction fees, bank charges.', '#6B7280'),
        ('Taxes & Licenses', 'Business taxes, licenses, permits.', '#F97316'),
        ('Insurance', 'Business insurance premiums.', '#06B6D4'),
        ('Rent & Utilities', 'Office rent, electricity, water.', '#84CC16'),
        ('Miscellaneous', 'Other business expenses.', '#A855F7')
) AS defaults(category_name, category_desc, category_color);

-- Note: The above INSERT needs to be run per user or via a trigger/function
-- Alternative: Create a function to insert default categories for new users

-- Function to create default categories for a user
CREATE OR REPLACE FUNCTION freelancing_demo.create_default_expense_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO freelancing_demo.expense_categories (user_id, name, description, color, is_default)
    SELECT 
        p_user_id,
        category_name,
        category_desc,
        category_color,
        TRUE
    FROM (
        VALUES 
            ('Software & Tools', 'Subscriptions for software, SaaS tools, etc.', '#3B82F6'),
            ('Office Supplies', 'Physical office supplies and equipment.', '#10B981'),
            ('Internet & Phone', 'Internet, phone bills, communication costs.', '#F59E0B'),
            ('Marketing & Advertising', 'Ads, promotions, marketing campaigns.', '#EF4444'),
            ('Professional Services', 'Legal, accounting, consulting fees.', '#8B5CF6'),
            ('Travel & Transportation', 'Business travel, fuel, public transport.', '#EC4899'),
            ('Education & Training', 'Courses, certifications, books.', '#14B8A6'),
            ('Bank Fees & Charges', 'Transaction fees, bank charges.', '#6B7280'),
            ('Taxes & Licenses', 'Business taxes, licenses, permits.', '#F97316'),
            ('Insurance', 'Business insurance premiums.', '#06B6D4'),
            ('Rent & Utilities', 'Office rent, electricity, water.', '#84CC16'),
            ('Miscellaneous', 'Other business expenses.', '#A855F7')
    ) AS defaults(category_name, category_desc, category_color)
    WHERE NOT EXISTS (
        SELECT 1 FROM freelancing_demo.expense_categories WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE freelancing_demo.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancing_demo.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancing_demo.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Policies for expense_categories
CREATE POLICY "Users can view their own expense categories"
ON freelancing_demo.expense_categories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expense categories"
ON freelancing_demo.expense_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expense categories"
ON freelancing_demo.expense_categories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expense categories"
ON freelancing_demo.expense_categories FOR DELETE
USING (auth.uid() = user_id);

-- Policies for expenses
CREATE POLICY "Users can view their own expenses"
ON freelancing_demo.expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
ON freelancing_demo.expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
ON freelancing_demo.expenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
ON freelancing_demo.expenses FOR DELETE
USING (auth.uid() = user_id);

-- Policies for recurring_expenses
CREATE POLICY "Users can view their own recurring expenses"
ON freelancing_demo.recurring_expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring expenses"
ON freelancing_demo.recurring_expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring expenses"
ON freelancing_demo.recurring_expenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring expenses"
ON freelancing_demo.recurring_expenses FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION freelancing_demo.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON freelancing_demo.expense_categories
FOR EACH ROW
EXECUTE FUNCTION freelancing_demo.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON freelancing_demo.expenses
FOR EACH ROW
EXECUTE FUNCTION freelancing_demo.update_updated_at_column();

CREATE TRIGGER update_recurring_expenses_updated_at
BEFORE UPDATE ON freelancing_demo.recurring_expenses
FOR EACH ROW
EXECUTE FUNCTION freelancing_demo.update_updated_at_column();

-- View for expense analytics
CREATE OR REPLACE VIEW freelancing_demo.expense_summary AS
SELECT 
    user_id,
    COUNT(*) as total_expenses,
    SUM(amount) as total_amount,
    SUM(CASE WHEN is_tax_deductible THEN amount ELSE 0 END) as tax_deductible_amount,
    SUM(tax_amount) as total_tax,
    AVG(amount) as average_expense,
    MIN(expense_date) as first_expense_date,
    MAX(expense_date) as last_expense_date
FROM freelancing_demo.expenses
WHERE status = 'completed'
GROUP BY user_id;

-- View for monthly expense breakdown
CREATE OR REPLACE VIEW freelancing_demo.monthly_expense_breakdown AS
SELECT 
    user_id,
    DATE_TRUNC('month', expense_date) as month,
    category_id,
    ec.name as category_name,
    COUNT(*) as expense_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount
FROM freelancing_demo.expenses e
LEFT JOIN freelancing_demo.expense_categories ec ON e.category_id = ec.id
WHERE e.status = 'completed'
GROUP BY user_id, DATE_TRUNC('month', expense_date), category_id, ec.name
ORDER BY month DESC, total_amount DESC;

-- Comments for documentation
COMMENT ON TABLE freelancing_demo.expense_categories IS 'Categories for organizing expenses';
COMMENT ON TABLE freelancing_demo.expenses IS 'Individual expense records for freelancers';
COMMENT ON TABLE freelancing_demo.recurring_expenses IS 'Templates for recurring/subscription expenses';
COMMENT ON COLUMN freelancing_demo.expenses.is_tax_deductible IS 'Whether this expense can be deducted for tax purposes';
COMMENT ON COLUMN freelancing_demo.expenses.tax_amount IS 'Tax amount paid on this expense (if applicable)';
COMMENT ON COLUMN freelancing_demo.expenses.payment_method IS 'Method used for payment: Cash, Card, UPI, Bank Transfer, etc.';
