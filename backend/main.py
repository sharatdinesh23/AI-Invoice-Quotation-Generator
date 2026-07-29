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
from datetime import datetime, timedelta
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

load_dotenv()

app = FastAPI(title="Freelance Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABSE_SERVICE_KEY = os.environ.get("SUPABSE_SERVICE_KEY")


supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()

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

# --- CORE ROUTES ---
@app.get("/")
def read_root():
    return {"message": "Freelance Portal API is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# @app.get("/api/dashboard")
# async def get_dashboard_data(auth_data: dict = Depends(get_current_user)):
#     user = auth_data["user"]
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
#         clients_res = await client.get(f"{SUPABASE_URL}/rest/v1/clients?user_id=eq.{user.id}&select=id", headers=headers)
#         invoices_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{user.id}&select=status,total", headers=headers)
        
#         inv_data = invoices_res.json()
#         pending = sum(1 for inv in inv_data if inv['status'] in ['Sent', 'Overdue'])
#         paid = sum(1 for inv in inv_data if inv['status'] == 'Paid')
#         revenue = sum(float(inv['total']) for inv in inv_data if inv['status'] == 'Paid')

#         return {
#             "message": f"Welcome, {user.email}!", 
#             "stats": {"clients": len(clients_res.json()), "pending": pending, "paid": paid, "revenue": round(revenue, 2)}
#         }

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
            
            if inv['status'] == 'Paid':
                total_paid += amount
                # For average days to pay, we'd ideally compare created_at to a paid_at date. 
                # For now, we'll track the count of paid invoices.
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
# ⚠️ CRITICAL: INVOICE ROUTES ORDER MATTERS ⚠️
# Specific routes (/next-number) MUST be defined BEFORE parameterized routes (/{invoice_id})
# ==============================================================================

@app.get("/api/invoices")
async def get_invoices(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        # Added &status=neq.Void to filter out soft-deleted invoices
        response = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?user_id=eq.{auth_data['user'].id}&status=neq.Void&select=*,clients(name,email)&order=created_at.desc", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"})
        return {"invoices": response.json()}

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
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo", "Content-Profile":"freelancing_demo"}
        inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)", headers=headers)
        invoices = inv_res.json()
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
async def send_invoice_email(invoice_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
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
async def get_recurring(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{SUPABASE_URL}/rest/v1/recurring_invoices?user_id=eq.{auth_data['user'].id}&select=*,clients(name),recurring_invoice_items(*)", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept-Profile": "freelancing_demo"})
        return {"recurring": res.json()}

@app.post("/api/recurring")
async def create_recurring(request: dict, auth_data: dict = Depends(get_current_user)):
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
async def update_recurring_status(rec_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        await client.patch(f"{SUPABASE_URL}/rest/v1/recurring_invoices?id=eq.{rec_id}&user_id=eq.{auth_data['user'].id}", json={"status": request["status"]}, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"})
    return {"message": "Status updated"}

@app.delete("/api/recurring/{rec_id}")
async def delete_recurring(rec_id: str, auth_data: dict = Depends(get_current_user)):
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
        
        # Fetch total, currency, and invoice_number
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=total,currency,invoice_number", 
            headers=headers
        )
        invoice = inv_res.json()[0]
        
        # Razorpay requires amount in the smallest currency unit (e.g., paise for INR)
        amount_in_paise = int(float(invoice['total']) * 100) 
        
        # FIX: invoice_id is exactly 36 characters, which is safely under Razorpay's 40-char limit
        order_data = {
            "amount": amount_in_paise,
            "currency": invoice.get('currency', 'INR'),
            "receipt": invoice_id, 
            "payment_capture": 1 # Auto-capture
        }
        
        order = razorpay_client.order.create(data=order_data)
        return {
            "order_id": order['id'], 
            "amount": amount_in_paise, 
            "currency": order['currency'], 
            "key_id": os.environ.get("RAZORPAY_KEY_ID"),
            "invoice_number": invoice.get('invoice_number')
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
        
        await client.patch(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}", json={"status": "Paid"}, headers=headers)
        
        await client.post(f"{SUPABASE_URL}/rest/v1/payments", json={
            "invoice_id": invoice_id,
            "user_id": inv_data['user_id'],
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
            "amount": inv_data['total'],
            "currency": inv_data['currency'],
            "status": "paid"
        }, headers=headers)
        
    return {"message": "Payment verified and invoice marked as Paid"}

@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    # 1. Verify Webhook Signature (Crucial for security)
    webhook_signature = request.headers.get("x-razorpay-signature")
    body = await request.body()
    
    expected_signature = hmac.new(
        os.environ.get("RAZORPAY_WEBHOOK_SECRET").encode(), # Add this to your .env!
        body,
        hashlib.sha256
    ).hexdigest()
    
    if expected_signature != webhook_signature:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    payload = json.loads(body)
    event = payload.get("event")
    
    if event == "payment.captured":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        razorpay_payment_id = payment.get("id")
        
        # Find the invoice by receipt (which we set to invoice_id)
        receipt_invoice_id = payment.get("receipt")
        
        async with httpx.AsyncClient() as client:
            headers = {"apikey": SUPABSE_SERVICE_KEY, "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}", "Content-Type": "application/json", "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo"}
            
            # Update Invoice to Paid
            await client.patch(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{receipt_invoice_id}", json={"status": "Paid"}, headers=headers)
            
            # TODO: Trigger Gmail API here to send "Payment Received" email with PDF attached!
            print(f"✅ Webhook: Invoice {receipt_invoice_id} marked as PAID via Razorpay")
            
    return {"status": "success"}


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


# --- RAZORPAY WEBHOOK ENDPOINT ---
@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    webhook_signature = request.headers.get("x-razorpay-signature")
    body = await request.body()
    
    # Verify signature
    expected_signature = hmac.new(
        os.environ.get("RAZORPAY_WEBHOOK_SECRET").encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if expected_signature != webhook_signature:
        print("❌ Webhook signature mismatch!")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    payload = json.loads(body)
    event = payload.get("event")
    
    if event == "payment.captured":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        receipt_invoice_id = payment.get("receipt") # We set this to the invoice_id
        
        if not receipt_invoice_id:
            return {"status": "ignored", "reason": "No receipt found"}
        
        print(f"🔔 Webhook: Payment captured for invoice {receipt_invoice_id}")
        
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": SUPABSE_SERVICE_KEY, 
                "Authorization": f"Bearer {SUPABSE_SERVICE_KEY}", 
                "Content-Type": "application/json", 
                "Accept-Profile": "freelancing_demo", 
                "Content-Profile": "freelancing_demo"
            }
            
            # 1. Get invoice details (including client email and profile for PDF)
            inv_res = await client.get(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{receipt_invoice_id}&select=*,clients(name,email)", headers=headers)
            invoice = inv_res.json()[0]
            
            # Fetch profile for the PDF helper
            profile_res = await client.get(f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{invoice['user_id']}&select=organization_name,gstin,logo_url", headers=headers)
            invoice['profile'] = profile_res.json()[0] if profile_res.json() else {}
            
            # 2. Update status to Paid (if not already)
            if invoice['status'] != 'Paid':
                await client.patch(f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{receipt_invoice_id}", json={"status": "Paid"}, headers=headers)
                
                # 3. Trigger Auto-Email
                await send_payment_success_email(invoice, client, headers)
                
    return {"status": "success"}


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
            
            if status == 'Paid':
                total_collected += amount
            else:
                total_pending += amount
                
            if month not in monthly_data:
                monthly_data[month] = {"billed": 0, "collected": 0}
            monthly_data[month]["billed"] += amount
            if status == 'Paid':
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




