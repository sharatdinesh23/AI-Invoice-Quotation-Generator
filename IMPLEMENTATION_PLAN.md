# Freelance CRM Portal - Project Analysis & Implementation Plan

## Current Architecture

### Tech Stack
- **Backend**: FastAPI (Python) with Supabase
- **Frontend**: React + Vite + TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Razorpay (Standard + Subscriptions)
- **Email**: Gmail API Integration
- **AI**: Groq for automated follow-up emails

## Existing Features ✅

### 1. Authentication & Authorization
- Supabase Auth integration
- JWT-based authentication
- Role-based access control

### 2. Subscription Model (Freelancer → Platform)
- Free and Pro plans
- Razorpay subscription integration
- Monthly recurring billing
- Subscription webhook handling
- Plan downgrade/upgrade logic

### 3. Invoice Management
- Create, edit, delete invoices
- Custom invoice numbering
- PDF generation
- Email sending with attachments
- Status tracking (Draft, Sent, Paid, Overdue, Void)
- Multi-currency support
- Tax/GST configuration

### 4. Client Payments (Client → Freelancer)
- Public invoice view page
- Razorpay payment integration
- Payment verification
- Webhook-based status updates
- Payment success notifications

### 5. Quotations
- Create and manage quotes
- Convert quote to invoice
- Quote numbering system

### 6. Recurring Invoices
- Automated recurring invoice generation
- Scheduler (APScheduler)
- Auto-send functionality

### 7. Dashboard
- Revenue tracking
- Pending invoices
- Client statistics
- Recent activity
- CSV export

### 8. Settings & Profile
- Business profile configuration
- Logo upload
- Invoice prefix customization
- Preferred currency
- Gmail integration
- Theme settings (Light/Dark/System)

## Missing Features to Implement 🚧

### 1. Enhanced Payment Routing (Priority: HIGH)
Currently, payments go to the platform owner's Razorpay account. Need to implement:

**Option A: RazorpayX Route**
- Connect freelancer's bank account/UPI
- Automatic transfer after payment
- Platform commission deduction

**Option B: Razorpay Marketplace/Split Payments**
- Create connected accounts for freelancers
- Split payment: Platform fee + Freelancer amount
- Instant settlement

**Implementation Steps:**
1. Add `razorpay_account_id` field to profiles table
2. Create onboarding flow for freelancers to connect their account
3. Modify payment creation to use `account_transfers`
4. Update webhook to handle split payments
5. Add commission tracking

### 2. Expense Tracking (Priority: MEDIUM)
Allow freelancers to track business expenses:

**Database Schema:**
```sql
expenses (
  id,
  user_id,
  category,
  amount,
  currency,
  description,
  date,
  receipt_url,
  created_at
)
```

**Features:**
- Add/Edit/Delete expenses
- Categorization (Software, Hardware, Marketing, etc.)
- Receipt upload
- Expense reports
- Profit calculation (Revenue - Expenses)

### 3. Project/CRM Module (Priority: HIGH)
Track projects across freelance platforms:

**Database Schema:**
```sql
projects (
  id,
  user_id,
  client_id,
  name,
  platform, -- Upwork, Fiverr, Direct, etc.
  status, -- Active, Completed, On Hold
  start_date,
  end_date,
  budget,
  currency,
  description,
  external_link,
  created_at
)

platform_connections (
  id,
  user_id,
  platform_name,
  api_key_encrypted,
  status,
  last_synced_at
)
```

**Features:**
- Manual project creation
- Platform integrations (Upwork API, Fiverr API)
- Gmail parsing for project detection
- Project timeline tracking
- Milestone tracking
- Payment schedule linking to invoices

### 4. Enhanced Dashboard Analytics (Priority: MEDIUM)
- Profit/Loss calculation
- Monthly revenue trends
- Expense breakdown charts
- Client-wise revenue
- Platform-wise earnings
- Tax estimation
- Outstanding receivables aging

### 5. Subscription Enhancements (Priority: LOW)
- Multiple tier plans (Free, Pro, Enterprise)
- Usage-based limits (invoices per month)
- Trial period (14 days)
- Dunning management (failed payment retries)
- Proration for plan changes

## Database Schema Recommendations

### New Tables Required

#### 1. `expenses`
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  name TEXT NOT NULL,
  platform TEXT DEFAULT 'Direct',
  status TEXT DEFAULT 'Active',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  currency TEXT DEFAULT 'USD',
  description TEXT,
  external_link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. `platform_integrations`
```sql
CREATE TABLE platform_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  platform_name TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  webhook_secret TEXT,
  status TEXT DEFAULT 'pending',
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. Update `profiles` table
```sql
ALTER TABLE profiles ADD COLUMN razorpay_account_id TEXT;
ALTER TABLE profiles ADD COLUMN razorpay_account_status TEXT DEFAULT 'not_connected';
ALTER TABLE profiles ADD COLUMN company_pan TEXT; -- For Indian compliance
ALTER TABLE profiles ADD COLUMN bank_account_number TEXT;
ALTER TABLE profiles ADD COLUMN ifsc_code TEXT;
ALTER TABLE profiles ADD COLUMN upi_id TEXT;
```

## API Endpoints to Add

### Expense Management
```python
GET    /api/expenses          # List all expenses
POST   /api/expenses          # Create expense
PUT    /api/expenses/{id}     # Update expense
DELETE /api/expenses/{id}     # Delete expense
GET    /api/expenses/summary  # Get expense summary by category
```

### Project Management
```python
GET    /api/projects          # List all projects
POST   /api/projects          # Create project
PUT    /api/projects/{id}     # Update project
DELETE /api/projects/{id}     # Delete project
GET    /api/projects/{id}/timeline  # Get project timeline
POST   /api/projects/{id}/milestone # Add milestone
```

### Platform Integrations
```python
GET    /api/integrations              # List connected platforms
POST   /api/integrations/{platform}/connect    # Initiate OAuth
GET    /api/integrations/{platform}/callback   # OAuth callback
DELETE /api/integrations/{platform}/disconnect # Disconnect
POST   /api/integrations/sync         # Manual sync trigger
```

### Enhanced Payment Routing
```python
POST   /api/payment-accounts/connect  # Connect freelancer account
GET    /api/payment-accounts/status   # Check connection status
DELETE /api/payment-accounts/disconnect # Disconnect account
```

### Enhanced Analytics
```python
GET    /api/analytics/profit-loss     # P&L statement
GET    /api/analytics/revenue-trends  # Monthly revenue chart data
GET    /api/analytics/expense-breakdown # Category-wise expenses
GET    /api/analytics/client-revenue  # Revenue by client
GET    /api/analytics/tax-estimate    # Estimated tax liability
```

## Frontend Pages to Add

1. **Expenses Page** (`/expenses`)
   - List view with filters
   - Add/Edit modal
   - Category-wise summary cards

2. **Projects Page** (`/projects`)
   - Kanban board view
   - Project detail page
   - Timeline visualization

3. **Integrations Page** (`/integrations`)
   - Available platforms list
   - Connection status
   - Sync controls

4. **Analytics Page** (`/analytics`)
   - Charts (Recharts or Chart.js)
   - P&L statement
   - Export options

5. **Payment Account Setup** (`/settings/payment-account`)
   - Razorpay account connection form
   - Bank details form
   - Verification status

## Implementation Priority

### Phase 1 (Week 1-2): Core Payment Routing
- [ ] Razorpay Marketplace setup
- [ ] Connected account flow
- [ ] Split payment implementation
- [ ] Commission tracking

### Phase 2 (Week 2-3): Expense & Profit Tracking
- [ ] Expense CRUD operations
- [ ] Receipt upload
- [ ] Profit calculation
- [ ] Enhanced dashboard

### Phase 3 (Week 3-4): Project CRM
- [ ] Project management module
- [ ] Manual project entry
- [ ] Gmail parsing for projects
- [ ] Platform integrations (start with one)

### Phase 4 (Week 4-5): Advanced Analytics
- [ ] Chart implementations
- [ ] Financial reports
- [ ] Tax estimation
- [ ] Export functionality

### Phase 5 (Week 5-6): Polish & Testing
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation

## Security Considerations

1. **Payment Data**: Never store raw card/bank details
2. **API Keys**: Encrypt all third-party tokens
3. **Webhooks**: Verify signatures rigorously
4. **Access Control**: Row-level security in Supabase
5. **Rate Limiting**: Prevent abuse on public endpoints

## Compliance Requirements (India-specific)

1. **GST Compliance**: 
   - GSTIN validation
   - GST breakdown in invoices
   - GST reports

2. **TDS Deduction**:
   - TDS calculation option
   - TDS certificates

3. **RBI Guidelines**:
   - Payment aggregator compliance
   - Data localization

## Next Steps

1. Review this document and confirm priorities
2. Set up Razorpay Marketplace account
3. Create database migrations for new tables
4. Start with Phase 1 implementation
5. Iterative testing and feedback

---

*Document generated based on repository analysis - August 2025*
