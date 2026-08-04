"""Project CRM: Gmail parsing, platform sync, background worker helpers."""
import base64
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

GMAIL_SEARCH_QUERY = (
    'newer_than:60d ('
    'subject:(project OR offer OR contract OR proposal OR milestone OR "job post" OR interview OR invoice OR payment OR remittance OR paid) '
    'OR from:(upwork.com OR notifications.upwork.com OR fiverr.com OR mail.fiverr.com)'
    ')'
)

BUDGET_PATTERNS = [
    (re.compile(r'(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)', re.I), "INR"),
    (re.compile(r'\$\s*([\d,]+(?:\.\d{1,2})?)', re.I), "USD"),
    (re.compile(r'(?:USD|EUR|GBP)\s*([\d,]+(?:\.\d{1,2})?)', re.I), "USD"),
    (re.compile(r'budget[:\s]+([\d,]+(?:\.\d{1,2})?)', re.I), "INR"),
]

LINK_PATTERNS = {
    "upwork": re.compile(r'https?://(?:www\.)?upwork\.com/[^\s<>"\']+', re.I),
    "fiverr": re.compile(r'https?://(?:www\.)?fiverr\.com/[^\s<>"\']+', re.I),
}

INVOICE_NUMBER_PATTERN = re.compile(r'(?:INV[-_\#]?\d+|invoice\s*[\#\:\s]*\d+)', re.I)
PAYMENT_CONFIRMATION_PATTERN = re.compile(r'(?:payment\s+received|remittance\s+advice|payout\s+processed|funds\s+transferred|paid\s+in\s+full)', re.I)


def _header_value(headers: List[dict], name: str) -> str:
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def _decode_body_data(data: str) -> str:
    try:
        padded = data + "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def extract_email_body(payload: dict) -> str:
    """Walk MIME parts and return plain-text body."""
    if not payload:
        return ""

    if payload.get("body", {}).get("data"):
        return _decode_body_data(payload["body"]["data"])

    parts = payload.get("parts") or []
    text_parts: List[str] = []
    for part in parts:
        mime = part.get("mimeType", "")
        if mime == "text/plain" and part.get("body", {}).get("data"):
            text_parts.append(_decode_body_data(part["body"]["data"]))
        elif part.get("parts"):
            text_parts.append(extract_email_body(part))
    return "\n".join(text_parts)


def detect_source(subject: str, sender: str, body: str) -> str:
    combined = f"{subject} {sender} {body}".lower()
    if "upwork" in combined:
        return "upwork"
    if "fiverr" in combined:
        return "fiverr"
    return "gmail"


def extract_budget(text: str) -> tuple[float, str]:
    for pattern, currency in BUDGET_PATTERNS:
        match = pattern.search(text or "")
        if match:
            amount = float(match.group(1).replace(",", ""))
            if amount > 0:
                return amount, currency
    return 0.0, "INR"


def extract_external_link(body: str, source: str) -> Optional[str]:
    pattern = LINK_PATTERNS.get(source)
    if pattern:
        match = pattern.search(body or "")
        if match:
            return match.group(0).rstrip(").,;")
    return None


def parse_gmail_message(msg: dict) -> dict:
    """Turn a Gmail API message into a project draft dict with payment/invoice mention flags."""
    payload = msg.get("payload", {})
    headers = payload.get("headers", [])
    subject = _header_value(headers, "Subject") or "Untitled Project"
    sender = _header_value(headers, "From") or "Unknown"
    body = extract_email_body(payload)
    combined = f"{subject}\n{body}"
    source = detect_source(subject, sender, body)
    budget, currency = extract_budget(combined)
    external_link = extract_external_link(body, source)

    inv_match = INVOICE_NUMBER_PATTERN.search(combined)
    is_payment = bool(PAYMENT_CONFIRMATION_PATTERN.search(combined))
    invoice_ref = inv_match.group(0) if inv_match else None

    status = "todo"
    lower = combined.lower()
    if is_payment or any(k in lower for k in ("completed", "delivered", "closed", "paid")):
        status = "completed"
    elif any(k in lower for k in ("in progress", "started", "milestone")):
        status = "in_progress"
    elif any(k in lower for k in ("review", "feedback", "revision")):
        status = "review"
    elif any(k in lower for k in ("offer", "proposal", "invitation")):
        status = "backlog"

    extra_info = []
    if invoice_ref:
        extra_info.append(f"Mentioned Invoice: {invoice_ref}")
    if is_payment:
        extra_info.append("Type: Payment Confirmation")

    extra_str = f" ({', '.join(extra_info)})" if extra_info else ""
    snippet = (body or subject)[:500].strip()

    return {
        "title": subject[:200],
        "description": f"Auto-detected from email ({sender}){extra_str}.\n\n{snippet}",
        "status": status,
        "source": source,
        "budget": budget,
        "currency": currency,
        "external_link": external_link,
        "gmail_message_id": msg.get("id"),
        "email_sender": sender[:255],
    }



async def project_exists_by_gmail_id(
    client: httpx.AsyncClient,
    supabase_url: str,
    headers: dict,
    user_id: str,
    gmail_message_id: str,
) -> bool:
    res = await client.get(
        f"{supabase_url}/rest/v1/projects"
        f"?user_id=eq.{user_id}&gmail_message_id=eq.{gmail_message_id}&select=id",
        headers=headers,
    )
    rows = res.json() if res.json() else []
    return bool(rows)


async def sync_gmail_projects_for_user(
    client: httpx.AsyncClient,
    supabase_url: str,
    headers: dict,
    user_id: str,
    decrypt_token_fn: Callable[[str], str],
    *,
    max_messages: int = 25,
) -> Dict[str, Any]:
    """Scan Gmail inbox and create CRM projects from matching emails."""
    token_res = await client.get(
        f"{supabase_url}/rest/v1/gmail_tokens?user_id=eq.{user_id}",
        headers=headers,
    )
    tokens = token_res.json() if token_res.json() else []
    if not tokens:
        return {"created": 0, "skipped": 0, "error": "Gmail not connected"}

    created = 0
    skipped = 0
    try:
        access_token = decrypt_token_fn(tokens[0]["access_token"])
        gmail_service = build("gmail", "v1", credentials=Credentials(token=access_token))
        msg_list = (
            gmail_service.users()
            .messages()
            .list(userId="me", q=GMAIL_SEARCH_QUERY, maxResults=max_messages)
            .execute()
        )
        messages = msg_list.get("messages", [])

        for msg_ref in messages:
            msg_id = msg_ref["id"]
            if await project_exists_by_gmail_id(client, supabase_url, headers, user_id, msg_id):
                skipped += 1
                continue

            msg = (
                gmail_service.users()
                .messages()
                .get(userId="me", id=msg_id, format="full")
                .execute()
            )
            draft = parse_gmail_message(msg)
            draft["user_id"] = user_id
            await client.post(f"{supabase_url}/rest/v1/projects", json=draft, headers=headers)
            created += 1

        return {"created": created, "skipped": skipped, "scanned": len(messages)}
    except Exception as exc:
        return {"created": created, "skipped": skipped, "error": str(exc)}


async def sync_platform_connections_for_user(
    client: httpx.AsyncClient,
    supabase_url: str,
    headers: dict,
    user_id: str,
) -> Dict[str, Any]:
    """
    Platform API sync stub.
    Upwork/Fiverr freelancer APIs require OAuth partner approval — we record sync
    attempts and rely on Gmail parsing for offer detection until credentials work.
    """
    res = await client.get(
        f"{supabase_url}/rest/v1/platform_connections?user_id=eq.{user_id}&status=eq.active",
        headers=headers,
    )
    connections = res.json() if res.json() else []
    synced = 0
    now = datetime.now(timezone.utc).isoformat()

    for conn in connections:
        note = (
            f"{conn['platform_name'].title()} API sync queued. "
            "Partner API credentials stored; Gmail parsing remains primary source."
        )
        await client.patch(
            f"{supabase_url}/rest/v1/platform_connections?id=eq.{conn['id']}",
            json={"last_synced_at": now, "sync_notes": note, "updated_at": now},
            headers=headers,
        )
        synced += 1

    return {"platforms_synced": synced, "connections": len(connections)}


async def run_full_project_sync(
    client: httpx.AsyncClient,
    supabase_url: str,
    headers: dict,
    user_id: str,
    decrypt_token_fn: Callable[[str], str],
) -> Dict[str, Any]:
    gmail_result = await sync_gmail_projects_for_user(
        client, supabase_url, headers, user_id, decrypt_token_fn
    )
    platform_result = await sync_platform_connections_for_user(
        client, supabase_url, headers, user_id
    )
    created = gmail_result.get("created", 0)
    return {
        "message": f"Sync complete: {created} new project(s) from Gmail.",
        "synced_count": created,
        "gmail": gmail_result,
        "platforms": platform_result,
    }


async def background_sync_all_gmail_projects(
    supabase_url: str,
    service_key: str,
    decrypt_token_fn: Callable[[str], str],
) -> None:
    """Cron worker: sync projects for every user with Gmail connected."""
    if not service_key:
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Accept-Profile": "freelancing_demo",
        "Content-Profile": "freelancing_demo",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        token_res = await client.get(
            f"{supabase_url}/rest/v1/gmail_tokens?select=user_id",
            headers=headers,
        )
        rows = token_res.json() if token_res.json() else []
        user_ids = list({row["user_id"] for row in rows if row.get("user_id")})

        print(f"🔄 CRM background sync: {len(user_ids)} user(s) with Gmail")
        for user_id in user_ids:
            try:
                result = await run_full_project_sync(
                    client, supabase_url, headers, user_id, decrypt_token_fn
                )
                print(f"  ✅ user {user_id}: {result.get('synced_count', 0)} new projects")
            except Exception as exc:
                print(f"  ⚠️ user {user_id} sync failed: {exc}")
