# Phase 1: Payment Routing Implementation - SQL Migration Guide

## Overview
This document provides the SQL migration script and instructions to implement RazorpayX Route payment routing with configurable commission percentages.

## Prerequisites
1. Access to your Supabase dashboard
2. Admin privileges to execute SQL migrations
3. Backup of your database (recommended before running migrations)

## Step 1: Execute SQL Migration

### Option A: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire content from `/workspace/database/migration_phase1.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute the migration
7. Verify the output shows successful execution

### Option B: Via Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db execute --file /workspace/database/migration_phase1.sql
```

## Step 2: Verify Migration

After executing the migration, run these verification queries in Supabase SQL Editor:

```sql
-- 1. Check new columns in profiles table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('commission_percentage', 'razorpay_account_id', 'enable_payment_integration', 'razorpay_account_status')
ORDER BY ordinal_position;

-- 2. Check new columns in invoices table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND column_name IN ('payment_integration_enabled', 'platform_commission_amount', 'freelancer_payout_amount', 'payout_status')
ORDER BY ordinal_position;

-- 3. Verify payouts table exists
SELECT COUNT(*) FROM payouts;

-- 4. Verify commission_transactions table exists
SELECT COUNT(*) FROM commission_transactions;

-- 5. Check default commission percentage
SELECT user_id, commission_percentage FROM profiles LIMIT 10;
```

Expected Results:
- All new columns should appear in the results
- Both `payouts` and `commission_transactions` tables should exist
- Default commission_percentage should be 2.00 for all existing users

## Step 3: Update Environment Variables

Add these environment variables to your `.env` file in the backend directory:

```bash
# Existing Razorpay variables
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# New variables for payment routing (add these)
RAZORPAY_ROUTE_ENABLED=true
```

## Step 4: Configure Razorpay Dashboard

### 4.1 Enable RazorpayX Route
1. Contact Razorpay support to enable Route feature on your account
2. Request activation of:
   - Standard Onboarding
   - Account Transfers
   - Transfer Reversals

### 4.2 Configure Webhooks
Once Route is enabled, add these webhook URLs in Razorpay Dashboard:

1. **Payment Webhook**: `https://your-domain.com/api/webhooks/razorpay`
   - Events: `payment.captured`, `payment.failed`

2. **Transfer Webhook**: `https://your-domain.com/api/webhooks/razorpay-transfer`
   - Events: `transfer.created`, `transfer.processed`, `transfer.failed`

3. **Account Webhook**: `https://your-domain.com/api/payment-account/webhook`
   - Events: `account.onboarded`, `account.activated`

## Step 5: Test the Implementation

### 5.1 Test Payment Account Setup
```bash
# Get payment account status
curl -X GET http://localhost:8000/api/payment-account/status \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# Connect payment account (initiate onboarding)
curl -X POST http://localhost:8000/api/payment-account/connect \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# Update bank details manually
curl -X POST http://localhost:8000/api/payment-account/update-details \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_account_number": "1234567890",
    "ifsc_code": "SBIN0001234",
    "account_holder_name": "John Doe",
    "upi_id": "johndoe@upi"
  }'

# Toggle payment integration
curl -X POST http://localhost:8000/api/payment-account/toggle-integration \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true}'
```

### 5.2 Test Commission Update
```bash
# Update commission percentage (admin feature)
curl -X POST http://localhost:8000/api/payment-account/update-commission \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commission_percentage": 1.5}'
```

### 5.3 Test Payment Order Creation
```bash
# Create payment order with routing
curl -X POST http://localhost:8000/api/invoices/YOUR_INVOICE_ID/create-payment-order \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "order_id": "order_xxxxx",
  "amount": 100000,
  "currency": "INR",
  "key_id": "rzp_test_xxxxx",
  "invoice_number": "INV-001",
  "payment_routing_enabled": true,
  "commission_amount": 20.00,
  "payout_amount": 980.00,
  "commission_percentage": 2.00
}
```

### 5.4 Test Payout and Commission Retrieval
```bash
# Get payouts
curl -X GET http://localhost:8000/api/payouts \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# Get commission transactions
curl -X GET http://localhost:8000/api/commissions \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# Get commission summary
curl -X GET http://localhost:8000/api/commissions/summary \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

## Step 6: Frontend Integration (Optional)

Update your frontend to use the new endpoints:

1. **Settings Page**: Add payment account setup section
2. **Invoice Creation**: Add "Enable Online Payments" checkbox with commission preview
3. **Dashboard**: Add payout history and commission tracking views

Example React component structure:
```jsx
// src/pages/PaymentAccount.jsx
import { useState, useEffect } from 'react';
import api from '../api';

export default function PaymentAccount() {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    api.get('/payment-account/status').then(res => setStatus(res.data));
  }, []);
  
  const handleConnect = () => {
    api.post('/payment-account/connect').then(res => {
      window.open(res.data.onboard_url, '_blank');
    });
  };
  
  return (
    <div>
      <h2>Payment Account Setup</h2>
      {status?.enabled ? (
        <p>✅ Payment integration enabled</p>
      ) : (
        <button onClick={handleConnect}>Connect Account</button>
      )}
      <p>Commission: {status?.commission_percentage}%</p>
    </div>
  );
}
```

## Troubleshooting

### Issue: Column already exists error
**Solution**: The migration uses `IF NOT EXISTS`, so this shouldn't happen. If it does, the column already exists from a previous run.

### Issue: Permission denied on table creation
**Solution**: Ensure you're using the Supabase service role key or have admin privileges.

### Issue: RLS policy conflicts
**Solution**: The migration drops existing policies before creating new ones. If issues persist, manually check RLS policies in Supabase dashboard.

### Issue: Function calculate_payout_amount already exists
**Solution**: Use `CREATE OR REPLACE FUNCTION` which handles this automatically.

## Next Steps

After completing Phase 1:

1. **Monitor First Transactions**: Watch the first few payments to ensure splits work correctly
2. **Test Edge Cases**: Failed transfers, refunds, partial payments
3. **Gather Feedback**: Get feedback from freelancers on the payment setup flow
4. **Proceed to Phase 2**: Expense tracking implementation

## Support

For issues with Razorpay Route activation:
- Email: support@razorpay.com
- Subject: "Request to Enable RazorpayX Route for Marketplace"

Include in your email:
- Your Razorpay account ID
- Business model description (freelance marketplace)
- Expected monthly transaction volume
- Requirement for split payments and automatic transfers

---

**Migration completed successfully? Proceed to update the frontend components.**
