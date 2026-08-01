# Phase 1: Payment Routing Implementation Plan

## Overview
Implement Razorpay Marketplace/Route to enable direct payment transfers to freelancers with configurable platform commission (default 2%).

## Business Logic
- Freelancers can choose to enable "Payment Integration" on their invoices
- When enabled, client payments go through Razorpay with split:
  - Platform commission: configurable % (default 2%, stored in `users.commission_percentage`)
  - Freelancer amount: remaining % (default 98%)
- Transfer happens automatically via RazorpayX Route
- If freelancer doesn't enable payment integration, invoice shows "Mark as Paid" option only

## Database Changes Required

### 1. Update `profiles` table
```sql
-- Add commission and payment routing fields
ALTER TABLE profiles ADD COLUMN commission_percentage DECIMAL(5,2) DEFAULT 2.00;
ALTER TABLE profiles ADD COLUMN razorpay_account_id TEXT;
ALTER TABLE profiles ADD COLUMN razorpay_account_status TEXT DEFAULT 'not_connected'; -- not_connected, pending, verified, active, rejected
ALTER TABLE profiles ADD COLUMN enable_payment_integration BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN bank_account_number TEXT;
ALTER TABLE profiles ADD COLUMN ifsc_code TEXT;
ALTER TABLE profiles ADD COLUMN upi_id TEXT;
ALTER TABLE profiles ADD COLUMN account_holder_name TEXT;
ALTER TABLE profiles ADD COLUMN pan_number TEXT;
```

### 2. Update `invoices` table
```sql
-- Track payment integration status per invoice
ALTER TABLE invoices ADD COLUMN payment_integration_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN razorpay_order_id TEXT;
ALTER TABLE invoices ADD COLUMN razorpay_payment_id TEXT;
ALTER TABLE invoices ADD COLUMN platform_commission_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN freelancer_payout_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN payout_status TEXT DEFAULT 'pending'; -- pending, processing, completed, failed
ALTER TABLE invoices ADD COLUMN payout_transfer_id TEXT; -- Razorpay transfer ID
```

### 3. Create `payouts` table
```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  transfer_id TEXT, -- Razorpay transfer ID
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, reversed
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payouts_user_id ON payouts(user_id);
CREATE INDEX idx_payouts_invoice_id ON payouts(invoice_id);
CREATE INDEX idx_payouts_status ON payouts(status);
```

### 4. Create `commission_transactions` table
```sql
CREATE TABLE commission_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  invoice_id UUID REFERENCES invoices(id),
  invoice_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_id TEXT, -- Razorpay payment ID
  status TEXT DEFAULT 'pending', -- pending, completed, refunded
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_commission_user_id ON commission_transactions(user_id);
CREATE INDEX idx_commission_invoice_id ON commission_transactions(invoice_id);
```

## Backend API Endpoints to Add

### 1. Payment Account Management
```python
GET    /api/payment-account/status          # Check if freelancer connected account
POST   /api/payment-account/connect         # Initiate account connection (generate onboard link)
GET    /api/payment-account/onboard-url     # Get Razorpay onboard URL
POST   /api/payment-account/webhook         # Razorpay account verification webhook
DELETE /api/payment-account/disconnect      # Disconnect account
```

### 2. Enhanced Invoice Payment Flow
```python
POST   /api/invoices/{invoice_id}/create-payment-order  # Create order with split payment
POST   /api/public/payments/verify-enhanced             # Verify payment with split logic
POST   /api/webhooks/razorpay-payment                   # Handle payment + transfer webhooks
```

### 3. Payout Management
```python
GET    /api/payouts              # List all payouts for freelancer
GET    /api/payouts/{id}         # Get payout details
POST   /api/payouts/{id}/retry   # Retry failed payout
```

### 4. Commission Tracking
```python
GET    /api/commissions          # List all commissions earned by platform
GET    /api/commissions/summary  # Get commission summary
```

## Implementation Steps

### Step 1: Database Migration (Day 1)
- Create SQL migration script for all new tables/columns
- Execute migration on Supabase
- Add Row Level Security (RLS) policies

### Step 2: Backend - Payment Account Connection (Day 2-3)
- Implement Razorpay Standard Onboarding flow
- Create endpoints for account status/check
- Handle webhook for account verification
- Store encrypted account details

### Step 3: Backend - Enhanced Payment Flow (Day 4-5)
- Modify `create_payment_order` to support split payments
- Add `account_transfers` parameter for Razorpay Route
- Update payment verification to handle transfers
- Calculate commission dynamically from profile

### Step 4: Backend - Webhook Handling (Day 6)
- Implement payment webhook with transfer tracking
- Update invoice status on successful payment
- Create payout record
- Create commission transaction record
- Handle transfer failures

### Step 5: Frontend - Payment Account Setup (Day 7-8)
- Add "Payment Account" section in Settings page
- Show connection status
- Display form for manual bank/UPI details
- Show Razorpay onboarding button

### Step 6: Frontend - Invoice Payment Toggle (Day 9)
- Add checkbox "Enable Online Payments" in Create/Edit Invoice
- Show commission preview (e.g., "Platform fee: 2% = $X, You receive: $Y")
- Update invoice creation to save `payment_integration_enabled`

### Step 7: Frontend - Public Invoice View (Day 10)
- Update public invoice page to show Razorpay payment button only if enabled
- Handle payment flow with Razorpay checkout
- Show success/failure messages

### Step 8: Frontend - Payout Dashboard (Day 11)
- Create new page `/payouts` to view payout history
- Show status badges (Pending, Processing, Completed, Failed)
- Display payout amounts and dates

### Step 9: Testing & QA (Day 12-14)
- Test complete flow: Invoice → Payment → Split → Payout
- Test edge cases: failed transfers, refunds, partial payments
- Test different commission percentages
- Security audit of webhook signatures

## Razorpay Configuration Required

### 1. Enable RazorpayX Route
- Contact Razorpay support to enable Route feature
- Get `account_type` and `transfer_reversal` permissions

### 2. Standard Onboarding Setup
- Configure onboarding form in Razorpay Dashboard
- Set up onboarding webhook endpoint
- Define required documents (PAN, Bank Proof for India)

### 3. Webhook Configuration
- Add webhook URLs in Razorpay Dashboard:
  - `/api/webhooks/razorpay-payment` (payment events)
  - `/api/webhooks/razorpay-transfer` (transfer events)
  - `/api/payment-account/webhook` (account events)

## Code Structure Changes

### New Files to Create
```
backend/
├── services/
│   ├── razorpay_service.py       # Razorpay API wrapper
│   ├── payout_service.py         # Payout logic
│   └── commission_service.py     # Commission calculations
├── models/
│   ├── payout.py                 # Pydantic models
│   └── commission.py
└── routes/
    ├── payment_accounts.py       # Account management routes
    ├── payouts.py                # Payout routes
    └── commissions.py            # Commission routes

frontend/
├── src/
│   ├── pages/
│   │   ├── Payouts.jsx           # Payout history page
│   │   └── PaymentAccount.jsx    # Account setup page
│   └── components/
│       ├── PaymentAccountForm.jsx
│       ├── PayoutTable.jsx
│       └── CommissionPreview.jsx
```

## Environment Variables to Add
```bash
# Razorpay
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# For Route/Transfers
RAZORPAY_ROUTE_ENABLED=true
```

## Security Considerations

1. **Webhook Verification**: Always verify Razorpay webhook signatures
2. **Idempotency**: Handle duplicate webhook events
3. **Amount Validation**: Verify amounts match before processing
4. **Access Control**: Ensure users can only access their own data
5. **Encryption**: Encrypt sensitive bank/account details

## Error Handling

1. **Transfer Failures**: 
   - Log failure reason
   - Notify freelancer via email
   - Allow retry mechanism
   
2. **Insufficient Balance**: 
   - Platform must maintain balance for commission-first model
   - Or use commission-deduction model (deduct first, transfer rest)

3. **Invalid Account Details**:
   - Validate during onboarding
   - Show clear error messages

## Commission Models (Choose One)

### Model A: Deduction First (Recommended)
```
Total Amount: $100
Commission (2%): $2
Transfer to Freelancer: $98
```
- Razorpay charges full $100
- Immediately transfer $98 to freelancer
- Platform keeps $2 in Razorpay account

### Model B: Platform Balance
```
- Maintain platform balance in Razorpay
- Transfer full $100 to freelancer
- Deduct $2 from platform's prepaid balance
```
- Requires preload of funds

**Recommendation**: Use Model A (simpler, no preload needed)

## Testing Checklist

- [ ] Freelancer can connect Razorpay account
- [ ] Account status shows correctly
- [ ] Invoice with payment enabled shows Razorpay button
- [ ] Invoice without payment enabled shows "Mark as Paid" only
- [ ] Client can make payment successfully
- [ ] Split happens correctly (2% to platform, 98% to freelancer)
- [ ] Invoice status updates to "Paid"
- [ ] Payout record created with correct status
- [ ] Commission transaction recorded
- [ ] Webhook handles duplicate events
- [ ] Failed transfers are logged and retryable
- [ ] Different commission percentages work (1%, 2%, 5%)
- [ ] Refund flow works correctly
- [ ] Email notifications sent on key events

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Database Setup | 1 day | Migrations, RLS policies |
| Backend Core | 3 days | Account connection, payment flow |
| Backend Webhooks | 2 days | Payment + transfer handling |
| Frontend Account Setup | 2 days | Settings page updates |
| Frontend Invoice Flow | 2 days | Payment toggle, preview |
| Frontend Payouts | 2 days | Payout dashboard |
| Testing | 3 days | E2E testing, bug fixes |
| **Total** | **15 days** | **Phase 1 Complete** |

## Next Steps After Phase 1

Once Phase 1 is complete:
1. Monitor first few transactions in production
2. Gather freelancer feedback
3. Optimize based on real usage
4. Proceed to Phase 2 (Expense Tracking)

---

*Ready to implement? Start with database migrations.*
