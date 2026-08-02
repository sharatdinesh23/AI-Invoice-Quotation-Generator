# backend/main.py
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, RedirectResponse
import httpx
import io
import base64
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from supabase import create_client
import razorpay
import hmac
import hashlib
from fastapi import Request
import json
from groq import Groq
from datetime import date, timedelta
from typing import Optional
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Freelance Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://100.57.224.161",       # <-- ADD YOUR EC2 PUBLIC IP HERE (no port, or with port 80)
        "http://100.57.224.161:80"     # <-- ADD THIS TOO just in case
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABSE_SERVICE_KEY = os.environ.get("SUPABSE_SERVICE_KEY")


supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user info"""
    token = credentials.credentials
    try:
        user_response = supabase_client.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": user_response.user.id, "email": user_response.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Use the global client to verify the token
        user_response = supabase_client.auth.get_user(token)
        if not user_response.user:
            print(f"AUTH FAILED: No user found for token starting with: {token[:20]}...")
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user": user_response.user, "token": token}
    except Exception as e:
        print(f"AUTH EXCEPTION: {e}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

async def require_pro_plan(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=subscription_plan,subscription_status,current_period_end",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
        )
        
        if not res.json():
            raise HTTPException(status_code=403, detail="Please upgrade to Pro.")
        
        data = res.json() if res.json() else []
        profile = data[0] if data and len(data) > 0 else {}
        plan = profile.get('subscription_plan', 'free')
        status = profile.get('subscription_status', 'inactive')
        period_end = profile.get('current_period_end')
        
        # Check if subscription has expired
        if plan == 'pro' and period_end:
            from datetime import datetime
            try:
                end_date = datetime.fromisoformat(period_end.replace('Z', '+00:00'))
                if datetime.utcnow() > end_date:
                    # Subscription expired, downgrade user
                    await client.patch(
                        f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}",
                        json={"subscription_plan": "free", "subscription_status": "inactive"},
                        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
                    )
                    raise HTTPException(status_code=403, detail="Your Pro subscription has expired. Please renew.")
            except:
                pass
        
        if plan != 'pro':
            raise HTTPException(status_code=403, detail="This is a Pro feature. Please upgrade.")
    
    return auth_data


# --- CORE ROUTES ---
@app.get("/")
def read_root():
    return {"message": "Freelance Portal API is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/dashboard")
async def get_dashboard_data(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABASE_KEY, 
            "Authorization": f"Bearer {token}", 
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        
        clients_res = await client.get(f"{SUPABASE_URL}/rest/v1/clients?user_id=eq.{user.id}&select=id", headers=headers)
        invoices_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&status=neq.Void&select=*,clients(name,email)&order=created_at.desc", 
            headers=headers
        )
        
        clients_data = clients_res.json() if clients_res.json() and isinstance(clients_res.json(), list) else []
        inv_data = invoices_res.json() if invoices_res.json() and isinstance(invoices_res.json(), list) else []
        
        pending_count = sum(1 for inv in inv_data if inv.get('status') in ['Sent', 'Overdue'])
        pending_amount = sum(float(inv.get('total', 0)) for inv in inv_data if inv.get('status') in ['Sent', 'Overdue'])
        
        paid_count = sum(1 for inv in inv_data if inv.get('status') in ['Paid', 'Completed'])
        revenue = sum(float(inv.get('total', 0)) for inv in inv_data if inv.get('status') in ['Paid', 'Completed'])
        
        recent_invoices = inv_data[:5]
        pending_invoices = [inv for inv in inv_data if inv.get('status') in ['Sent', 'Overdue']][:5]

        return {
            "message": f"Welcome, {user.email}!", 
            "stats": {
                "clients": len(clients_data), 
                "pending_count": pending_count,
                "pending_amount": round(pending_amount, 2),
                "paid_count": paid_count, 
                "revenue": round(revenue, 2)
            },
            "recent_invoices": recent_invoices,
            "pending_invoices": pending_invoices
        }

# --- CLIENTS ---
@app.get("/api/clients")
async def get_clients(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPABASE_URL}/rest/v1/clients?user_id=eq.{auth_data['user'].id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"})
        return {"clients": response.json()}

@app.post("/api/clients")
async def create_client(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SUPABASE_URL}/rest/v1/clients", json={"user_id": user.id, "name": request.get("name"), "email": request.get("email")}, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=representation"})
        return {"client": response.json()[0]}

@app.patch("/api/clients/{client_id}")
async def update_client(client_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    user_id = auth_data["user"].id
    token = auth_data["token"]
    
    update_data = {}
    if request.get("name"): update_data["name"] = request["name"]
    if request.get("email"): update_data["email"] = request["email"]
    
    # print(f"\n=== DEBUG UPDATE CLIENT ===")
    # print(f"Client ID: {client_id}")
    # print(f"User ID: {user_id}")
    # print(f"Update Data: {update_data}")
    
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}&user_id=eq.{user_id}"
        headers = {
            "apikey": SUPABASE_KEY, 
            "Authorization": f"Bearer {token}", 
            "Content-Type": "application/json",
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo", 
            "Prefer": "return=representation"
        }
        
        # print(f"URL: {url}")
        # print(f"Headers: {headers}")
        
        response = await client.patch(url, json=update_data, headers=headers)
        
        # print(f"Status Code: {response.status_code}")
        # print(f"Response Body: {response.text}")
        # print(f"===========================\n")
        
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        result = response.json() if response.text else []
        if not result:
            raise HTTPException(status_code=404, detail="Client not found or no permission to update")
        
        return {"client": result[0], "message": "Client updated successfully"}

@app.delete("/api/clients/{client_id}")
async def delete_client(client_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    user_id = auth_data["user"].id
    async with httpx.AsyncClient() as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}&user_id=eq.{user_id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"})
        return {"message": "Client deleted"}


@app.get("/api/clients/{client_id}/stats")
async def get_client_stats(client_id: str, auth_data: dict = Depends(get_current_user)):
    user_id = auth_data["user"].id
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABASE_KEY, 
            "Authorization": f"Bearer {token}", 
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        
        # 1. Fetch all invoices for this client
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user_id}&client_id=eq.{client_id}&select=status,total,created_at", 
            headers=headers
        )
        invoices = inv_res.json()
        
        total_invoiced = 0.0
        total_paid = 0.0
        outstanding = 0.0
        paid_invoices_for_avg = []
        
        for inv in invoices:
            amount = float(inv.get('total', 0))
            total_invoiced += amount
            
            if inv['status'] in ['Paid', 'Completed']:
                total_paid += amount
                paid_invoices_for_avg.append(inv)
            elif inv['status'] in ['Sent', 'Overdue']:
                outstanding += amount
                
        avg_payment_days = "N/A" # Can be enhanced later with a 'paid_at' column
        
        return {
            "stats": {
                "total_invoiced": total_invoiced,
                "total_paid": total_paid,
                "outstanding": outstanding,
                "invoice_count": len(invoices),
                "paid_count": len(paid_invoices_for_avg),
                "avg_payment_days": avg_payment_days
            }
        }


# --- PRODUCTS ---
@app.get("/api/products")
async def get_products(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPABASE_URL}/rest/v1/products?user_id=eq.{auth_data['user'].id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"})
        return {"products": response.json()}

@app.post("/api/products")
async def create_product(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SUPABASE_URL}/rest/v1/products", json={"user_id": user.id, "name": request.get("name"), "rate": request.get("rate")}, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=representation"})
        return {"product": response.json()[0]}

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    user_id = auth_data["user"].id
    async with httpx.AsyncClient() as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}&user_id=eq.{user_id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"})
        return {"message": "Product deleted"}
    
@app.patch("/api/products/{product_id}")
async def update_product(product_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    user_id = auth_data["user"].id
    token = auth_data["token"]
    
    update_data = {}
    if request.get("name"): update_data["name"] = request["name"]
    if request.get("rate") is not None: update_data["rate"] = request["rate"]
    
    # print(f"\n=== DEBUG UPDATE PRODUCT ===")
    # print(f"Product ID: {product_id}")
    # print(f"User ID: {user_id}")
    # print(f"Update Data: {update_data}")
    
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}&user_id=eq.{user_id}"
        headers = {
            "apikey": SUPABASE_KEY, 
            "Authorization": f"Bearer {token}", 
            "Content-Type": "application/json",
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo", 
            "Prefer": "return=representation"
        }
        
        response = await client.patch(url, json=update_data, headers=headers)
        
        # print(f"Status Code: {response.status_code}")
        # print(f"Response Body: {response.text}")
        # print(f"============================\n")
        
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        result = response.json() if response.text else []
        if not result:
            raise HTTPException(status_code=404, detail="Product not found or no permission to update")
        
        return {"product": result[0], "message": "Product updated successfully"}

# ==============================================================================
# PYDANTIC MODELS FOR EXPENSE TRACKING
# ==============================================================================

class ExpenseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"

class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class ExpenseCreate(BaseModel):
    category: str
    subcategory: Optional[str] = None
    amount: float
    currency: str = "USD"
    description: Optional[str] = None
    expense_date: str
    payment_method: str
    vendor_name: Optional[str] = None
    tax_amount: float = 0
    tax_rate: float = 0
    is_tax_deductible: bool = True
    notes: Optional[str] = None
    status: str = "completed"
    receipt_url: Optional[str] = None
    bill_number: Optional[str] = None

class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    subcategory: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[str] = None
    payment_method: Optional[str] = None
    vendor_name: Optional[str] = None
    tax_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    is_tax_deductible: Optional[bool] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    receipt_url: Optional[str] = None
    bill_number: Optional[str] = None


# ==============================================================================
# PRODUCTS API
# ==============================================================================
@app.put("/api/products/{product_id}")
async def update_product(product_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    user_id = auth_data['user'].id
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY, 
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}", 
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user_id}&status=neq.Void&select=*,clients(name,email)&order=created_at.desc", 
            headers=headers
        )
        return {"invoices": response.json() if response.json() else []}


# 1. SPECIFIC ROUTE: MUST BE FIRST
@app.get("/api/invoices/next-number")
async def get_next_invoice_number(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
        
        prof_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=invoice_prefix,organization_name", headers=headers)
        prof_data = prof_res.json()
        
        # print(f"\n=== DEBUG PROFILE DATA for user {user.id} ===")
        # print(prof_data)
        # print("===============================================\n")
        
        prefix = "INV"
        if prof_data and len(prof_data) > 0:
            profile = prof_data[0]
            if profile.get('invoice_prefix') and str(profile['invoice_prefix']).strip(): 
                prefix = str(profile['invoice_prefix']).strip().upper()
            elif profile.get('organization_name') and str(profile['organization_name']).strip(): 
                prefix = str(profile['organization_name']).strip()[:4].upper()
                
        if not prefix or len(prefix) < 2:
            prefix = user.email.split('@')[0][:4].upper() if user.email else "INV"

        inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=invoice_number", headers=headers)
        inv_data = inv_res.json()
        
        max_num = 0
        for inv in inv_data:
            parts = inv['invoice_number'].split('-')
            if len(parts) > 1:
                try:
                    num = int(parts[-1])
                    if num > max_num: max_num = num
                except ValueError: 
                    pass
                    
        next_num = f"{prefix}-{max_num + 1}"
        # print(f"=== DEBUG GENERATED NEXT NUMBER: {next_num} ===\n")
        
        return {"next_number": next_num}

# 2. PARAMETERIZED ROUTE: MUST BE SECOND
@app.get("/api/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, auth_data: dict = Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY, 
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}", 
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)", headers=headers)
        invoices = inv_res.json() if inv_res.json() else []
        if not invoices: raise HTTPException(status_code=404, detail="Invoice not found")
        
        items_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}", headers=headers)
        invoice = invoices[0]
        invoice['items'] = items_res.json()
        return {"invoice": invoice}

@app.post("/api/invoices")
async def create_invoice(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    invoice_data = {"user_id": user.id, "client_id": request.get("client_id"), "invoice_number": request.get("invoice_number"), "status": request.get("status", "Draft"), "subtotal": request.get("subtotal"), "tax_amount": request.get("tax", 0), "discount": request.get("discount", 0), "total": request.get("total"), "currency": request.get("currency", "USD")}
    
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=representation"}
        inv_response = await client.post(f"{SUPABASE_URL}/rest/v1/invoices", json=invoice_data, headers=headers)
        new_invoice = inv_response.json()[0]
        invoice_id = new_invoice["id"]
        
        items_data = [{"user_id": user.id, "invoice_id": invoice_id, "product_id": item.get("product_id"), "description": item.get("description"), "quantity": item.get("quantity"), "rate": item.get("rate"), "amount": item.get("amount")} for item in request.get("items", [])]
        if items_data:
            await client.post(f"{SUPABASE_URL}/rest/v1/invoice_items", json=items_data, headers=headers)
            
        return {"invoice": new_invoice, "message": "Invoice created successfully"}

@app.put("/api/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    invoice_data = {"client_id": request.get("client_id"), "invoice_number": request.get("invoice_number"), "status": request.get("status"), "subtotal": request.get("subtotal"), "tax_amount": request.get("tax", 0), "discount": request.get("discount", 0), "total": request.get("total"), "currency": request.get("currency", "USD")}
    
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"}
        await client.patch(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&user_id=eq.{user.id}", json=invoice_data, headers=headers)
        await client.delete(f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}", headers=headers)
        
        items_data = [{"user_id": user.id, "invoice_id": invoice_id, "product_id": item.get("product_id"), "description": item.get("description"), "quantity": item.get("quantity"), "rate": item.get("rate"), "amount": item.get("amount")} for item in request.get("items", [])]
        if items_data:
            await client.post(f"{SUPABASE_URL}/rest/v1/invoice_items", json=items_data, headers=headers)
            
    return {"message": "Invoice updated"}

@app.delete("/api/invoices/{invoice_id}")
async def soft_delete_invoice(invoice_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    user_id = auth_data["user"].id
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept-Profile": "freelancing_demo",
            "Content-Profile": "freelancing_demo",
            "Prefer": "return=minimal"
        }
        # Soft delete: Update status to 'Void' instead of permanently deleting
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&user_id=eq.{user_id}",
            json={"status": "Void"},
            headers=headers
        )
        
    return {"message": "Invoice voided successfully"}

# --- QUOTATIONS ROUTES ---

@app.get("/api/quotations")
async def get_quotations(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPABASE_URL}/rest/v1/quotations?user_id=eq.{auth_data['user'].id}&select=*,clients(name)&order=created_at.desc", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"})
        return {"quotations": response.json()}

# SPECIFIC ROUTE: MUST BE BEFORE /{quote_id}
@app.get("/api/quotations/next-number")
async def get_next_quote_number(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
        prof_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=invoice_prefix,organization_name", headers=headers)
        prof_data = prof_res.json()
        
        prefix = "QUO"
        if prof_data and len(prof_data) > 0:
            profile = prof_data[0]
            if profile.get('invoice_prefix'): prefix = f"QUO-{profile['invoice_prefix']}"
            elif profile.get('organization_name'): prefix = f"QUO-{profile['organization_name'][:4].upper()}"
                
        if not prefix or len(prefix) < 2: prefix = f"QUO-{user.email.split('@')[0][:4].upper()}"

        inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/quotations?user_id=eq.{user.id}&select=quote_number", headers=headers)
        max_num = 0
        for inv in inv_res.json():
            parts = inv['quote_number'].split('-')
            if len(parts) > 1:
                try:
                    num = int(parts[-1])
                    if num > max_num: max_num = num
                except ValueError: pass
        return {"next_number": f"{prefix}-{max_num + 1}"}

# SPECIFIC ROUTE: CONVERT TO INVOICE (MUST BE BEFORE /{quote_id})
@app.post("/api/quotations/{quote_id}/convert")
async def convert_quote_to_invoice(quote_id: str, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    headers = {
        "apikey": SUPABASE_KEY, 
        "Authorization": f"Bearer {token}", 
        "Content-Type": "application/json", 
        "Accept-Profile": "freelancing_demo", 
        "Content-Profile": "freelancing_demo", 
        "Prefer": "return=representation"
    }
    
    async with httpx.AsyncClient() as client:
        # 1. Fetch the Quotation
        quote_res = await client.get(f"{SUPABASE_URL}/rest/v1/quotations?id=eq.{quote_id}&select=*", headers=headers)
        quote = quote_res.json()[0]
        
        # 2. Generate Next Invoice Number (using your Settings prefix logic)
        prof_headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
        prof_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=invoice_prefix,organization_name", headers=prof_headers)
        prof_data = prof_res.json()
        
        prefix = "INV"
        if prof_data and len(prof_data) > 0:
            profile = prof_data[0]
            if profile.get('invoice_prefix') and str(profile['invoice_prefix']).strip(): 
                prefix = str(profile['invoice_prefix']).strip().upper()
            elif profile.get('organization_name') and str(profile['organization_name']).strip(): 
                prefix = str(profile['organization_name']).strip()[:4].upper()
                
        if not prefix or len(prefix) < 2:
            prefix = user.email.split('@')[0][:4].upper() if user.email else "INV"

        inv_res_check = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=invoice_number", headers=prof_headers)
        max_num = 0
        for inv in inv_res_check.json():
            parts = inv['invoice_number'].split('-')
            if len(parts) > 1:
                try:
                    num = int(parts[-1])
                    if num > max_num: max_num = num
                except ValueError: pass
                
        inv_num = f"{prefix}-{max_num + 1}"
        
        # 3. Create the new Invoice (Safely transferring Currency and all other details)
        inv_payload = {
            "user_id": user.id, 
            "client_id": quote['client_id'], 
            "invoice_number": inv_num,
            "status": "Draft", 
            "subtotal": quote['subtotal'], 
            "tax_amount": quote['tax'],
            "discount": quote['discount'], 
            "total": quote['total'], 
            "currency": quote.get('currency', 'USD'),  # <-- SAFELY TRANSFER CURRENCY HERE
            "notes": quote.get('notes')
        }
        
        inv_res = await client.post(f"{SUPABASE_URL}/rest/v1/invoices", json=inv_payload, headers=headers)
        new_invoice_id = inv_res.json()[0]["id"]
        
        # 4. Copy the Line Items
        items_res = await client.get(f"{SUPABASE_URL}/rest/v1/quotation_items?quote_id=eq.{quote_id}", headers=headers)
        if items_res.json():
            items_payload = [{
                "invoice_id": new_invoice_id, 
                "user_id": user.id, 
                "product_id": i.get("product_id"), 
                "description": i["description"], 
                "quantity": i["quantity"], 
                "rate": i["rate"], 
                "amount": i["amount"]
            } for i in items_res.json()]
            
            await client.post(f"{SUPABASE_URL}/rest/v1/invoice_items", json=items_payload, headers=headers)
            
        # 5. Update Quotation Status to 'Converted'
        await client.patch(f"{SUPABASE_URL}/rest/v1/quotations?id=eq.{quote_id}", json={"status": "Converted"}, headers=headers)
        
    return {"message": "Converted to Invoice successfully", "invoice_id": new_invoice_id, "invoice_number": inv_num}

# PARAMETERIZED ROUTES: MUST BE LAST
@app.get("/api/quotations/{quote_id}")
async def get_quotation(quote_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"}
        q_res = await client.get(f"{SUPABASE_URL}/rest/v1/quotations?id=eq.{quote_id}&select=*,clients(name,email)", headers=headers)
        if not q_res.json(): raise HTTPException(status_code=404, detail="Quotation not found")
        
        items_res = await client.get(f"{SUPABASE_URL}/rest/v1/quotation_items?quote_id=eq.{quote_id}", headers=headers)
        quote = q_res.json()[0]
        quote['items'] = items_res.json()
        return {"quotation": quote}

@app.post("/api/quotations")
async def create_quotation(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    headers = {
        "apikey": SUPABASE_KEY, 
        "Authorization": f"Bearer {token}", 
        "Content-Type": "application/json", 
        "Accept-Profile": "freelancing_demo", 
        "Content-Profile": "freelancing_demo", 
        "Prefer": "return=representation"
    }
    
    # Fix: Convert empty string to None for valid_until to prevent Postgres date errors
    valid_until_val = request.get("valid_until")
    if valid_until_val == "":
        valid_until_val = None

    payload = {
        "user_id": user.id, 
        "client_id": request["client_id"], 
        "quote_number": request["quote_number"],
        "status": "Draft", 
        "subtotal": request["subtotal"], 
        "tax": request["tax"],
        "discount": request["discount"], 
        "total": request["total"], 
        "currency": request.get("currency", "USD"),
        "valid_until": valid_until_val, 
        "notes": request.get("notes", "")
    }
    
    print(f"\n=== DEBUG CREATE QUOTATION ===")
    print(f"Payload: {payload}")
    
    async with httpx.AsyncClient() as client:
        q_res = await client.post(f"{SUPABASE_URL}/rest/v1/quotations", json=payload, headers=headers)
        
        print(f"Status Code: {q_res.status_code}")
        print(f"Response Body: {q_res.text}")
        
        if q_res.status_code >= 400:
            raise HTTPException(status_code=q_res.status_code, detail=q_res.text)
            
        response_data = q_res.json()
        if not response_data or len(response_data) == 0:
            raise HTTPException(status_code=500, detail="Quotation created but no ID returned.")
            
        quote_id = response_data[0]["id"]
        
        items = [{
            "quote_id": quote_id, 
            "product_id": i.get("product_id"), 
            "description": i["description"], 
            "quantity": i["quantity"], 
            "rate": i["rate"], 
            "amount": i["amount"]
        } for i in request.get("items", [])]
        
        if items:
            items_res = await client.post(f"{SUPABASE_URL}/rest/v1/quotation_items", json=items, headers=headers)
            print(f"Items Status: {items_res.status_code}")
            if items_res.status_code >= 400:
                print(f"Items Error: {items_res.text}")
            
    print("=== QUOTATION CREATED SUCCESSFULLY ===\n")
    return {"message": "Quotation created", "quote_id": quote_id}

@app.put("/api/quotations/{quote_id}")
async def update_quotation(quote_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"}
    
    payload = {
        "client_id": request["client_id"], "quote_number": request["quote_number"],
        "status": request.get("status", "Draft"), "subtotal": request["subtotal"], "tax": request["tax"],
        "discount": request["discount"], "total": request["total"], "currency": request.get("currency", "USD"),
        "valid_until": request.get("valid_until"), "notes": request.get("notes")
    }
    
    async with httpx.AsyncClient() as client:
        await client.patch(f"{SUPABASE_URL}/rest/v1/quotations?id=eq.{quote_id}&user_id=eq.{user.id}", json=payload, headers=headers)
        await client.delete(f"{SUPABASE_URL}/rest/v1/quotation_items?quote_id=eq.{quote_id}", headers=headers)
        
        items = [{"quote_id": quote_id, "product_id": i.get("product_id"), "description": i["description"], "quantity": i["quantity"], "rate": i["rate"], "amount": i["amount"]} for i in request.get("items", [])]
        if items:
            await client.post(f"{SUPABASE_URL}/rest/v1/quotation_items", json=items, headers=headers)
            
    return {"message": "Quotation updated"}

@app.delete("/api/quotations/{quote_id}")
async def delete_quotation(quote_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    user_id = auth_data["user"].id
    async with httpx.AsyncClient() as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/quotations?id=eq.{quote_id}&user_id=eq.{user_id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"})
    return {"message": "Quotation deleted"}



# --- PDF GENERATION ---
# --- HELPER: Generate Professional PDF Bytes ---
async def get_invoice_pdf_bytes(invoice_id: str, client: httpx.AsyncClient, headers: dict) -> bytes:
    from fpdf import FPDF
    
    inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)", headers=headers)
    invoice = inv_res.json()[0]
    
    items_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}", headers=headers)
    items = items_res.json()
    
    profile_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{invoice['user_id']}&select=organization_name,gstin,logo_url", headers=headers)
    profile = profile_res.json()[0] if profile_res.json() else {}

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    y_offset = 10
    
    if profile.get('logo_url'):
        try:
            pdf.image(profile['logo_url'], x=10, y=10, w=40)
            y_offset = 55
        except Exception: pass

    pdf.set_xy(60, 10)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, profile.get('organization_name') or "Your Business", 0, 1, "L")
    if profile.get('gstin'):
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, f"GSTIN: {profile['gstin']}", 0, 1, "L")

    pdf.set_xy(120, 10)
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 10, "INVOICE", 0, 1, "R")
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(120, 25)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Invoice #: {invoice['invoice_number']}", 0, 1, "R")
    
    issue_date = invoice.get('issue_date') or invoice.get('created_at', 'N/A')
    if issue_date != 'N/A' and 'T' in str(issue_date): issue_date = str(issue_date).split('T')[0]
    pdf.cell(0, 6, f"Date: {issue_date}", 0, 1, "R")
    pdf.ln(y_offset - 15)
    
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "BILL TO:", 0, 1)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, invoice['clients']['name'], 0, 1)
    pdf.cell(0, 6, invoice['clients']['email'], 0, 1)
    pdf.ln(10)
    
    currency_symbol = invoice.get('currency', 'USD')
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(100, 8, "Description", 1, 0, "L", True)
    pdf.cell(25, 8, "Qty", 1, 0, "C", True)
    pdf.cell(35, 8, "Rate", 1, 0, "R", True)
    pdf.cell(30, 8, "Amount", 1, 1, "R", True)
    
    pdf.set_font("Helvetica", "", 10)
    for item in items:
        pdf.cell(100, 8, str(item.get('description', ''))[:45], 1, 0, "L")
        pdf.cell(25, 8, f"{float(item.get('quantity', 0)):g}", 1, 0, "C")
        pdf.cell(35, 8, f"{currency_symbol} {float(item.get('rate', 0)):.2f}", 1, 0, "R")
        pdf.cell(30, 8, f"{currency_symbol} {float(item.get('amount', 0)):.2f}", 1, 1, "R")
        
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10)
    subtotal = float(invoice.get('subtotal', 0))
    tax_amount = float(invoice.get('tax_amount', invoice.get('tax', 0)))
    discount = float(invoice.get('discount', 0))
    total = float(invoice.get('total', 0))
    tax_rate_display = (tax_amount / subtotal * 100) if subtotal > 0 else 0
    
    pdf.cell(130, 8, "Subtotal:", 0, 0, "R"); pdf.cell(60, 8, f"{currency_symbol} {subtotal:.2f}", 0, 1, "R")
    pdf.cell(130, 8, f"Tax ({tax_rate_display:.1f}%):", 0, 0, "R"); pdf.cell(60, 8, f"{currency_symbol} {tax_amount:.2f}", 0, 1, "R")
    pdf.cell(130, 8, "Discount:", 0, 0, "R"); pdf.cell(60, 8, f"-{currency_symbol} {discount:.2f}", 0, 1, "R")
    
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_draw_color(0, 0, 0)
    pdf.line(130, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(2)
    pdf.cell(130, 10, "Total:", 0, 0, "R")
    pdf.cell(60, 10, f"{currency_symbol} {total:.2f}", 0, 1, "R")
    
    if invoice.get('notes'):
        pdf.ln(10)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, "Notes:", 0, 1)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, str(invoice['notes']))

    return pdf.output()


@app.get("/api/invoices/{invoice_id}/pdf")
async def generate_invoice_pdf(invoice_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"}
        pdf_bytes = await get_invoice_pdf_bytes(invoice_id, client, headers)
        
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=Invoice-{invoice_id}.pdf"}
    )

# --- SETTINGS ---
@app.get("/api/settings")
async def get_settings(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{auth_data['user'].id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"})
        data = response.json()
        return {"profile": data[0] if data else None}

@app.put("/api/settings")
async def update_settings(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        check_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"})
        exists = len(check_res.json()) > 0
        profile_data = {
            "user_id": user.id, 
            "organization_name": request.get("organization_name"), 
            "gstin": request.get("gstin"),
            "tax_label": request.get("tax_label"), 
            "logo_url": request.get("logo_url"), 
            "invoice_prefix": request.get("invoice_prefix"),
            "preferred_currency": request.get("preferred_currency", "USD")
        }
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=representation"}
        if not exists:
            await client.post(f"{SUPABASE_URL}/rest/v1/profiles", json=profile_data, headers=headers)
        else:
            await client.patch(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}", json=profile_data, headers=headers)
        return {"message": "Settings updated"}

# --- GMAIL OAUTH ---
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "tJ8x9yZ3qW2vR5nM7kL4pO1sA6bC8dE0fG2hI4jK6lM=")
cipher_suite = Fernet(ENCRYPTION_KEY.encode())
# Initialize Razorpay
razorpay_client = razorpay.Client(auth=(os.environ.get("RAZORPAY_KEY_ID"), os.environ.get("RAZORPAY_KEY_SECRET")))
# Initialize Free AI Client (Groq)
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def encrypt_token(token: str) -> str: return cipher_suite.encrypt(token.encode()).decode()
def decrypt_token(encrypted_token: str) -> str: return cipher_suite.decrypt(encrypted_token.encode()).decode()

@app.get("/api/auth/google")
async def google_auth_url():
    return {"auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "client_id": os.environ.get("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID"), "redirect_uri": "http://localhost:8000/api/auth/google/callback", "scopes": ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/userinfo.email"]}

@app.get("/api/auth/google/callback")
async def google_callback(code: str, state: str):
    try:
        print("\n=== DEBUG GMAIL CALLBACK START ===")
        
        # 1. Verify the user
        user_response = supabase_client.auth.get_user(state)
        if not user_response.user: 
            print("ERROR: Invalid user token in state")
            return RedirectResponse(url="http://localhost:5173/settings?gmail_error=invalid_token")
        user = user_response.user
        print(f"1. User verified: {user.email}")
        
        # 2. Exchange code for tokens using httpx (Bypasses oauthlib scope bugs)
        token_data = {
            "code": code,
            "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
            "redirect_uri": "http://localhost:8000/api/auth/google/callback",
            "grant_type": "authorization_code"
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post("https://oauth2.googleapis.com/token", data=token_data)
            
            if token_response.status_code != 200:
                print(f"ERROR exchanging token: {token_response.text}")
                return RedirectResponse(url="http://localhost:5173/settings?gmail_error=token_exchange_failed")
                
            tokens = token_response.json()
            print(f"2. Google tokens fetched successfully")
            
            # 3. Get user info to verify the Gmail address
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            user_info = user_info_response.json()
            gmail_email = user_info.get("email")
            print(f"3. Gmail email verified: {gmail_email}")
            
            # 4. Encrypt tokens for secure storage
            encrypted_access = encrypt_token(tokens["access_token"])
            encrypted_refresh = encrypt_token(tokens.get("refresh_token", ""))
            new_expiry = (datetime.now() + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat()

            payload = {
                "user_id": user.id, 
                "gmail_email": gmail_email, 
                "access_token": encrypted_access,
                "refresh_token": encrypted_refresh,
                "token_expiry": new_expiry,
                "is_connected": True
            }
            print(f"4. Payload prepared with keys: {list(payload.keys())}")

            # 5. Save to Supabase
            save_response = await client.post(
                f"{SUPABASE_URL}/rest/v1/gmail_tokens", 
                json=payload, 
                headers={
                    "apikey": SUPABASE_KEY, 
                    "Authorization": f"Bearer {state}", 
                    "Content-Type": "application/json", 
                    "Accept-Profile": "freelancing_demo", 
                    "Content-Profile": "freelancing_demo", 
                    "Prefer": "resolution=merge-duplicates"
                }
            )
            print(f"5. Save Response Status: {save_response.status_code}")
            print(f"6. Save Response Body: {save_response.text}")
            
            if save_response.status_code >= 400:
                print(f"ERROR saving tokens to Supabase!")
                return RedirectResponse(url="http://localhost:5173/settings?gmail_error=save_failed")
                
        print("=== DEBUG GMAIL CALLBACK SUCCESS ===\n")
        return RedirectResponse(url="http://localhost:5173/settings?gmail_connected=true")
        
    except Exception as e:
        print(f"DEBUG Gmail Callback Exception: {e}")
        import traceback
        traceback.print_exc()
        return RedirectResponse(url="http://localhost:5173/settings?gmail_error=true")

@app.get("/api/auth/google/status")
async def get_gmail_status(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{auth_data['user'].id}&select=gmail_email", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"})
        data = response.json()
        return {"connected": True, "email": data[0]["gmail_email"]} if data and len(data) > 0 else {"connected": False, "email": None}

# @app.post("/api/invoices/{invoice_id}/send")
# async def send_invoice_email(invoice_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
#     user = auth_data["user"]
#     token = auth_data["token"]
    
#     print(f"\n=== DEBUG SEND EMAIL ===")
#     print(f"User ID: {user.id}")
    
#     # Keep the httpx client open for the ENTIRE function
#     async with httpx.AsyncClient() as client:
#         headers = {
#             "apikey": SUPABASE_KEY, 
#             "Authorization": f"Bearer {token}", 
#             "Accept-Profile": "freelancing_demo",
#             "Content-Profile": "freelancing_demo"
#         }
        
#         # 1. Get Gmail tokens
#         tokens_res = await client.get(f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{user.id}", headers=headers)
#         tokens_data = tokens_res.json()
        
#         if not tokens_data or len(tokens_data) == 0:
#             raise HTTPException(status_code=400, detail="Gmail not connected. Please connect your Gmail account first.")
        
#         token_record = tokens_data[0]
#         access_token = decrypt_token(token_record["access_token"])
#         refresh_token = decrypt_token(token_record["refresh_token"])
#         gmail_email = token_record["gmail_email"]
    
#         # 2. Check if token is expired and refresh if needed
#         token_expiry = datetime.fromisoformat(token_record["token_expiry"].replace('Z', '+00:00'))
#         if datetime.now(token_expiry.tzinfo) >= token_expiry:
#             creds = Credentials(
#                 token=None,
#                 refresh_token=refresh_token,
#                 token_uri="https://oauth2.googleapis.com/token",
#                 client_id=os.environ.get("GOOGLE_CLIENT_ID"),
#                 client_secret=os.environ.get("GOOGLE_CLIENT_SECRET")
#             )
#             # Note: google-auth requires a synchronous client for refresh
#             creds.refresh(httpx.Client())
#             access_token = creds.token
            
#             # Update token in database
#             encrypted_access = encrypt_token(access_token)
#             new_expiry = (datetime.now() + timedelta(seconds=3600)).isoformat()
            
#             await client.patch(
#                 f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{user.id}",
#                 json={"access_token": encrypted_access, "token_expiry": new_expiry},
#                 headers=headers
#             )
        
#         # 3. Get invoice details
#         inv_res = await client.get(
#             f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)", 
#             headers=headers
#         )
#         invoice = inv_res.json()[0]
        
#         # 4. Build email
#         to_email = invoice["clients"]["email"]
#         subject = request.get("subject", f"Invoice {invoice['invoice_number']}")
#         body = request.get("body", f"Hello,\n\nPlease find attached invoice {invoice['invoice_number']} for your recent services.\n\nThank you for your business!")
        
#         message = MIMEMultipart()
#         message['to'] = to_email
#         message['from'] = gmail_email
#         message['subject'] = subject
        
#         msg_text = MIMEText(body, 'plain')
#         message.attach(msg_text)
        
#         # 5. Generate PDF (Simplified for email attachment)
#         from fpdf import FPDF
#         pdf = FPDF()
#         pdf.add_page()
#         pdf.set_font("Helvetica", "", 12)
#         pdf.cell(0, 10, f"Invoice {invoice['invoice_number']} for {invoice['clients']['name']}", 0, 1)
#         pdf.cell(0, 10, f"Total: {invoice.get('currency', 'USD')} {invoice['total']}", 0, 1)
#         pdf_bytes = pdf.output()
        
#         # Attach PDF
#         part = MIMEBase('application', 'octet-stream')
#         part.set_payload(pdf_bytes)
#         encoders.encode_base64(part)
#         part.add_header(
#             'Content-Disposition',
#             f'attachment; filename="invoice-{invoice["invoice_number"]}.pdf"'
#         )
#         message.attach(part)
        
#         # 6. Send email via Gmail API
#         gmail_service = build('gmail', 'v1', credentials=Credentials(token=access_token))
#         raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
#         try:
#             sent_message = gmail_service.users().messages().send(
#                 userId='me',
#                 body={'raw': raw_message}
#             ).execute()
            
#             # Update invoice status to "Sent"
#             await client.patch(
#                 f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}",
#                 json={"status": "Sent"},
#                 headers=headers
#             )
            
#             print("=== EMAIL SENT SUCCESSFULLY ===\n")
#             return {"message": "Invoice sent successfully!", "message_id": sent_message['id']}
#         except Exception as e:
#             print(f"ERROR SENDING EMAIL: {e}")
#             raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@app.post("/api/invoices/{invoice_id}/send")
async def send_invoice_email(invoice_id: str, request: dict, auth_data: dict = Depends(require_pro_plan)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    print(f"\n=== DEBUG SEND EMAIL ===")
    print(f"User ID: {user.id}")
    
    # Keep the httpx client open for the ENTIRE function
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABASE_KEY, 
            "Authorization": f"Bearer {token}", 
            "Accept-Profile": "freelancing_demo",
            "Content-Profile": "freelancing_demo"
        }
        
        # 1. Get Gmail tokens
        tokens_res = await client.get(f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{user.id}", headers=headers)
        tokens_data = tokens_res.json()
        
        if not tokens_data or len(tokens_data) == 0:
            raise HTTPException(status_code=400, detail="Gmail not connected. Please connect your Gmail account first.")
        
        token_record = tokens_data[0]
        access_token = decrypt_token(token_record["access_token"])
        refresh_token = decrypt_token(token_record["refresh_token"])
        gmail_email = token_record["gmail_email"]
    
        # 2. Check if token is expired and refresh if needed
        token_expiry = datetime.fromisoformat(token_record["token_expiry"].replace('Z', '+00:00'))
        if datetime.now(token_expiry.tzinfo) >= token_expiry:
            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.environ.get("GOOGLE_CLIENT_ID"),
                client_secret=os.environ.get("GOOGLE_CLIENT_SECRET")
            )
            creds.refresh(httpx.Client())
            access_token = creds.token
            
            # Update token in database
            encrypted_access = encrypt_token(access_token)
            new_expiry = (datetime.now() + timedelta(seconds=3600)).isoformat()
            
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{user.id}",
                json={"access_token": encrypted_access, "token_expiry": new_expiry},
                headers=headers
            )
        
        # 3. Get invoice details for email subject/body
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)", 
            headers=headers
        )
        invoice = inv_res.json()[0]
        
        # 4. Build email
        to_email = invoice["clients"]["email"]
        subject = request.get("subject", f"Invoice {invoice['invoice_number']}")
        body = request.get("body", f"Hello,\n\nPlease find attached invoice {invoice['invoice_number']} for your recent services.\n\nThank you for your business!")
        
        message = MIMEMultipart()
        message['to'] = to_email
        message['from'] = gmail_email
        message['subject'] = subject
        
        msg_text = MIMEText(body, 'plain')
        message.attach(msg_text)
        
        # 5. FETCH THE PROFESSIONAL PDF from our own backend endpoint!
        print(f"Fetching professional PDF for invoice {invoice_id}...")
        pdf_res = await client.get(
            f"http://localhost:8000/api/invoices/{invoice_id}/pdf",
            headers={"Authorization": f"Bearer {token}"} # Pass the user's token to authenticate
        )
        pdf_bytes = pdf_res.content # Get the actual PDF bytes
        
        # 6. Attach the professional PDF
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header(
            'Content-Disposition',
            f'attachment; filename="Invoice-{invoice["invoice_number"]}.pdf"'
        )
        message.attach(part)
        
        # 7. Send email via Gmail API
        gmail_service = build('gmail', 'v1', credentials=Credentials(token=access_token))
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        
        try:
            sent_message = gmail_service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            # Update invoice status to "Sent"
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}",
                json={"status": "Sent"},
                headers=headers
            )
            
            print("=== EMAIL SENT SUCCESSFULLY WITH PROFESSIONAL PDF ===\n")
            return {"message": "Invoice sent successfully!", "message_id": sent_message['id']}
        except Exception as e:
            print(f"ERROR SENDING EMAIL: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@app.delete("/api/auth/google/disconnect")
async def disconnect_gmail(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{auth_data['user'].id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})
    return {"message": "Gmail disconnected successfully"}

# Add these imports at the TOP of main.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import date, timedelta

# --- REAL DASHBOARD DATA ---
@app.get("/api/dashboard")
async def get_dashboard_data(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
        
        # 1. Fetch user's preferred currency from profile
        profile_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=preferred_currency", headers=headers)
        profile_data = profile_res.json()
        target_currency = 'USD'
        if profile_data and isinstance(profile_data, list) and len(profile_data) > 0:
            target_currency = profile_data[0].get('preferred_currency', 'USD')
        
        # 2. Fetch exchange rates
        exchange_rates = {}
        try:
            rate_res = await client.get(f"https://api.exchangerate-api.com/v4/latest/USD")
            if rate_res.status_code == 200:
                exchange_rates = rate_res.json().get('rates', {})
        except Exception as e:
            print(f"Error fetching exchange rates for dashboard: {e}")
            exchange_rates = {'USD': 1}
        
        # 3. Fetch Clients
        clients_res = await client.get(f"{SUPABASE_URL}/rest/v1/clients?user_id=eq.{user.id}&select=id", headers=headers)
        
        # 4. Fetch ALL invoices for this user
        invoices_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=status,total,currency", headers=headers)
        inv_data = invoices_res.json()
        
        # 5. Group Statuses (Sent and Overdue are treated as Pending)
        pending = [inv for inv in inv_data if inv['status'] in ['Sent', 'Overdue']]
        paid = [inv for inv in inv_data if inv['status'] == 'Paid']
        
        # Helper function to convert amount to target currency
        def convert_to_target(amount, original_currency):
            if original_currency in exchange_rates:
                amount_in_usd = amount / exchange_rates[original_currency]
            else:
                amount_in_usd = amount
            return amount_in_usd * exchange_rates.get(target_currency, 1)
        
        # 6. Fetch Recent 5 Invoices (with client details)
        recent_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=*,clients(name)&order=created_at.desc&limit=5", 
            headers=headers
        )
        
        # 7. Fetch Pending/Overdue Invoices for the "Needs Attention" section
        pending_inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=*,clients(name)&status=in.(Sent,Overdue)&order=created_at.desc&limit=5", 
            headers=headers
        )

        return {
            "stats": {
                "clients": len(clients_res.json()),
                "pending_count": len(pending),
                "pending_amount": sum(convert_to_target(float(inv['total']), inv.get('currency', 'USD')) for inv in pending),
                "paid_count": len(paid),
                "revenue": sum(convert_to_target(float(inv['total']), inv.get('currency', 'USD')) for inv in paid)
            },
            "recent_invoices": recent_res.json(),
            "pending_invoices": pending_inv_res.json(),
            "preferred_currency": target_currency
        }

# --- RECURRING INVOICES API ---
@app.get("/api/recurring")
async def get_recurring(auth_data: dict = Depends(require_pro_plan)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{SUPABASE_URL}/rest/v1/recurring_invoices?user_id=eq.{auth_data['user'].id}&select=*,clients(name),recurring_invoice_items(*)", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"})
        return {"recurring": res.json()}

@app.post("/api/recurring")
async def create_recurring(request: dict, auth_data: dict = Depends(require_pro_plan)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    print(f"\n=== DEBUG CREATE RECURRING ===")
    print(f"User: {user.id}")
    print(f"Request data: {request}")
    
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=representation"}
    
    payload = {
        "user_id": user.id, 
        "client_id": request["client_id"], 
        "frequency": request["frequency"],
        "start_date": request["start_date"], 
        "day_of_month": request.get("day_of_month"),
        "day_of_week": request.get("day_of_week"), 
        "due_date_offset": request.get("due_date_offset", 15),
        "currency": request.get("currency", "USD"), 
        "subtotal": request["subtotal"],
        "tax": request["tax"], 
        "discount": request["discount"], 
        "notes": request.get("notes"),
        "status": "active"
    }
    
    print(f"Payload to DB: {payload}")
    
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{SUPABASE_URL}/rest/v1/recurring_invoices", json=payload, headers=headers)
        print(f"Response Status: {res.status_code}")
        print(f"Response Body: {res.text}")
        
        if res.status_code >= 400:
            raise HTTPException(status_code=res.status_code, detail=res.text)
            
        rec_id = res.json()[0]["id"]
        
        items = [{"recurring_id": rec_id, "product_id": i.get("product_id"), "description": i["description"], "quantity": i["quantity"], "rate": i["rate"], "amount": i["amount"]} for i in request.get("items", [])]
        if items:
            items_res = await client.post(f"{SUPABASE_URL}/rest/v1/recurring_invoice_items", json=items, headers=headers)
            print(f"Items Response: {items_res.status_code}")
            
    print("=== RECURRING CREATED SUCCESSFULLY ===\n")
    return {"message": "Recurring invoice created"}

@app.patch("/api/recurring/{rec_id}")
async def update_recurring_status(rec_id: str, request: dict, auth_data: dict = Depends(require_pro_plan)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        await client.patch(f"{SUPABASE_URL}/rest/v1/recurring_invoices?id=eq.{rec_id}&user_id=eq.{auth_data['user'].id}", json={"status": request["status"]}, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})
    return {"message": "Status updated"}

@app.delete("/api/recurring/{rec_id}")
async def delete_recurring(rec_id: str, auth_data: dict = Depends(require_pro_plan)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/recurring_invoices?id=eq.{rec_id}&user_id=eq.{auth_data['user'].id}", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})
    return {"message": "Deleted"}


def generate_ai_follow_up_email(client_name: str, invoice_number: str, amount: float, currency: str, days_overdue: int, org_name: str, due_date:str):
    """Uses Free Groq API to generate a smart follow-up email."""
    
    if days_overdue <= 5:
        tone = "friendly and casual, assuming they just missed it"
    elif days_overdue <= 14:
        tone = "professional and firm, asking for an update on the payment status"
    else:
        tone = "very strict and urgent, stating that further delay may impact future work, but still professional"

    prompt = f"""
    Write a short, professional email to a client named {client_name}.
    Context: They have an unpaid invoice ({invoice_number}) for {currency} {amount} which is {days_overdue} days overdue. Due date was {due_date}
    Tone: {tone}.
    Sign off as: {org_name}.
    Do not include subject lines, just the email body. Keep it under 100 words.
    Ensure there is no placeholder.
    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant", # Free, fast, and excellent model
            temperature=0.7,
            max_tokens=150
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"AI Generation failed: {e}")
        # Fallback template if AI fails
        return f"Hello {client_name},\n\nThis is a reminder that invoice {invoice_number} for {currency} {amount} is {days_overdue} days overdue.\n\nPlease process the payment at your earliest convenience.\n\nBest regards,\n{org_name}"
    



# --- BACKGROUND SCHEDULER ---
scheduler = AsyncIOScheduler()

async def check_recurring_invoices():
    print("🔄 Running recurring invoice check...")
    service_key = os.environ.get("SUPABSE_SERVICE_KEY")
    if not service_key: return
    
    today = date.today().isoformat()
    
    async with httpx.AsyncClient() as client:
        # Fetch all active recurring invoices
        res = await client.get(f"{SUPABASE_URL}/rest/v1/recurring_invoices?status=eq.active&start_date=lte.{today}", headers={"apikey": service_key, "Accept-Profile": "freelancing_demo"})
        recurring_list = res.json()
        
        for rec in recurring_list:
            # Simple logic: if last_generated is null or older than frequency period
            should_generate = False
            last_gen = rec.get('last_generated')
            
            if not last_gen:
                should_generate = True
            else:
                last_date = date.fromisoformat(last_gen)
                days_diff = (date.today() - last_date).days
                if rec['frequency'] == 'weekly' and days_diff >= 7: should_generate = True
                elif rec['frequency'] == 'monthly' and days_diff >= 30: should_generate = True
                elif rec['frequency'] == 'quarterly' and days_diff >= 90: should_generate = True
                elif rec['frequency'] == 'yearly' and days_diff >= 365: should_generate = True
                
            if should_generate:
                print(f"📄 Generating invoice for {rec['id']}")
                # 1. Get next invoice number (simplified for background task)
                inv_num = f"REC-{date.today().strftime('%Y%m%d')}" 
                
                # 2. Create Invoice
                inv_payload = {
                    "user_id": rec['user_id'], "client_id": rec['client_id'], "invoice_number": inv_num,
                    "status": "Draft", "subtotal": rec['subtotal'], "tax_amount": rec['tax'],
                    "discount": rec['discount'], "total": (rec['subtotal'] + rec['tax'] - rec['discount']),
                    "currency": rec['currency'], "due_date": (date.today() + timedelta(days=rec['due_date_offset'])).isoformat()
                }
                inv_res = await client.post(f"{SUPABASE_URL}/rest/v1/invoices", json=inv_payload, headers={"apikey": service_key, "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=representation"})
                new_inv_id = inv_res.json()[0]["id"]
                
                # 3. Copy Items
                items_res = await client.get(f"{SUPABASE_URL}/rest/v1/recurring_invoice_items?recurring_id=eq.{rec['id']}", headers={"apikey": service_key, "Accept-Profile": "freelancing_demo"})
                if items_res.json():
                    await client.post(f"{SUPABASE_URL}/rest/v1/invoice_items", json=[{"invoice_id": new_inv_id, **i} for i in items_res.json()], headers={"apikey": service_key, "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})
                
                # 4. Update last_generated
                await client.patch(f"{SUPABASE_URL}/rest/v1/recurring_invoices?id=eq.{rec['id']}", json={"last_generated": date.today().isoformat()}, headers={"apikey": service_key, "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})

async def check_overdue_invoices_and_remind():
    """Checks for overdue invoices and sends AI-powered smart reminders."""
    print("🔄 Running Smart Follow-up Check...")
    service_key = os.environ.get("SUPABSE_SERVICE_KEY")
    if not service_key: 
        print("❌ SUPABSE_SERVICE_KEY is missing from .env!")
        return
    
    today = date.today()
    
    async with httpx.AsyncClient() as client:
        # FIX: Added the crucial Authorization header!
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept-Profile": "freelancing_demo",
            "Content-Profile": "freelancing_demo"
        }
        
        # 1. Fetch Sent invoices (Removed the clients join to prevent silent failures)
        url = f"{SUPABASE_URL}/rest/v1/invoices?status=eq.Sent&select=*"
        print(f"Fetching: {url}")
        
        res = await client.get(url, headers=headers)
        print(f"Response Status: {res.status_code}")
        
        if res.status_code >= 400:
            print(f"❌ Supabase Error: {res.text}")
            return
            
        invoices = res.json()
        if not isinstance(invoices, list):
            print(f"❌ Unexpected response format: {invoices}")
            return
            
        print(f"✅ Found {len(invoices)} 'Sent' invoices to check.")
        
        for inv in invoices:
            # Calculate due date (use due_date column if it exists, else created_at + 15 days)
            due_date_str = inv.get('due_date')
            created_str = inv.get('created_at')
            
            if due_date_str:
                due_date = date.fromisoformat(due_date_str.split('T')[0])
            elif created_str:
                created = date.fromisoformat(created_str.split('T')[0])
                due_date = created + timedelta(days=15)
            else:
                continue
            print(f"Today is {today}")
            print(f"Due date is {due_date}")
            
            days_overdue = (today - due_date).days
            
            # Only remind if overdue by 3, 7, or 14 days (and haven't sent that specific reminder yet)
            reminder_count = inv.get('reminder_count', 0) or 0
            should_remind = False
            
            print(f"Total overdue for {inv['invoice_number']} is {days_overdue}")
            print(f"Total reminder_count for {inv['invoice_number']} is {reminder_count}")
            
            
            if days_overdue >= 3 and reminder_count == 0: 
                should_remind = True
            elif days_overdue >= 7 and reminder_count == 1: should_remind = True
            elif days_overdue >= 14 and reminder_count == 2: should_remind = True
            print(f"Should remind value:- {should_remind}")
            if should_remind:
                print(f"📧 Triggering AI reminder for {inv['invoice_number']} ({days_overdue} days overdue)")
                
                # Fetch Client Details separately
                client_res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/clients?id=eq.{inv['client_id']}&select=name,email", 
                    headers=headers
                )
                client_data = client_res.json()
                client_name = client_data[0]['name'] if client_data and len(client_data) > 0 else 'Valued Client'
                
                # Fetch Profile for Org Name
                profile_res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{inv['user_id']}&select=organization_name", 
                    headers=headers
                )
                profile_data = profile_res.json()
                org_name = profile_data[0]['organization_name'] if profile_data and len(profile_data) > 0 and profile_data[0].get('organization_name') else 'Freelancer'
                
                # 2. Generate AI Email
                email_body = generate_ai_follow_up_email(
                    client_name, 
                    inv['invoice_number'], 
                    inv['total'], 
                    inv.get('currency', 'USD'), 
                    days_overdue, 
                    org_name,
                    due_date = due_date
                )
                
                print(f"🤖 AI Email Body:\n{email_body}\n-------------------")
                
                # 3. Update DB to track reminder
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{inv['id']}", 
                    json={"last_reminder_sent": today.isoformat(), "reminder_count": reminder_count + 1}, 
                    headers=headers
                )
                print(f"✅ Reminder tracked in DB for {inv['invoice_number']}")

@app.on_event("startup")
async def start_scheduler():
    # Run recurring invoices at 1:00 AM
    scheduler.add_job(check_recurring_invoices, 'cron', hour=1, minute=0)
    # Run smart reminders at 9:00 AM (so clients get them in the morning)
    scheduler.add_job(check_overdue_invoices_and_remind, 'cron', hour=9, minute=0)
    # scheduler.add_job(check_overdue_invoices_and_remind, 'interval', minutes=1)
    scheduler.start()
    print(" FreelanceOS Schedulers started!")


# @app.on_event("startup")
# async def start_scheduler():
#     # Run every day at 1:00 AM
#     scheduler.add_job(check_recurring_invoices, 'cron', hour=1, minute=0)
#     scheduler.start()
#     print(" Recurring invoice scheduler started!")


# --- PUBLIC CLIENT PORTAL ROUTES (No Auth Required) ---

@app.get("/api/public/invoices/{invoice_id}")
async def get_public_invoice(invoice_id: str):
    service_key = os.environ.get("SUPABSE_SERVICE_KEY")
    
    # Safety check: Ensure the service key is actually loaded
    if not service_key:
        print("ERROR: SUPABSE_SERVICE_KEY is missing from .env file!")
        raise HTTPException(status_code=500, detail="Server configuration error: Service key missing.")

    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": service_key, 
            "Authorization": f"Bearer {service_key}",
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        
        url = f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)"
        inv_res = await client.get(url, headers=headers)
        
        response_data = inv_res.json()
        
        if isinstance(response_data, dict) and "message" in response_data:
            raise HTTPException(status_code=500, detail=f"Supabase Error: {response_data['message']}")
            
        if not response_data or len(response_data) == 0:
            raise HTTPException(status_code=404, detail="Invoice not found")
            
        invoice = response_data[0]
        
        # Fetch Items
        items_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}", headers=headers)
        invoice['items'] = items_res.json()
        
        # Fetch Profile (for Logo/GSTIN)
        profile_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{invoice['user_id']}&select=organization_name,gstin,logo_url", headers=headers)
        invoice['profile'] = profile_res.json()[0] if profile_res.json() else {}
        
        return {"invoice": invoice}

# --- RAZORPAY PAYMENT ROUTES ---

@app.post("/api/public/payments/create-order")
async def create_payment_order(request: dict):
    invoice_id = request.get("invoice_id")
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY, 
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}",
            "Accept-Profile": "freelancing_demo"
        }
        
        # Fetch invoice details including user_id for commission calculation
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=total,currency,invoice_number,user_id", 
            headers=headers
        )
        invoice = inv_res.json()[0]
        
        # Get freelancer profile for commission calculation
        profile_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{invoice['user_id']}&select=commission_percentage,payment_integration_enabled,razorpay_account_id,payout_destination_value",
            headers=headers
        )
        profile = profile_res.json()[0] if profile_res.json() else {}
        
        amount_in_paise = int(float(invoice['total']) * 100)
        currency = invoice.get('currency', 'INR')
        
        # Calculate commission and payout amounts
        commission_amount = 0
        freelancer_amount = amount_in_paise
        account_transfers = []
        
        # Check if freelancer has enabled payment integration and has payout details
        if profile.get("payment_integration_enabled") and profile.get("razorpay_account_id"):
            commission_pct = float(profile.get("commission_percentage", 2.0))
            commission_amount = int(amount_in_paise * (commission_pct / 100))
            freelancer_amount = amount_in_paise - commission_amount
            
            # Create account transfer for Razorpay Route
            account_transfers.append({
                "account": profile["razorpay_account_id"],
                "amount": freelancer_amount,
                "currency": currency,
                "on_hold": 0,
                "reference_id": f"inv_{invoice_id}"
            })
        
        order_data = {
            "amount": amount_in_paise,
            "currency": currency,
            "receipt": invoice_id,
            "payment_capture": 1
        }
        
        # Add account transfers if applicable
        if account_transfers:
            order_data["account_transfers"] = account_transfers
        
        order = razorpay_client.order.create(data=order_data)
        
        return {
            "order_id": order['id'], 
            "amount": invoice['total'],
            "amount_paise": amount_in_paise,
            "currency": order['currency'], 
            "key_id": os.environ.get("RAZORPAY_KEY_ID"),
            "invoice_number": invoice.get('invoice_number'),
            "commission_amount": commission_amount / 100,
            "freelancer_amount": freelancer_amount / 100,
            "payment_routing_enabled": len(account_transfers) > 0
        }

@app.post("/api/public/payments/verify")
async def verify_payment(request: dict):
    razorpay_order_id = request.get("razorpay_order_id")
    razorpay_payment_id = request.get("razorpay_payment_id")
    razorpay_signature = request.get("razorpay_signature")
    invoice_id = request.get("invoice_id")
    
    body = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_signature = hmac.new(
        os.environ.get("RAZORPAY_KEY_SECRET").encode(), 
        body.encode(), 
        hashlib.sha256
    ).hexdigest()
    
    if expected_signature != razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    async with httpx.AsyncClient() as client:
        # FIX: Use Service Role Key to update the database without being logged in
        headers = {
            "apikey": SUPABSE_SERVICE_KEY, 
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}",
            "Content-Type": "application/json", 
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        
        inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=user_id,total,currency", headers=headers)
        inv_data = inv_res.json()[0]
        
        # Get freelancer profile for commission calculation
        profile_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{inv_data['user_id']}&select=commission_percentage,payment_integration_enabled,razorpay_account_id",
            headers=headers
        )
        profile = profile_res.json()[0] if profile_res.json() else {}
        
        commission_pct = profile.get("commission_percentage", 2.00)
        payment_enabled = profile.get("payment_integration_enabled", False)
        total_amount = float(inv_data['total'])
        
        # Calculate commission and payout
        commission_amount = round((total_amount * commission_pct / 100), 2)
        freelancer_payout = round((total_amount - commission_amount), 2)
        
        # Update invoice status
        await client.patch(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}", json={
            "status": "Paid",
            "settlement_status": "pending",
            "payout_status": "pending_settlement",
            "razorpay_payment_id": razorpay_payment_id,
            "platform_commission_amount": commission_amount,
            "freelancer_payout_amount": freelancer_payout
        }, headers=headers)
        
        # Record payment
        await client.post(f"{SUPABASE_URL}/rest/v1/payments", json={
            "invoice_id": invoice_id,
            "user_id": inv_data['user_id'],
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
            "amount": total_amount,
            "currency": inv_data['currency'],
            "status": "paid"
        }, headers=headers)
        
        # Create payment_splits record
        await client.post(
            f"{SUPABASE_URL}/rest/v1/payment_splits",
            json={
                "invoice_id": invoice_id,
                "total_amount": total_amount,
                "commission_percentage": commission_pct,
                "commission_amount": commission_amount,
                "freelancer_amount": freelancer_payout,
                "split_status": "completed" if payment_enabled else "pending_manual",
                "razorpay_split_id": razorpay_payment_id
            },
            headers=headers
        )
        
        # Create payout record
        if payment_enabled and profile.get("razorpay_account_id"):
            await client.post(
                f"{SUPABASE_URL}/rest/v1/payouts",
                json={
                    "freelancer_id": inv_data['user_id'],
                    "invoice_id": invoice_id,
                    "amount": freelancer_payout,
                    "commission_amount": commission_amount,
                    "net_payout": freelancer_payout,
                    "status": "completed",
                    "payout_reference": razorpay_payment_id
                },
                headers=headers
            )
        else:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/payouts",
                json={
                    "freelancer_id": inv_data['user_id'],
                    "invoice_id": invoice_id,
                    "amount": freelancer_payout,
                    "commission_amount": commission_amount,
                    "net_payout": freelancer_payout,
                    "status": "pending_manual",
                    "payout_reference": None
                },
                headers=headers
            )
        
    return {
        "message": "Payment verified and invoice marked as Paid",
        "commission_amount": commission_amount,
        "freelancer_payout": freelancer_payout,
        "commission_percentage": commission_pct
    }

@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    webhook_signature = request.headers.get("x-razorpay-signature")
    body = await request.body()
    
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    if webhook_secret and webhook_signature:
        expected_signature = hmac.new(
            webhook_secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        if expected_signature != webhook_signature:
            print("❌ Webhook signature mismatch!")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    payload = json.loads(body)
    event = payload.get("event")
    print(f"🔔 Razorpay Webhook Event Received: {event}")
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY, 
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}", 
            "Content-Type": "application/json", 
            "Accept-Profile": "freelancing_demo", 
            "Content-Profile": "freelancing_demo"
        }
        
        if event in ["payment.captured", "order.paid", "payment.authorized"]:
            payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payment.get("order_id")
            razorpay_payment_id = payment.get("id")
            receipt_id = payment.get("receipt")
            notes = payment.get("notes", {})
            invoice_id_from_notes = notes.get("invoice_id")
            
            amount_paid = float(payment.get("amount", 0)) / 100.0 if payment.get("amount") else 0.0
            
            # Robust Invoice Lookup: Try receipt -> razorpay_order_id -> notes.invoice_id
            invoice = None
            if receipt_id:
                inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{receipt_id}&select=*,clients(name,email)", headers=headers)
                if inv_res.json() and isinstance(inv_res.json(), list) and len(inv_res.json()) > 0:
                    invoice = inv_res.json()[0]
            
            if not invoice and order_id:
                inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?razorpay_order_id=eq.{order_id}&select=*,clients(name,email)", headers=headers)
                if inv_res.json() and isinstance(inv_res.json(), list) and len(inv_res.json()) > 0:
                    invoice = inv_res.json()[0]
                    
            if not invoice and invoice_id_from_notes:
                inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id_from_notes}&select=*,clients(name,email)", headers=headers)
                if inv_res.json() and isinstance(inv_res.json(), list) and len(inv_res.json()) > 0:
                    invoice = inv_res.json()[0]

            if not invoice:
                print(f"⚠️ Webhook Warning: Could not match invoice for payment {razorpay_payment_id} (Order: {order_id}, Receipt: {receipt_id})")
                return {"status": "ignored", "reason": "Invoice not found"}

            target_invoice_id = invoice["id"]
            if amount_paid <= 0:
                amount_paid = float(invoice.get("total", 0))
            
            # Get freelancer profile for commission calculation
            profile_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{invoice['user_id']}&select=commission_percentage,payment_integration_enabled,razorpay_account_id",
                headers=headers
            )
            profile = profile_res.json()[0] if profile_res.json() and len(profile_res.json()) > 0 else {}
            
            commission_pct = profile.get("commission_percentage", 2.00)
            payment_enabled = profile.get("payment_integration_enabled", False)
            
            commission_amount = round((amount_paid * commission_pct / 100), 2)
            freelancer_payout = round((amount_paid - commission_amount), 2)
            
            # 1. Mark Client status as Paid
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{target_invoice_id}", 
                json={
                    "status": "Paid",
                    "settlement_status": "pending",
                    "payout_status": "pending_settlement",
                    "razorpay_payment_id": razorpay_payment_id,
                    "platform_commission_amount": commission_amount,
                    "freelancer_payout_amount": freelancer_payout
                }, 
                headers=headers
            )
            
            # 2. Record payment_splits
            await client.post(
                f"{SUPABASE_URL}/rest/v1/payment_splits",
                json={
                    "invoice_id": target_invoice_id,
                    "total_amount": amount_paid,
                    "commission_percentage": commission_pct,
                    "commission_amount": commission_amount,
                    "freelancer_amount": freelancer_payout,
                    "split_status": "completed" if payment_enabled else "pending_manual",
                    "razorpay_split_id": razorpay_payment_id
                },
                headers=headers
            )
            
            # 3. Trigger Auto-Email
            try:
                prof_for_pdf = await client.get(
                    f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{invoice['user_id']}&select=organization_name,gstin,logo_url",
                    headers=headers
                )
                invoice['profile'] = prof_for_pdf.json()[0] if prof_for_pdf.json() else {}
                await send_payment_success_email(invoice, client, headers)
            except Exception as e:
                print(f"⚠️ Failed to send payment success email: {e}")
                
            print(f"✅ Webhook SUCCESS: Invoice {target_invoice_id} marked as PAID for Client! Freelancer Payout is TO BE PAID.")

        elif event in ["transfer.processed", "settlement.processed", "payout.processed"]:
            # Automatic settlement event from Razorpay Route / Payouts
            transfer = payload.get("payload", {}).get("transfer", {}).get("entity", {}) or payload.get("payload", {}).get("payout", {}).get("entity", {})
            utr_num = transfer.get("utr") or transfer.get("id") or generate_mock_utr()
            
            # Find invoice by payout_transfer_id or razorpay_payment_id
            inv_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/invoices?payout_transfer_id=eq.{transfer.get('id')}&select=id,invoice_number",
                headers=headers
            )
            invs = inv_res.json() if inv_res.json() else []
            if invs:
                inv_id = invs[0]["id"]
                settled_at = datetime.utcnow().isoformat()
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{inv_id}",
                    json={
                        "status": "Completed",
                        "settlement_status": "settled",
                        "payout_status": "completed",
                        "utr_number": utr_num,
                        "settled_at": settled_at
                    },
                    headers=headers
                )
                print(f"✅ Webhook Settlement: Invoice {inv_id} set to Completed with UTR {utr_num}")

    return {"status": "success"}


@app.post("/api/webhooks/razorpay-subscription")
async def razorpay_subscription_webhook(request: Request):
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    signature = request.headers.get("x-razorpay-signature")
    body = await request.body()
    
    # Verify signature
    expected_signature = hmac.new(
        webhook_secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if signature != expected_signature:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    payload = json.loads(body)
    event = payload.get("event")
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Accept-Profile": "freelancing_demo",
            "Content-Profile": "freelancing_demo"
        }
        
        if event == "subscription.charged":
            # A payment was made (initial or recurring)
            sub_payload = payload.get("payload", {}).get("subscription", {}).get("entity", {})
            payment_payload = payload.get("payload", {}).get("payment", {}).get("entity", {})
            
            sub_id = sub_payload.get("id")
            payment_id = payment_payload.get("id")
            amount = payment_payload.get("amount", 0) / 100  # Convert paise to rupees
            currency = payment_payload.get("currency", "INR")
            
            # Find user by subscription ID
            user_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?razorpay_subscription_id=eq.{sub_id}&select=id",
                headers=headers
            )
            
            if user_res.json():
                user_id = user_res.json()[0]["id"]
                
                # Store payment record
                await client.post(
                    f"{SUPABASE_URL}/rest/v1/razorpay_payments",
                    json={
                        "user_id": user_id,
                        "razorpay_payment_id": payment_id,
                        "razorpay_subscription_id": sub_id,
                        "amount": amount,
                        "currency": currency,
                        "status": "captured"
                    },
                    headers=headers
                )
                
                # Update current_period_end (1 month from now)
                from datetime import datetime, timedelta
                next_billing = datetime.utcnow() + timedelta(days=30)
                
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user_id}",
                    json={
                        "subscription_plan": "pro",
                        "subscription_status": "active",
                        "current_period_end": next_billing.isoformat()
                    },
                    headers=headers
                )
                
                print(f"✅ Payment {payment_id} recorded for user {user_id}")
        
        elif event == "subscription.cancelled":
            # Subscription was fully cancelled (after cycle end)
            sub_payload = payload.get("payload", {}).get("subscription", {}).get("entity", {})
            sub_id = sub_payload.get("id")
            
            # Find user and downgrade to free
            user_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?razorpay_subscription_id=eq.{sub_id}&select=id",
                headers=headers
            )
            
            if user_res.json():
                user_id = user_res.json()[0]["id"]
                
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user_id}",
                    json={
                        "subscription_plan": "free",
                        "subscription_status": "inactive",
                        "razorpay_subscription_id": None
                    },
                    headers=headers
                )
                
                print(f"✅ User {user_id} downgraded to free after subscription ended")
    
    return {"status": "ok"}


# --- HELPER: Send Payment Success Auto-Email ---
async def send_payment_success_email(invoice: dict, client: httpx.AsyncClient, headers: dict):
    # 1. Get Gmail tokens for this user
    token_res = await client.get(f"{SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.{invoice['user_id']}", headers=headers)
    tokens_data = token_res.json()
    if not tokens_data or len(tokens_data) == 0:
        print("⚠️ No Gmail connected, skipping auto-email.")
        return
    
    token_record = tokens_data[0]
    access_token = decrypt_token(token_record["access_token"])
    gmail_email = token_record["gmail_email"]
    
    # 2. Build Email
    message = MIMEMultipart()
    message['to'] = invoice["clients"]["email"]
    message['from'] = gmail_email
    message['subject'] = f"Payment Received: Invoice {invoice['invoice_number']}"
    
    org_name = invoice.get('profile', {}).get('organization_name', 'Our Team')
    body = f"Hello {invoice['clients']['name']},\n\nThank you! We have successfully received your payment of {invoice['currency']} {invoice['total']} for Invoice {invoice['invoice_number']}.\n\nA copy of your paid invoice is attached for your records.\n\nBest regards,\n{org_name}"
    message.attach(MIMEText(body, 'plain'))
    
    # 3. Generate Professional PDF Attachment
    pdf_bytes = await get_invoice_pdf_bytes(invoice['id'], client, headers)
    
    part = MIMEBase('application', 'octet-stream')
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header('Content-Disposition', f'attachment; filename="Receipt-{invoice["invoice_number"]}.pdf"')
    message.attach(part)
    
    # 4. Send via Gmail API
    gmail_service = build('gmail', 'v1', credentials=Credentials(token=access_token))
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    try:
        gmail_service.users().messages().send(userId='me', body={'raw': raw_message}).execute()
        print(f"✅ Auto-email sent successfully to {invoice['clients']['email']}")
    except Exception as e:
        print(f"❌ Failed to send auto-email: {e}")


# ==============================================================================
# PAYMENT ROUTING ENDPOINTS (RazorpayX Route)
# ==============================================================================

@app.get("/api/payment-account/status")
async def get_payment_account_status(auth_data: dict = Depends(get_current_user)):
    """Get freelancer's payment account connection status"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
    async with httpx.AsyncClient() as client:
        # Try querying by user_id first, then id if not found
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=commission_percentage,razorpay_account_id,payment_integration_enabled,payout_destination_type,payout_destination_value",
            headers=headers
        )
        data = res.json() if res.json() and isinstance(res.json(), list) else []
        if not data:
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user.id}&select=commission_percentage,razorpay_account_id,payment_integration_enabled,payout_destination_type,payout_destination_value",
                headers=headers
            )
            data = res.json() if res.json() and isinstance(res.json(), list) else []
        
        profile = data[0] if data and len(data) > 0 else {}
        
        # Derive status from existing fields
        is_enabled = profile.get("payment_integration_enabled", False)
        has_account_id = bool(profile.get("razorpay_account_id"))
        has_payout_details = bool(profile.get("payout_destination_value"))
        
        if not is_enabled:
            status = "not_enabled"
        elif not has_account_id and not has_payout_details:
            status = "pending_setup"
        elif has_account_id or has_payout_details:
            status = "active"
        else:
            status = "inactive"
        
        return {
            "status": status,
            "account_id": profile.get("razorpay_account_id"),
            "enabled": is_enabled,
            "commission_percentage": profile.get("commission_percentage", 2.00),
            "payout_destination_type": profile.get("payout_destination_type", "bank"),
            "payout_details_provided": has_payout_details,
            "payout_destination_value": profile.get("payout_destination_value")
        }

@app.post("/api/payment-account/connect")
async def initiate_payment_account_connection(auth_data: dict = Depends(get_current_user)):
    """Initiate Razorpay Standard Onboarding for freelancer"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    onboard_url = "https://onboarding.razorpay.com/mock"
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept-Profile": "freelancing_demo",
        "Content-Profile": "freelancing_demo"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}",
            json={"payment_integration_enabled": True},
            headers=headers
        )
        if res.status_code >= 400:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user.id}",
                json={"payment_integration_enabled": True},
                headers=headers
            )
    
    return {"onboard_url": onboard_url, "message": "Payment integration enabled. Please add your bank/UPI details"}

@app.post("/api/payment-account/update-details")
async def update_payment_account_details(request: dict, auth_data: dict = Depends(get_current_user)):
    """Update freelancer's bank/UPI details for payout destination"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    update_data = {}
    
    # Handle payout destination type
    payout_type = request.get("payout_destination_type", "bank")
    update_data["payout_destination_type"] = payout_type
    
    # Check direct payout_destination_value first
    dest_val = request.get("payout_destination_value")
    
    if dest_val:
        update_data["payout_destination_value"] = str(dest_val) if not isinstance(dest_val, str) else dest_val
    elif payout_type == "bank":
        account_number = request.get("bank_account_number")
        ifsc_code = request.get("ifsc_code")
        account_holder_name = request.get("account_holder_name")
        pan_number = request.get("pan_number")
        
        if account_number and ifsc_code:
            bank_details = {
                "account_holder_name": account_holder_name or "",
                "account_number": account_number,
                "ifsc_code": ifsc_code,
                "pan_number": pan_number or ""
            }
            update_data["payout_destination_value"] = json.dumps(bank_details)
    elif payout_type == "upi":
        upi_id = request.get("upi_id")
        account_holder_name = request.get("account_holder_name")
        pan_number = request.get("pan_number")
        if upi_id:
            upi_details = {
                "upi_id": upi_id,
                "account_holder_name": account_holder_name or "",
                "pan_number": pan_number or ""
            }
            update_data["payout_destination_value"] = json.dumps(upi_details)

    # Optional international bank fields
    if "swift_code" in request: update_data["swift_code"] = request["swift_code"]
    if "iban_number" in request: update_data["iban_number"] = request["iban_number"]
    if "routing_number" in request: update_data["routing_number"] = request["routing_number"]
    if "bank_name" in request: update_data["bank_name"] = request["bank_name"]
    if "bank_country" in request: update_data["bank_country"] = request["bank_country"]
    if "account_holder_name" in request: update_data["account_holder_name"] = request["account_holder_name"]

    # Enable payment integration when payout details are set
    if "payment_integration_enabled" in request:
        update_data["payment_integration_enabled"] = request["payment_integration_enabled"]
    elif update_data.get("payout_destination_value"):
        update_data["payment_integration_enabled"] = True
    
    if "payout_destination_value" not in update_data and not any(k in update_data for k in ["swift_code", "iban_number"]):
        raise HTTPException(status_code=400, detail="No valid bank, UPI, or SWIFT details provided")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept-Profile": "freelancing_demo",
        "Content-Profile": "freelancing_demo",
        "Prefer": "return=representation"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}",
            json=update_data,
            headers=headers
        )
        res_data = response.json() if response.content else []
        if response.status_code >= 400 or (isinstance(res_data, list) and len(res_data) == 0):
            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user.id}",
                json=update_data,
                headers=headers
            )
        
        if response.status_code >= 400:
            error_detail = response.text
            raise HTTPException(status_code=response.status_code, detail=f"Failed to update profile: {error_detail}")
    
    response_json = response.json() if response.content else {}
    return {"message": "Payment account details updated successfully", "updated_fields": list(update_data.keys()), "data": response_json}

@app.post("/api/payment-account/toggle-integration")
async def toggle_payment_integration(request: dict, auth_data: dict = Depends(get_current_user)):
    """Enable/disable payment integration for invoices"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    enable = request.get("enable", False)
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept-Profile": "freelancing_demo",
        "Content-Profile": "freelancing_demo"
    }
    
    # Check if account has payout details before enabling
    if enable:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=payout_destination_value",
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
            )
            data = res.json() if res.json() and isinstance(res.json(), list) else []
            if not data:
                res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user.id}&select=payout_destination_value",
                    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
                )
                data = res.json() if res.json() and isinstance(res.json(), list) else []
                
        profile = data[0] if data and len(data) > 0 else {}
            
        has_payout_details = bool(profile.get("payout_destination_value"))
        if not has_payout_details:
            raise HTTPException(
                status_code=400, 
                detail="Please add your bank account or UPI ID first to enable payment integration"
            )
    
    async with httpx.AsyncClient() as client:
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}",
            json={"payment_integration_enabled": enable},
            headers=headers
        )
        if res.status_code >= 400:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user.id}",
                json={"payment_integration_enabled": enable},
                headers=headers
            )
    
    return {"message": f"Payment integration {'enabled' if enable else 'disabled'} successfully"}

@app.post("/api/payment-account/update-commission")
async def update_commission_percentage(request: dict, auth_data: dict = Depends(get_current_user)):
    """Update commission percentage (admin only feature)"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    commission_pct = request.get("commission_percentage")
    
    if commission_pct is None or commission_pct < 0 or commission_pct > 100:
        raise HTTPException(status_code=400, detail="Invalid commission percentage")
    
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}",
            json={"commission_percentage": commission_pct},
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo"
            }
        )
    
    return {"message": f"Commission percentage updated to {commission_pct}%"}

@app.post("/api/invoices/{invoice_id}/create-payment-order")
async def create_payment_order_with_routing(invoice_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    """Create Razorpay order with payment routing support"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {token}",
            "Accept-Profile": "freelancing_demo"
        }
        
        # Get invoice details
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)",
            headers=headers
        )
        
        if not inv_res.json():
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = inv_res.json()[0]
        
        # Get freelancer's profile for commission calculation
        profile_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=commission_percentage,enable_payment_integration,razorpay_account_id",
            headers=headers
        )
        
        profile = profile_res.json()[0] if profile_res.json() else {}
        commission_pct = profile.get("commission_percentage", 2.00)
        payment_enabled = profile.get("enable_payment_integration", False)
        
        # Calculate amounts
        total_amount = float(invoice.get("total", 0))
        amount_in_paise = int(total_amount * 100)
        
        # Calculate commission and payout
        commission_amount = round((total_amount * commission_pct / 100), 2)
        payout_amount = round((total_amount - commission_amount), 2)
        
        # Prepare order data
        order_data = {
            "amount": amount_in_paise,
            "currency": invoice.get("currency", "INR"),
            "receipt": invoice_id,
            "payment_capture": 1,
            "notes": {
                "invoice_number": invoice.get("invoice_number"),
                "user_id": user.id,
                "commission_percentage": commission_pct,
                "payout_amount": payout_amount
            }
        }
        
        # Add account transfers if payment routing is enabled
        if payment_enabled and profile.get("razorpay_account_id"):
            # Razorpay Route: Transfer to freelancer's connected account
            order_data["account_transfers"] = [
                {
                    "account": profile["razorpay_account_id"],
                    "amount": int(payout_amount * 100),  # Convert to paise
                    "currency": invoice.get("currency", "INR"),
                    "on_hold": 0,
                    "on_hold_until": None
                }
            ]
        
        # Create Razorpay order
        order = razorpay_client.order.create(data=order_data)
        
        # Save order ID and payment details to invoice
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}",
            json={
                "razorpay_order_id": order["id"],
                "payment_integration_enabled": payment_enabled,
                "platform_commission_amount": commission_amount,
                "freelancer_payout_amount": payout_amount
            },
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo"
            }
        )
        
        return {
            "order_id": order["id"],
            "amount": amount_in_paise,
            "currency": order["currency"],
            "key_id": os.environ.get("RAZORPAY_KEY_ID"),
            "invoice_number": invoice.get("invoice_number"),
            "payment_routing_enabled": payment_enabled,
            "commission_amount": commission_amount,
            "payout_amount": payout_amount,
            "commission_percentage": commission_pct
        }

@app.get("/api/payouts")
async def get_payouts(auth_data: dict = Depends(get_current_user)):
    """Get all payouts for the freelancer"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/payouts?freelancer_id=eq.{user.id}&order=created_at.desc",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo"
            }
        )
        
        return {"payouts": res.json()}

@app.get("/api/payment-splits")
async def get_payment_splits(auth_data: dict = Depends(get_current_user)):
    """Get all payment splits for the freelancer's invoices"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        # Get all invoices for this user first
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=id",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo"
            }
        )
        invoice_ids = [inv['id'] for inv in inv_res.json()] if inv_res.json() else []
        
        if not invoice_ids:
            return {"payment_splits": []}
        
        # Get payment splits for these invoices
        split_ids = ",".join([f"{iid}" for iid in invoice_ids])
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/payment_splits?invoice_id=in.({split_ids})&order=created_at.desc",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo"
            }
        )
        
        return {"payment_splits": res.json()}

@app.get("/api/commissions")
async def get_commission_transactions(auth_data: dict = Depends(get_current_user)):
    """Get all commission transactions for the platform (admin only)"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    # Check if user is admin (you may want to add an admin flag to profiles)
    async with httpx.AsyncClient() as client:
        profile_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=is_admin",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo"
            }
        )
        profile = profile_res.json()[0] if profile_res.json() else {}
        
        if not profile.get("is_admin", False):
            # Return only their own commission data
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/payment_splits?select=*&order=created_at.desc",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {token}",
                    "Accept-Profile": "freelancing_demo"
                }
            )
            return {"commissions": res.json()}
        
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/payment_splits?order=created_at.desc",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo"
            }
        )
        
        return {"commissions": res.json()}

@app.get("/api/commissions/summary")
async def get_commission_summary(auth_data: dict = Depends(get_current_user)):
    """Get commission summary statistics"""
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        # Get total commissions from payment_splits
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/payment_splits?select=commission_amount,split_status",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo"
            }
        )
        
        splits = res.json()
        
        total_commission = sum(s.get("commission_amount", 0) for s in splits if s.get("split_status") == "completed")
        pending_commission = sum(s.get("commission_amount", 0) for s in splits if s.get("split_status") in ["pending", "pending_manual"])
        
        return {
            "total_earned": total_commission,
            "pending": pending_commission,
            "transaction_count": len(splits)
        }


@app.get("/api/reports/summary")
async def get_financial_reports(auth_data: dict = Depends(get_current_user)):
    user_id = auth_data["user"].id
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
        
        # Fetch all non-void invoices
        res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user_id}&status=neq.Void&select=*,clients(name)", headers=headers)
        invoices = res.json()
        
        total_billed = 0.0
        total_collected = 0.0
        total_pending = 0.0
        total_tax_collected = 0.0 # Changed from GST to generic Tax
        
        monthly_data = {} 
        
        for inv in invoices:
            amount = float(inv.get('total', 0))
            tax = float(inv.get('tax_amount', inv.get('tax', 0)))
            status = inv.get('status')
            date_str = inv.get('created_at', '').split('T')[0]
            month = date_str[:7] 
            
            total_billed += amount
            total_tax_collected += tax # Summing whatever tax they charged
            
            if status in ['Paid', 'Completed']:
                total_collected += amount
            else:
                total_pending += amount
                
            if month not in monthly_data:
                monthly_data[month] = {"billed": 0, "collected": 0}
            monthly_data[month]["billed"] += amount
            if status in ['Paid', 'Completed']:
                monthly_data[month]["collected"] += amount

        return {
            "summary": {
                "total_billed": total_billed,
                "total_collected": total_collected,
                "total_pending": total_pending,
                "total_tax": total_tax_collected # Returning generic tax
            },
            "monthly": monthly_data
        }

@app.get("/api/reports/download-csv")
async def download_reports_csv(auth_data: dict = Depends(get_current_user)):
    user_id = auth_data["user"].id
    token = auth_data["token"]
    import csv
    import io

    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
        
        # Fetch user's preferred currency from profile
        profile_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user_id}&select=preferred_currency", headers=headers)
        profile_data = profile_res.json()
        target_currency = 'USD'
        if profile_data and isinstance(profile_data, list) and len(profile_data) > 0:
            target_currency = profile_data[0].get('preferred_currency', 'USD')
        
        # Fetch exchange rates (using free API)
        exchange_rates = {}
        try:
            rate_res = await client.get(f"https://api.exchangerate-api.com/v4/latest/USD")
            if rate_res.status_code == 200:
                rate_data = rate_res.json()
                exchange_rates = rate_data.get('rates', {})
        except Exception as e:
            print(f"Error fetching exchange rates: {e}")
            # Fallback to 1:1 if API fails
            exchange_rates = {'USD': 1}
        
        res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user_id}&status=neq.Void&select=*,clients(name)", headers=headers)
        invoices = res.json()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Invoice Number", "Client", "Date", "Status", "Subtotal", "Tax", "Total", "Original Currency", f"Total ({target_currency})"])

        for inv in invoices:
            original_total = float(inv.get('total', 0))
            original_currency = inv.get('currency', 'USD')
            
            # Convert to target currency
            # First convert to USD, then to target currency
            if original_currency in exchange_rates:
                amount_in_usd = original_total / exchange_rates[original_currency]
            else:
                amount_in_usd = original_total  # Assume USD if not found
            
            converted_total = amount_in_usd * exchange_rates.get(target_currency, 1)
            
            writer.writerow([
                inv.get('invoice_number'),
                inv.get('clients', {}).get('name', 'Unknown'),
                inv.get('created_at', '').split('T')[0],
                inv.get('status'),
                inv.get('subtotal'),
                inv.get('tax_amount', inv.get('tax', 0)),
                f"{original_total:.2f}",
                original_currency,
                f"{converted_total:.2f}"
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=invoices_report_{target_currency}.csv"}
        )


import time # Add this to your top imports if not already there

@app.post("/api/subscription/activate")
async def activate_subscription(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        # This ONLY updates the subscription columns, protecting your other settings
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}",
            json={"subscription_plan": "pro", "subscription_status": "active"},
            headers={
                "apikey": SUPABASE_KEY, 
                "Authorization": f"Bearer {token}", 
                "Content-Type": "application/json", 
                "Accept-Profile": "freelancing_demo", 
                "Content-Profile": "freelancing_demo"
            }
        )
        
        if res.status_code >= 400:
            print(f"❌ DB Update Failed: {res.text}")
            raise HTTPException(status_code=500, detail="Failed to activate subscription in database")
            
    return {"message": "Subscription activated successfully"}


@app.post("/api/subscription/create-checkout")
async def create_subscription_checkout(auth_data: dict = Depends(get_current_user)):
    plan_id = os.environ.get("RAZORPAY_PLAN_ID")
    if not plan_id:
        raise HTTPException(status_code=500, detail="Razorpay Plan ID not configured in .env")
    print(f"Plan ID is {plan_id}")
    # Create a 12-month subscription
    sub_data = {
        "plan_id": plan_id,
        "customer_notify": 1,
        "quantity": 1,
        "total_count": 12,
        "start_at": int(time.time()) + 120, # Starts in 1 hour
        "expire_by": int(time.time()) + (365 * 24 * 3600),
        "notes": {"user_id": auth_data["user"].id}
    }
    subscription = razorpay_client.subscription.create(data=sub_data)
    
    # Save subscription ID to DB immediately
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{auth_data['user'].id}",
            json={"razorpay_subscription_id": subscription['id'], "subscription_status": "pending"},
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {auth_data['token']}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
        )
        
    return {"subscription_id": subscription['id'], "key_id": os.environ.get("RAZORPAY_KEY_ID")}

@app.post("/api/subscription/cancel")
async def cancel_subscription(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        # 1. Get subscription ID
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}&select=razorpay_subscription_id,current_period_end", 
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"}
        )
        data = res.json() if res.json() else []
        profile = data[0] if data and len(data) > 0 else {}
        sub_id = profile.get("razorpay_subscription_id")
        
        if not sub_id:
            raise HTTPException(status_code=400, detail="No active subscription found")
        
        # 2. Cancel in Razorpay (at cycle end)
        try:
            razorpay_client.subscription.cancel(sub_id, {"cancel_at_cycle_end": 1})
            print(f"✅ Razorpay subscription {sub_id} marked for cancellation at cycle end.")
        except Exception as e:
            error_msg = str(e)
            if "no billing cycle is going on" in error_msg or "already cancelled" in error_msg.lower():
                print(f"⚠️ Razorpay cancellation skipped: {error_msg}")
            else:
                print(f"❌ Razorpay cancellation failed: {error_msg}")
        
        # 3. Update DB: Keep Pro plan, but mark as canceled
        # The user will keep Pro access until current_period_end
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user.id}", 
            json={"subscription_status": "canceled"}, 
            headers={
                "apikey": SUPABASE_KEY, 
                "Authorization": f"Bearer {token}", 
                "Content-Type": "application/json", 
                "Accept-Profile": "freelancing_demo", 
                "Content-Profile": "freelancing_demo"
            }
        )
        
    return {"message": "Subscription will remain active until the end of your current billing cycle. You won't be charged next month."}


@app.post("/api/subscription/activate")
async def activate_pro_plan(auth_data: dict = Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        await client.patch(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{auth_data['user'].id}", json={"subscription_plan": "pro"}, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {auth_data['token']}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})
    return {"message": "Upgraded!"}


# ==============================================================================
# UNIVERSAL ANY-TO-ANY CURRENCY CONVERSION ENGINE
# ==============================================================================

EXCHANGE_RATES_CACHE = {
    "rates": {},
    "last_updated": None
}

async def fetch_latest_rates(base_currency: str = "USD") -> dict:
    """Fetch live exchange rates with caching (cached for 1 hour)"""
    global EXCHANGE_RATES_CACHE
    now = datetime.utcnow()
    
    if (EXCHANGE_RATES_CACHE["last_updated"] and 
        (now - EXCHANGE_RATES_CACHE["last_updated"]).total_seconds() < 3600 and 
        EXCHANGE_RATES_CACHE["rates"].get(base_currency.upper())):
        return EXCHANGE_RATES_CACHE["rates"][base_currency.upper()]
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"https://api.exchangerate-api.com/v4/latest/{base_currency.upper()}")
            if resp.status_code == 200:
                data = resp.json()
                rates = data.get("rates", {})
                if not EXCHANGE_RATES_CACHE["rates"]:
                    EXCHANGE_RATES_CACHE["rates"] = {}
                EXCHANGE_RATES_CACHE["rates"][base_currency.upper()] = rates
                EXCHANGE_RATES_CACHE["last_updated"] = now
                return rates
    except Exception as e:
        print(f"⚠️ Exchange rate API error: {e}")
    
    # Fallback default cross rates relative to USD if network is offline
    fallback_rates = {
        "USD": 1.0, "EUR": 0.92, "GBP": 0.78, "INR": 83.50, "NPR": 133.60,
        "CAD": 1.36, "AUD": 1.52, "JPY": 155.0, "AED": 3.67, "SAR": 3.75,
        "SGD": 1.35, "CHF": 0.90, "NZD": 1.65, "ZAR": 18.20, "CNY": 7.25
    }
    return fallback_rates

@app.get("/api/currency/rates")
async def get_currency_rates(base: str = "USD"):
    """Get all live exchange rates relative to a base currency"""
    rates = await fetch_latest_rates(base.upper())
    return {
        "base": base.upper(),
        "rates": rates,
        "supported_currencies": list(rates.keys())
    }

@app.post("/api/currency/convert")
async def convert_currency(request: dict):
    """
    Universal Any-to-Any Currency Converter
    Converts amount from_currency to to_currency (e.g. UK to US, CAD to INR, INR to NPR, etc.)
    """
    from_curr = str(request.get("from_currency", "USD")).upper()
    to_curr = str(request.get("to_currency", "INR")).upper()
    try:
        amount = float(request.get("amount", 0))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    if from_curr == to_curr:
        return {
            "amount": amount,
            "from_currency": from_curr,
            "to_currency": to_curr,
            "converted_amount": round(amount, 2),
            "exchange_rate": 1.0,
            "formatted_result": f"{from_curr} {amount:,.2f} = {to_curr} {amount:,.2f}"
        }
    
    # Fetch base rates (USD reference cross rates)
    usd_rates = await fetch_latest_rates("USD")
    
    from_rate_in_usd = usd_rates.get(from_curr)
    to_rate_in_usd = usd_rates.get(to_curr)
    
    if not from_rate_in_usd or not to_rate_in_usd:
        raise HTTPException(status_code=400, detail=f"Unsupported currency conversion pair: {from_curr} -> {to_curr}")
    
    # Cross rate formula: (Amount / Rate_from) * Rate_to
    amount_in_usd = amount / from_rate_in_usd
    converted_amount = amount_in_usd * to_rate_in_usd
    cross_rate = to_rate_in_usd / from_rate_in_usd
    
    return {
        "amount": amount,
        "from_currency": from_curr,
        "to_currency": to_curr,
        "converted_amount": round(converted_amount, 2),
        "exchange_rate": round(cross_rate, 6),
        "formatted_result": f"{from_curr} {amount:,.2f} = {to_curr} {converted_amount:,.2f}"
    }


# ==============================================================================
# SETTLEMENT & UTR MANAGEMENT ENDPOINTS
# ==============================================================================

import random
import string

def generate_mock_utr():
    """Generates a standard bank format UTR number (e.g., UTR20260802987654)"""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    random_digits = ''.join(random.choices(string.digits, k=8))
    return f"UTR{date_part}{random_digits}"

@app.post("/api/invoices/{invoice_id}/settle")
async def settle_invoice_payout(invoice_id: str, request: dict = {}, auth_data: dict = Depends(get_current_user)):
    """
    Settle payout to freelancer for an invoice.
    Updates status from Paid -> Completed and records UTR number.
    """
    user = auth_data["user"]
    token = auth_data["token"]
    
    utr_number = request.get("utr_number")
    if not utr_number:
        utr_number = generate_mock_utr()
    
    headers = {
        "apikey": SUPABSE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept-Profile": "freelancing_demo",
        "Content-Profile": "freelancing_demo",
        "Prefer": "return=representation"
    }
    
    async with httpx.AsyncClient() as client:
        # Check invoice status first
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}",
            headers=headers
        )
        inv_data = inv_res.json() if inv_res.json() else []
        if not inv_data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = inv_data[0]
        
        # Settle invoice: set status to Completed, settlement_status to settled, record UTR
        settled_at = datetime.utcnow().isoformat()
        update_payload = {
            "status": "Completed",
            "settlement_status": "settled",
            "payout_status": "completed",
            "utr_number": utr_number,
            "settled_at": settled_at
        }
        
        upd_res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}",
            json=update_payload,
            headers=headers
        )
        
        # Update corresponding payouts record if present
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/payouts?invoice_id=eq.{invoice_id}",
            json={"status": "completed", "utr_number": utr_number, "processed_at": settled_at},
            headers=headers
        )
        
        return {
            "message": "Invoice payout successfully settled and marked as Completed!",
            "invoice_id": invoice_id,
            "invoice_number": invoice.get("invoice_number"),
            "status": "Completed",
            "settlement_status": "settled",
            "utr_number": utr_number,
            "settled_at": settled_at
        }

@app.get("/api/public/invoices/{invoice_id}/settlement-status")
async def get_public_invoice_settlement_status(invoice_id: str):
    """Public endpoint to check settlement and UTR status of an invoice"""
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}",
            "Accept-Profile": "freelancing_demo"
        }
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=id,invoice_number,status,settlement_status,utr_number,settled_at,freelancer_payout_amount,currency",
            headers=headers
        )
        data = res.json() if res.json() else []
        if not data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return {"settlement_info": data[0]}


# ==============================================================================
# INTERNATIONAL CLIENT & WIRE PAYMENT ENDPOINTS
# ==============================================================================

@app.get("/api/public/invoices/{invoice_id}/international-details")
async def get_international_wire_details(invoice_id: str):
    """Public endpoint returning international bank wire (SWIFT/IBAN) details for an invoice"""
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABSE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}",
            "Accept-Profile": "freelancing_demo"
        }
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=id,invoice_number,total,currency,user_id,is_international",
            headers=headers
        )
        inv = inv_res.json()[0] if inv_res.json() else None
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        prof_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{inv['user_id']}&select=organization_name,account_holder_name,bank_name,bank_account_number,swift_code,iban_number,routing_number,bank_country",
            headers=headers
        )
        prof = prof_res.json()[0] if prof_res.json() else {}
        
        return {
            "invoice_number": inv.get("invoice_number"),
            "total_amount": inv.get("total"),
            "currency": inv.get("currency"),
            "is_international": inv.get("is_international", True),
            "wire_details": {
                "account_holder_name": prof.get("account_holder_name") or prof.get("organization_name") or "Freelancer Account",
                "bank_name": prof.get("bank_name") or "HDFC / ICICI International Wire Bank",
                "bank_account_number": prof.get("bank_account_number") or "N/A",
                "swift_code": prof.get("swift_code") or "HDFCINBBXXX",
                "iban_number": prof.get("iban_number") or "IN93HDFC00001234567890",
                "routing_number": prof.get("routing_number") or "021000021",
                "bank_country": prof.get("bank_country") or "IN",
                "reference_code": f"INV-{inv.get('invoice_number')}"
            }
        }


# ==============================================================================
# SETTLED TRANSACTIONS LEDGER ENDPOINT
# ==============================================================================

@app.get("/api/transactions")
async def get_settled_transactions(auth_data: dict = Depends(get_current_user)):
    """
    Get list of all client-to-freelancer transactions.
    Tracks client status (Paid) and freelancer payout status (To Be Paid -> Paid with UTR).
    """
    user = auth_data["user"]
    token = auth_data["token"]
    
    async with httpx.AsyncClient() as client:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {token}",
            "Accept-Profile": "freelancing_demo"
        }
        
        # Query invoices that have client payments (status Paid or Completed)
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&status=in.(Paid,Completed)&select=*,clients(name,email)&order=created_at.desc",
            headers=headers
        )
        
        invoices = res.json() if res.json() else []
        
        transactions = []
        for inv in invoices:
            total_amount = float(inv.get("total", 0))
            commission_amount = float(inv.get("platform_commission_amount") or round(total_amount * 0.02, 2))
            payout_amount = float(inv.get("freelancer_payout_amount") or round(total_amount - commission_amount, 2))
            
            # Map status
            is_settled = inv.get("status") == "Completed" or inv.get("settlement_status") == "settled" or inv.get("payout_status") == "completed"
            
            freelancer_payout_status = "Paid" if is_settled else "To Be Paid"
            client_status = "Paid"
            
            transactions.append({
                "id": inv.get("id"),
                "invoice_number": inv.get("invoice_number"),
                "client_name": inv.get("clients", {}).get("name") if inv.get("clients") else "Client",
                "client_email": inv.get("clients", {}).get("email") if inv.get("clients") else "N/A",
                "total_amount": total_amount,
                "currency": inv.get("currency", "USD"),
                "commission_amount": commission_amount,
                "freelancer_payout_amount": payout_amount,
                "client_status": client_status,
                "freelancer_payout_status": freelancer_payout_status,
                "utr_number": inv.get("utr_number"),
                "settled_at": inv.get("settled_at"),
                "created_at": inv.get("created_at"),
                "is_international": inv.get("is_international", False)
            })
            
        total_settled = sum(t["freelancer_payout_amount"] for t in transactions if t["freelancer_payout_status"] == "Paid")
        total_to_be_paid = sum(t["freelancer_payout_amount"] for t in transactions if t["freelancer_payout_status"] == "To Be Paid")
        total_commission = sum(t["commission_amount"] for t in transactions)
        
        return {
            "transactions": transactions,
            "summary": {
                "total_settled_amount": round(total_settled, 2),
                "total_to_be_paid_amount": round(total_to_be_paid, 2),
                "total_commission_amount": round(total_commission, 2),
                "count_total": len(transactions),
                "count_settled": sum(1 for t in transactions if t["freelancer_payout_status"] == "Paid"),
                "count_pending": sum(1 for t in transactions if t["freelancer_payout_status"] == "To Be Paid")
            }
        }


# ============================================
# EXPENSE TRACKING APIs
# ============================================

@app.get("/api/expenses/categories")
async def get_expense_categories(current_user: dict = Depends(verify_token)):
    """Get all expense categories for the user including global defaults"""
    try:
        user_id = current_user.get('user_id')
        
        result = supabase.from_('expense_categories')\
            .select('*')\
            .or_(f'user_id.eq.{user_id},user_id.is.null')\
            .order('name')\
            .execute()
        
        return {"categories": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/expenses/categories")
async def create_expense_category(category: ExpenseCategoryCreate, current_user: dict = Depends(verify_token)):
    """Create a custom expense category"""
    try:
        user_id = current_user.get('user_id')
        
        data = {
            "user_id": user_id,
            "name": category.name,
            "description": category.description,
            "color": category.color,
            "is_default": False
        }
        
        result = supabase.table('expense_categories').insert(data).execute()
        return {"category": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/expenses/categories/{category_id}")
async def update_expense_category(category_id: str, category: ExpenseCategoryUpdate, current_user: dict = Depends(verify_token)):
    """Update an expense category"""
    try:
        user_id = current_user.get('user_id')
        
        # Verify ownership
        existing = supabase.from_('expense_categories')\
            .select('user_id, is_default')\
            .eq('id', category_id)\
            .execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Category not found")
        
        if existing.data[0].get('is_default') and existing.data[0].get('user_id') is None:
            raise HTTPException(status_code=403, detail="Cannot modify default categories")
        
        if existing.data[0].get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this category")
        
        update_data = {}
        if category.name is not None:
            update_data['name'] = category.name
        if category.description is not None:
            update_data['description'] = category.description
        if category.color is not None:
            update_data['color'] = category.color
        
        result = supabase.table('expense_categories')\
            .update(update_data)\
            .eq('id', category_id)\
            .execute()
        
        return {"category": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/expenses/categories/{category_id}")
async def delete_expense_category(category_id: str, current_user: dict = Depends(verify_token)):
    """Delete an expense category (cannot delete default categories)"""
    try:
        user_id = current_user.get('user_id')
        
        # Verify ownership and check if default
        existing = supabase.from_('expense_categories')\
            .select('user_id, is_default')\
            .eq('id', category_id)\
            .execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Category not found")
        
        if existing.data[0].get('is_default'):
            raise HTTPException(status_code=403, detail="Cannot delete default categories")
        
        if existing.data[0].get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this category")
        
        supabase.table('expense_categories').delete().eq('id', category_id).execute()
        return {"message": "Category deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/expenses")
async def get_expenses(
    category: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(verify_token)
):
    """Get all expenses with optional filters"""
    try:
        user_id = current_user.get('user_id')
        
        query = supabase.from_('expenses').select('*, expense_categories(name, color)').eq('user_id', user_id)
        
        if category:
            query = query.eq('category', category)
        
        if status:
            query = query.eq('status', status)
        
        if start_date:
            query = query.gte('expense_date', start_date)
        
        if end_date:
            query = query.lte('expense_date', end_date)
        
        query = query.order('expense_date', desc=True).range(offset, offset + limit - 1)
        
        result = query.execute()
        
        # Get total count
        count_query = supabase.from_('expenses').select('*', count='exact').eq('user_id', user_id)
        if category:
            count_query = count_query.eq('category', category)
        if status:
            count_query = count_query.eq('status', status)
        if start_date:
            count_query = count_query.gte('expense_date', start_date)
        if end_date:
            count_query = count_query.lte('expense_date', end_date)
        
        count_result = count_query.execute()
        total_count = count_result.count if hasattr(count_result, 'count') else len(result.data or [])
        
        return {
            "expenses": result.data or [],
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/expenses")
async def create_expense(expense: ExpenseCreate, current_user: dict = Depends(verify_token)):
    """Create a new expense"""
    try:
        user_id = current_user.get('user_id')
        
        data = expense.model_dump()
        data['user_id'] = user_id
        
        result = supabase.table('expenses').insert(data).execute()
        return {"expense": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/expenses/{expense_id}")
async def update_expense(expense_id: str, expense: ExpenseUpdate, current_user: dict = Depends(verify_token)):
    """Update an expense"""
    try:
        user_id = current_user.get('user_id')
        
        # Verify ownership
        existing = supabase.from_('expenses')\
            .select('user_id')\
            .eq('id', expense_id)\
            .execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if existing.data[0].get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this expense")
        
        update_data = {k: v for k, v in expense.model_dump().items() if v is not None}
        
        result = supabase.table('expenses')\
            .update(update_data)\
            .eq('id', expense_id)\
            .execute()
        
        return {"expense": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(verify_token)):
    """Delete an expense"""
    try:
        user_id = current_user.get('user_id')
        
        # Verify ownership
        existing = supabase.from_('expenses')\
            .select('user_id')\
            .eq('id', expense_id)\
            .execute()
        
        if not existing.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if existing.data[0].get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this expense")
        
        supabase.table('expenses').delete().eq('id', expense_id).execute()
        return {"message": "Expense deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/expenses/analytics")
async def get_expense_analytics(
    months: int = 6,
    current_user: dict = Depends(verify_token)
):
    """Get expense analytics with category breakdown and monthly trends"""
    try:
        user_id = current_user.get('user_id')
        
        # Calculate date range
        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=months*30)
        
        # Get expenses in range
        result = supabase.from_('expenses')\
            .select('category, amount, currency, expense_date, tax_amount, is_tax_deductible')\
            .eq('user_id', user_id)\
            .gte('expense_date', start_date.isoformat())\
            .lte('expense_date', end_date.isoformat())\
            .execute()
        
        expenses = result.data or []
        
        # Category breakdown
        category_breakdown = {}
        for exp in expenses:
            cat = exp['category']
            if cat not in category_breakdown:
                category_breakdown[cat] = {'total': 0, 'count': 0, 'tax_deductible': 0}
            category_breakdown[cat]['total'] += float(exp['amount'])
            category_breakdown[cat]['count'] += 1
            if exp.get('is_tax_deductible'):
                category_breakdown[cat]['tax_deductible'] += float(exp['amount'])
        
        # Monthly trend
        monthly_trend = {}
        for exp in expenses:
            month = exp['expense_date'][:7]  # YYYY-MM
            if month not in monthly_trend:
                monthly_trend[month] = 0
            monthly_trend[month] += float(exp['amount'])
        
        # Sort monthly trend
        sorted_months = sorted(monthly_trend.keys())
        monthly_data = [{'month': m, 'amount': monthly_trend[m]} for m in sorted_months]
        
        # Totals
        total_expenses = sum(float(e['amount']) for e in expenses)
        total_tax_deductible = sum(float(e['amount']) for e in expenses if e.get('is_tax_deductible'))
        total_tax = sum(float(e.get('tax_amount', 0)) for e in expenses)
        
        return {
            "category_breakdown": category_breakdown,
            "monthly_trend": monthly_data,
            "totals": {
                "total_expenses": round(total_expenses, 2),
                "total_tax_deductible": round(total_tax_deductible, 2),
                "total_tax": round(total_tax, 2),
                "expense_count": len(expenses)
            },
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "months": months
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/expenses/stats")
async def get_expense_stats(current_user: dict = Depends(verify_token)):
    """Get quick expense statistics for dashboard"""
    try:
        user_id = current_user.get('user_id')
        now = datetime.now(timezone.utc)
        
        # Current month
        current_month_start = now.replace(day=1).strftime('%Y-%m-%d')
        current_month_result = supabase.from_('expenses')\
            .select('amount')\
            .eq('user_id', user_id)\
            .gte('expense_date', current_month_start)\
            .execute()
        current_month_total = sum(float(e['amount']) for e in (current_month_result.data or []))
        
        # Previous month
        if now.month == 1:
            prev_month_start = f"{now.year-1}-12-01"
            prev_month_end = f"{now.year-1}-12-31"
        else:
            prev_month_start = f"{now.year}-{now.month-1:02d}-01"
            last_day = (now.replace(day=1) - timedelta(days=1)).day
            prev_month_end = f"{now.year}-{now.month-1:02d}-{last_day:02d}"
        
        prev_month_result = supabase.from_('expenses')\
            .select('amount')\
            .eq('user_id', user_id)\
            .gte('expense_date', prev_month_start)\
            .lte('expense_date', prev_month_end)\
            .execute()
        prev_month_total = sum(float(e['amount']) for e in (prev_month_result.data or []))
        
        # Tax deductible this month
        tax_deductible_result = supabase.from_('expenses')\
            .select('amount, tax_amount')\
            .eq('user_id', user_id)\
            .gte('expense_date', current_month_start)\
            .eq('is_tax_deductible', True)\
            .execute()
        tax_deductible_total = sum(float(e['amount']) for e in (tax_deductible_result.data or []))
        tax_paid_total = sum(float(e.get('tax_amount', 0)) for e in (tax_deductible_result.data or []))
        
        # Calculate month-over-month change
        if prev_month_total > 0:
            mom_change = ((current_month_total - prev_month_total) / prev_month_total) * 100
        else:
            mom_change = 100 if current_month_total > 0 else 0
        
        return {
            "current_month": round(current_month_total, 2),
            "previous_month": round(prev_month_total, 2),
            "month_over_month_change": round(mom_change, 2),
            "tax_deductible_this_month": round(tax_deductible_total, 2),
            "tax_paid_this_month": round(tax_paid_total, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/profit-loss")
async def get_profit_loss_statement(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Get profit and loss statement combining revenue and expenses"""
    try:
        user_id = current_user.get('user_id')
        
        # Default to last 30 days if no dates provided
        if not end_date:
            end_date = datetime.now(timezone.utc).date().isoformat()
        if not start_date:
            start_date = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
        
        # Get paid invoices (revenue)
        revenue_result = supabase.from_('invoices')\
            .select('amount, currency, paid_at, payment_method')\
            .eq('user_id', user_id)\
            .eq('status', 'Paid')\
            .gte('paid_at', start_date)\
            .lte('paid_at', end_date)\
            .execute()
        
        total_revenue = sum(float(inv['amount']) for inv in (revenue_result.data or []))
        
        # Get expenses
        expense_result = supabase.from_('expenses')\
            .select('amount, currency, category, is_tax_deductible')\
            .eq('user_id', user_id)\
            .gte('expense_date', start_date)\
            .lte('expense_date', end_date)\
            .execute()
        
        total_expenses = sum(float(exp['amount']) for exp in (expense_result.data or []))
        tax_deductible_expenses = sum(float(exp['amount']) for exp in (expense_result.data or []) if exp.get('is_tax_deductible'))
        
        # Calculate profit
        gross_profit = total_revenue - total_expenses
        profit_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # Expense breakdown by category
        category_breakdown = {}
        for exp in (expense_result.data or []):
            cat = exp['category']
            if cat not in category_breakdown:
                category_breakdown[cat] = 0
            category_breakdown[cat] += float(exp['amount'])
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "revenue": {
                "total": round(total_revenue, 2),
                "count": len(revenue_result.data or [])
            },
            "expenses": {
                "total": round(total_expenses, 2),
                "tax_deductible": round(tax_deductible_expenses, 2),
                "count": len(expense_result.data or []),
                "by_category": category_breakdown
            },
            "profit": {
                "gross_profit": round(gross_profit, 2),
                "profit_margin_percent": round(profit_margin, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




