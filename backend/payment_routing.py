"""Razorpay Route helpers: linked accounts, split math, payment settlement records."""
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException


def is_payment_integration_enabled(profile: Optional[dict]) -> bool:
    if not profile:
        return False
    return bool(
        profile.get("payment_integration_enabled")
        or profile.get("enable_payment_integration")
    )


def payment_integration_patch(enabled: bool) -> dict:
    """Write both column names for schema compatibility."""
    return {
        "payment_integration_enabled": enabled,
        "enable_payment_integration": enabled,
    }


def calculate_split(total_amount: float, commission_pct: float) -> Tuple[float, float]:
    commission_amount = round((total_amount * commission_pct / 100), 2)
    freelancer_payout = round((total_amount - commission_amount), 2)
    return commission_amount, freelancer_payout


def parse_payout_profile_fields(profile: dict) -> dict:
    """Extract holder name and PAN from profile / payout_destination_value."""
    holder = profile.get("account_holder_name") or ""
    pan = profile.get("pan_number") or ""
    raw = profile.get("payout_destination_value")
    if raw:
        try:
            parsed = json.loads(raw) if isinstance(raw, str) and raw.strip().startswith("{") else raw
            if isinstance(parsed, dict):
                holder = holder or parsed.get("account_holder_name") or parsed.get("name") or ""
                pan = pan or parsed.get("pan_number") or ""
        except (json.JSONDecodeError, TypeError):
            pass
    return {"account_holder_name": holder, "pan_number": pan}


def build_account_transfers(
    razorpay_account_id: str,
    freelancer_amount_paise: int,
    currency: str,
    invoice_id: str,
) -> list:
    return [
        {
            "account": razorpay_account_id,
            "amount": freelancer_amount_paise,
            "currency": currency,
            "on_hold": 0,
            "reference_id": f"inv_{invoice_id}",
        }
    ]


def route_enabled() -> bool:
    return os.environ.get("RAZORPAY_ROUTE_ENABLED", "true").lower() == "true"


def create_razorpay_linked_account(
    razorpay_client,
    user_id: str,
    email: str,
    profile: dict,
) -> dict:
    """Create Razorpay Route linked account. Raises on API failure."""
    if not route_enabled():
        raise HTTPException(
            status_code=503,
            detail="Razorpay Route is disabled. Set RAZORPAY_ROUTE_ENABLED=true and enable Route on your Razorpay account.",
        )

    fields = parse_payout_profile_fields(profile)
    holder = fields["account_holder_name"] or (email.split("@")[0] if email else "Freelancer")
    pan = fields["pan_number"]

    payload: Dict[str, Any] = {
        "email": email,
        "phone": profile.get("phone") or "9999999999",
        "type": "route",
        "reference_id": user_id.replace("-", "")[:20],
        "legal_business_name": holder[:100],
        "business_type": "individual",
        "contact_name": holder[:100],
        "profile": {
            "category": "services",
            "subcategory": "consulting",
            "addresses": {
                "registered": {
                    "street1": "Not Provided",
                    "city": "Mumbai",
                    "state": "MAHARASHTRA",
                    "postal_code": "400001",
                    "country": "IN",
                }
            },
        },
    }
    if pan:
        payload["legal_info"] = {"pan": pan.upper()}

    try:
        return razorpay_client.account.create(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Razorpay linked account creation failed: {exc}",
        ) from exc


def map_account_status(razorpay_status: Optional[str]) -> str:
    if not razorpay_status:
        return "pending"
    normalized = razorpay_status.lower()
    if normalized in {"activated", "active", "live"}:
        return "active"
    if normalized in {"created", "pending", "under_review", "needs_clarification"}:
        return "pending"
    if normalized in {"suspended", "rejected", "disabled"}:
        return "rejected"
    return normalized


async def ensure_razorpay_linked_account(
    razorpay_client,
    client,
    supabase_url: str,
    headers: dict,
    user_id: str,
    email: str,
    profile: dict,
) -> Optional[str]:
    """Return linked account id, creating one via Razorpay when missing."""
    existing_id = profile.get("razorpay_account_id")
    if existing_id:
        return existing_id

    if not is_payment_integration_enabled(profile) and not profile.get("payout_destination_value"):
        return None

    account = create_razorpay_linked_account(razorpay_client, user_id, email, profile)
    account_id = account.get("id")
    if not account_id:
        return None

    account_status = map_account_status(account.get("status"))
    patch = {
        "razorpay_account_id": account_id,
        "razorpay_account_status": account_status,
        **payment_integration_patch(True),
    }
    await client.patch(
        f"{supabase_url}/rest/v1/profiles?user_id=eq.{user_id}",
        json=patch,
        headers=headers,
    )
    await client.patch(
        f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}",
        json=patch,
        headers=headers,
    )
    return account_id


async def record_invoice_payment_settlement(
    client,
    supabase_url: str,
    headers: dict,
    invoice: dict,
    profile: dict,
    *,
    razorpay_payment_id: str,
    razorpay_order_id: Optional[str] = None,
    amount_paid: Optional[float] = None,
) -> dict:
    """
    Idempotent settlement after client payment:
    invoice Paid, payments row, payment_splits, payouts ledger.
    """
    if invoice.get("status") in ("Paid", "Completed"):
        return {"skipped": True, "reason": "already_paid", "invoice_id": invoice["id"]}

    target_invoice_id = invoice["id"]
    user_id = invoice["user_id"]
    amount = amount_paid if amount_paid and amount_paid > 0 else float(invoice.get("total", 0))
    currency = invoice.get("currency", "INR")

    payment_enabled = is_payment_integration_enabled(profile)
    commission_pct = float(profile.get("commission_percentage", 2.0))
    commission_amount, freelancer_payout = calculate_split(amount, commission_pct)
    has_route_account = payment_enabled and bool(profile.get("razorpay_account_id"))

    payout_status = "processing" if has_route_account else "pending_settlement"
    settlement_status = "processing" if has_route_account else "pending"

    await client.patch(
        f"{supabase_url}/rest/v1/invoices?id=eq.{target_invoice_id}",
        json={
            "status": "Paid",
            "settlement_status": settlement_status,
            "payout_status": payout_status,
            "razorpay_payment_id": razorpay_payment_id,
            "platform_commission_amount": commission_amount,
            "freelancer_payout_amount": freelancer_payout,
        },
        headers=headers,
    )

    if razorpay_order_id:
        pay_check = await client.get(
            f"{supabase_url}/rest/v1/payments?razorpay_payment_id=eq.{razorpay_payment_id}&select=id",
            headers=headers,
        )
        existing_payments = pay_check.json() if pay_check.json() else []
        if not existing_payments:
            await client.post(
                f"{supabase_url}/rest/v1/payments",
                json={
                    "invoice_id": target_invoice_id,
                    "user_id": user_id,
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": razorpay_payment_id,
                    "amount": amount,
                    "currency": currency,
                    "status": "paid",
                },
                headers=headers,
            )

    split_check = await client.get(
        f"{supabase_url}/rest/v1/payment_splits?invoice_id=eq.{target_invoice_id}&select=id",
        headers=headers,
    )
    existing_splits = split_check.json() if split_check.json() else []
    if not existing_splits:
        await client.post(
            f"{supabase_url}/rest/v1/payment_splits",
            json={
                "invoice_id": target_invoice_id,
                "total_amount": amount,
                "commission_percentage": commission_pct,
                "commission_amount": commission_amount,
                "freelancer_amount": freelancer_payout,
                "split_status": "completed" if has_route_account else "pending_manual",
                "razorpay_split_id": razorpay_payment_id,
            },
            headers=headers,
        )

    payout_check = await client.get(
        f"{supabase_url}/rest/v1/payouts?invoice_id=eq.{target_invoice_id}&select=id",
        headers=headers,
    )
    existing_payouts = payout_check.json() if payout_check.json() else []
    if not existing_payouts:
        payout_record_status = "processing" if has_route_account else "pending_manual"
        await client.post(
            f"{supabase_url}/rest/v1/payouts",
            json={
                "freelancer_id": user_id,
                "invoice_id": target_invoice_id,
                "amount": amount,
                "commission_amount": commission_amount,
                "net_payout": freelancer_payout,
                "status": payout_record_status,
                "payout_reference": razorpay_payment_id,
            },
            headers=headers,
        )

    return {
        "invoice_id": target_invoice_id,
        "commission_amount": commission_amount,
        "freelancer_payout": freelancer_payout,
        "commission_percentage": commission_pct,
        "route_transfer": has_route_account,
        "payout_status": payout_status,
    }


async def complete_payout_transfer(
    client,
    supabase_url: str,
    headers: dict,
    *,
    transfer_id: Optional[str],
    utr_number: str,
    invoice_id: Optional[str] = None,
) -> bool:
    """Mark invoice + payout completed when Razorpay transfer/settlement webhook fires."""
    inv_id = invoice_id
    if not inv_id and transfer_id:
        inv_res = await client.get(
            f"{supabase_url}/rest/v1/invoices?payout_transfer_id=eq.{transfer_id}&select=id",
            headers=headers,
        )
        invs = inv_res.json() if inv_res.json() else []
        if invs:
            inv_id = invs[0]["id"]

    if not inv_id:
        return False

    settled_at = datetime.now(timezone.utc).isoformat()
    await client.patch(
        f"{supabase_url}/rest/v1/invoices?id=eq.{inv_id}",
        json={
            "status": "Completed",
            "settlement_status": "settled",
            "payout_status": "completed",
            "utr_number": utr_number,
            "settled_at": settled_at,
            "payout_transfer_id": transfer_id,
        },
        headers=headers,
    )
    await client.patch(
        f"{supabase_url}/rest/v1/payouts?invoice_id=eq.{inv_id}",
        json={
            "status": "completed",
            "utr_number": utr_number,
            "payout_reference": transfer_id or utr_number,
            "updated_at": settled_at,
        },
        headers=headers,
    )
    return True
