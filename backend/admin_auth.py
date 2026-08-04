"""Platform admin authorization helpers."""
import os
from fastapi import Depends, HTTPException
import httpx

# Lazy import pattern — get_current_user passed from main to avoid circular imports


def get_admin_emails() -> set:
    raw = os.environ.get("PLATFORM_ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def fetch_profile_flags(client, supabase_url: str, headers: dict, user_id: str) -> dict:
    res = await client.get(
        f"{supabase_url}/rest/v1/profiles?user_id=eq.{user_id}&select=is_admin,commission_percentage",
        headers=headers,
    )
    rows = res.json() if res.json() else []
    if not rows:
        res = await client.get(
            f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}&select=is_admin,commission_percentage",
            headers=headers,
        )
        rows = res.json() if res.json() else []
    return rows[0] if rows else {}


def is_platform_admin(user_email: str, profile: dict) -> bool:
    if profile.get("is_admin"):
        return True
    return user_email.lower() in get_admin_emails()


async def require_platform_admin(auth_data: dict, get_current_user_dep, supabase_url: str, supabase_key: str):
    """Raise 403 unless user is platform admin."""
    user = auth_data["user"]
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {token}",
            "Accept-Profile": "freelancing_demo",
        }
        profile = await fetch_profile_flags(client, supabase_url, headers, user.id)
    if not is_platform_admin(user.email or "", profile):
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return auth_data
