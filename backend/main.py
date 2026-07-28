# # backend/main.py
# from fastapi import FastAPI, Depends, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from supabase import create_client, Client, ClientOptions
# import os
# from dotenv import load_dotenv

# load_dotenv()

# app = FastAPI(title="Freelance Portal API")

# # CORS setup
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173","http://localhost:8000"], 
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Connect to Supabase
# url: str = os.environ.get("SUPABASE_URL")
# key: str = os.environ.get("SUPABASE_KEY")
# options = ClientOptions(schema="freelancing_demo")
# supabase: Client = create_client(url, key,options= options)

# # Security setup for JWT tokens
# security = HTTPBearer()

# # --- AUTHENTICATION DEPENDENCY ---
# async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
#     token = credentials.credentials
#     try:
#         # Ask Supabase to verify if this token is valid and belongs to a real user
#         user_response = supabase.auth.get_user(token)
#         if not user_response.user:
#             raise HTTPException(status_code=401, detail="Invalid token")
#         return user_response.user
#     except Exception as e:
#         raise HTTPException(status_code=401, detail="Authentication failed")

# # --- ROUTES ---

# @app.get("/")
# def read_root():
#     return {"message": "Freelance Portal API is running!"}

# # This is a PUBLIC route (no auth required)
# @app.get("/health")
# def health_check():
#     return {"status": "healthy"}

# # # This is a PROTECTED route (requires a valid Supabase JWT)
# # @app.get("/api/dashboard")
# # def get_dashboard_data(user = Depends(get_current_user)):
# #     # In the future, we will query the database here using user.id
# #     # For now, we just return dummy stats to prove it works!
    
# #     dummy_stats = {
# #         "clients": 12,
# #         "pending": 3,
# #         "paid": 9,
# #         "revenue": 4500.00
# #     }
    
# #     return {
# #         "message": f"Welcome to your secure dashboard, {user.email}!",
# #         "stats": dummy_stats
# #     }

# # --- CLIENTS ROUTES ---

# @app.get("/api/clients")
# def get_clients(user = Depends(get_current_user)):
#     # Fetch clients where the user_id matches the logged-in user
#     response = supabase.table('clients').select('*').eq('user_id', user.id).execute()
#     return {"clients": response.data}

# @app.post("/api/clients")
# async def create_client(request: dict, user = Depends(get_current_user)):
#     # Add the logged-in user's ID to the data before saving
#     client_data = {
#         "user_id": user.id,
#         "name": request.get("name"),
#         "email": request.get("email")
#     }
#     response = supabase.table('clients').insert(client_data).execute()
#     return {"client": response.data[0]}

# @app.delete("/api/clients/{client_id}")
# def delete_client(client_id: str, user = Depends(get_current_user)):
#     # Delete only if it belongs to the logged-in user (Extra security!)
#     response = supabase.table('clients').delete().eq('id', client_id).eq('user_id', user.id).execute()
#     return {"message": "Client deleted"}


# # --- PRODUCTS ROUTES ---

# @app.get("/api/products")
# def get_products(user = Depends(get_current_user)):
#     response = supabase.table('products').select('*').eq('user_id', user.id).execute()
#     return {"products": response.data}

# @app.post("/api/products")
# async def create_product(request: dict, user = Depends(get_current_user)):
#     product_data = {
#         "user_id": user.id,
#         "name": request.get("name"),
#         "rate": request.get("rate")
#     }
#     response = supabase.table('products').insert(product_data).execute()
#     return {"product": response.data[0]}

# @app.delete("/api/products/{product_id}")
# def delete_product(product_id: str, user = Depends(get_current_user)):
#     response = supabase.table('products').delete().eq('id', product_id).eq('user_id', user.id).execute()
#     return {"message": "Product deleted"}

# # backend/main.py
# from fastapi import FastAPI, Depends, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from supabase import create_client, Client
# import httpx
# import os
# from dotenv import load_dotenv
# from fastapi.responses import StreamingResponse
# from fpdf import FPDF
# import io


# load_dotenv()

# app = FastAPI(title="Freelance Portal API")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173"], 
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# SUPABASE_URL = os.environ.get("SUPABASE_URL")
# SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# base_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# security = HTTPBearer()

# async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
#     token = credentials.credentials
#     try:
#         user_response = base_supabase.auth.get_user(token)
#         if not user_response.user:
#             raise HTTPException(status_code=401, detail="Invalid token")
#         return {"user": user_response.user, "token": token}
#     except Exception as e:
#         raise HTTPException(status_code=401, detail="Authentication failed")

# # --- ROUTES ---
# @app.get("/")
# def read_root():
#     return {"message": "Freelance Portal API is running!"}

# @app.get("/health")
# def health_check():
#     return {"status": "healthy"}

# @app.get("/api/dashboard")
# def get_dashboard_data(auth_data: dict = Depends(get_current_user)):
#     user = auth_data["user"]
#     return {"message": f"Welcome, {user.email}!", "stats": {"clients": 0, "pending": 0, "paid": 0, "revenue": 0}}

# # --- CLIENTS ROUTES ---
# @app.get("/api/clients")
# async def get_clients(auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         response = await client.get(
#             f"{SUPABASE_URL}/rest/v1/clients",
#             headers={
#                 "apikey": SUPABASE_KEY,
#                 "Authorization": f"Bearer {token}",
#                 "Accept": "application/json",
#                 "Accept-Profile": "freelancing_demo"
#             }
#         )
#         response.raise_for_status()
#         return {"clients": response.json()}

# @app.post("/api/clients")
# async def create_client(request: dict, auth_data: dict = Depends(get_current_user)):
#     user = auth_data["user"]
#     token = auth_data["token"]
#     client_data = {"user_id": user.id, "name": request.get("name"), "email": request.get("email")}
    
#     async with httpx.AsyncClient() as client:
#         response = await client.post(
#             f"{SUPABASE_URL}/rest/v1/clients",
#             json=client_data,
#             headers={
#                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
#                 "Accept": "application/json", "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
#             }
#         )
#         response.raise_for_status()
#         return {"client": response.json()[0]}

# # @app.delete("/api/clients/{client_id}")
# # async def delete_client(client_id: str, auth_data: dict = Depends(get_current_user)):
# #     token = auth_data["token"]
# #     async with httpx.AsyncClient() as client:
# #         response = await client.delete(
# #             f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}",
# #             headers={
# #                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
# #                 "Accept-Profile": "freelancing_demo", "Accept": "*/*"
# #             }
# #         )
# #         if response.status_code == 404:
# #             return {"message": "Client already deleted"}
# #         response.raise_for_status()
# #         return {"message": "Client deleted"}


# # --- PRODUCTS ROUTES ---
# @app.get("/api/products")
# async def get_products(auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         response = await client.get(
#             f"{SUPABASE_URL}/rest/v1/products",
#             headers={
#                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
#                 "Accept": "application/json", "Accept-Profile": "freelancing_demo"
#             }
#         )
#         response.raise_for_status()
#         return {"products": response.json()}

# @app.post("/api/products")
# async def create_product(request: dict, auth_data: dict = Depends(get_current_user)):
#     user = auth_data["user"]
#     token = auth_data["token"]
#     product_data = {"user_id": user.id, "name": request.get("name"), "rate": request.get("rate")}
    
#     async with httpx.AsyncClient() as client:
#         response = await client.post(
#             f"{SUPABASE_URL}/rest/v1/products",
#             json=product_data,
#             headers={
#                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
#                 "Accept": "application/json", "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
#             }
#         )
#         response.raise_for_status()
#         return {"product": response.json()[0]}

# # @app.delete("/api/products/{product_id}")
# # async def delete_product(product_id: str, auth_data: dict = Depends(get_current_user)):
# #     token = auth_data["token"]
# #     async with httpx.AsyncClient() as client:
# #         response = await client.delete(
# #             f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
# #             headers={
# #                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
# #                 "Accept-Profile": "freelancing_demo", "Accept": "*/*"
# #             }
# #         )
# #         if response.status_code == 404:
# #             return {"message": "Product already deleted"}
# #         response.raise_for_status()
# #         return {"message": "Product deleted"}

# # --- ADD THESE TO THE BOTTOM OF backend/main.py ---

# @app.patch("/api/clients/{client_id}")
# async def update_client(client_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
    
#     # Only update the fields that are provided
#     update_data = {}
#     if "name" in request: update_data["name"] = request["name"]
#     if "email" in request: update_data["email"] = request["email"]
    
#     async with httpx.AsyncClient() as client:
#         response = await client.patch(
#             f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}",
#             json=update_data,
#             headers={
#                 "apikey": SUPABASE_KEY, 
#                 "Authorization": f"Bearer {token}", 
#                 "Content-Type": "application/json",
#                 "Accept": "application/json", 
#                 "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo", 
#                 "Prefer": "return=representation"
#             }
#         )
#         response.raise_for_status()
#         return {"client": response.json()[0]}


# @app.patch("/api/products/{product_id}")
# async def update_product(product_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
    
#     update_data = {}
#     if "name" in request: update_data["name"] = request["name"]
#     if "rate" in request: update_data["rate"] = request["rate"]
    
#     async with httpx.AsyncClient() as client:
#         response = await client.patch(
#             f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
#             json=update_data,
#             headers={
#                 "apikey": SUPABASE_KEY, 
#                 "Authorization": f"Bearer {token}", 
#                 "Content-Type": "application/json",
#                 "Accept": "application/json", 
#                 "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo", 
#                 "Prefer": "return=representation"
#             }
#         )
#         response.raise_for_status()
#         return {"product": response.json()[0]}


# # --- REPLACE YOUR EXISTING DELETE ROUTES WITH THESE ---

# @app.delete("/api/clients/{client_id}")
# async def delete_client(client_id: str, auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         response = await client.delete(
#             f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}",
#             headers={
#                 "apikey": SUPABASE_KEY, 
#                 "Authorization": f"Bearer {token}",
#                 "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo",
#                 "Prefer": "return=minimal" # Tells PostgREST we just want a success status, no body
#             }
#         )
        
#         # If it fails, print the EXACT error from Supabase to your terminal
#         if response.status_code >= 400:
#             print(f"❌ DELETE CLIENT FAILED: {response.status_code}")
#             print(f"Response Body: {response.text}")
#             raise HTTPException(status_code=response.status_code, detail=response.text)
            
#         return {"message": "Client deleted successfully"}


# @app.delete("/api/products/{product_id}")
# async def delete_product(product_id: str, auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         response = await client.delete(
#             f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
#             headers={
#                 "apikey": SUPABASE_KEY, 
#                 "Authorization": f"Bearer {token}",
#                 "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo",
#                 "Prefer": "return=minimal"
#             }
#         )
        
#         # If it fails, print the EXACT error from Supabase to your terminal
#         if response.status_code >= 400:
#             print(f"❌ DELETE PRODUCT FAILED: {response.status_code}")
#             print(f"Response Body: {response.text}")
#             raise HTTPException(status_code=response.status_code, detail=response.text)
            
#         return {"message": "Product deleted successfully"}

# # --- ADD THESE TO THE BOTTOM OF backend/main.py ---

# @app.get("/api/invoices")
# async def get_invoices(auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         response = await client.get(
#             f"{SUPABASE_URL}/rest/v1/invoices?select=*,clients(name,email)&order=created_at.desc",
#             headers={
#                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
#                 "Accept": "application/json", "Accept-Profile": "freelancing_demo"
#             }
#         )
#         response.raise_for_status()
#         return {"invoices": response.json()}


# @app.post("/api/invoices")
# async def create_invoice(request: dict, auth_data: dict = Depends(get_current_user)):
#     user = auth_data["user"]
#     token = auth_data["token"]
    
#     # 1. Create the main invoice record
#     invoice_data = {
#         "user_id": user.id,
#         "client_id": request.get("client_id"),
#         "invoice_number": request.get("invoice_number"),
#         "status": request.get("status", "Draft"),
#         "subtotal": request.get("subtotal"),
#         "tax_rate": request.get("tax_rate", 0),
#         "tax_amount": request.get("tax_amount", 0),
#         "discount": request.get("discount", 0),
#         "total": request.get("total"),
#         "notes": request.get("notes", ""),
#         "issue_date": request.get("issue_date"),
#         "due_date": request.get("due_date")
#     }
    
#     async with httpx.AsyncClient() as client:
#         inv_response = await client.post(
#             f"{SUPABASE_URL}/rest/v1/invoices",
#             json=invoice_data,
#             headers={
#                 "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
#                 "Accept": "application/json", "Accept-Profile": "freelancing_demo",
#                 "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
#             }
#         )
#         inv_response.raise_for_status()
#         new_invoice = inv_response.json()[0]
#         invoice_id = new_invoice["id"]
        
#         # 2. Create the line items using the new invoice_id
#         items_data = []
#         for item in request.get("items", []):
#             items_data.append({
#                 "user_id": user.id,
#                 "invoice_id": invoice_id,
#                 "description": item.get("description"),
#                 "quantity": item.get("quantity"),
#                 "rate": item.get("rate"),
#                 "amount": item.get("amount")
#             })
            
#         if items_data:
#             items_response = await client.post(
#                 f"{SUPABASE_URL}/rest/v1/invoice_items",
#                 json=items_data,
#                 headers={
#                     "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
#                     "Accept": "application/json", "Accept-Profile": "freelancing_demo",
#                     "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
#                 }
#             )
#             items_response.raise_for_status()
            
#         return {"invoice": new_invoice, "message": "Invoice created successfully"}


# # --- ADD THESE TO THE BOTTOM OF backend/main.py ---

# @app.get("/api/invoices/{invoice_id}")
# async def get_invoice(invoice_id: str, auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
#     async with httpx.AsyncClient() as client:
#         # 1. Fetch the invoice and client details
#         inv_res = await client.get(
#             f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)",
#             headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
#         )
#         inv_res.raise_for_status()
#         invoices = inv_res.json()
#         if not invoices:
#             raise HTTPException(status_code=404, detail="Invoice not found")
        
#         # 2. Fetch the line items
#         items_res = await client.get(
#             f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}",
#             headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
#         )
#         items_res.raise_for_status()
        
#         invoice = invoices[0]
#         invoice['items'] = items_res.json()
#         return {"invoice": invoice}


# @app.get("/api/invoices/{invoice_id}/pdf")
# async def generate_invoice_pdf(invoice_id: str, auth_data: dict = Depends(get_current_user)):
#     token = auth_data["token"]
    
#     # 1. Fetch invoice and items (reusing the logic above)
#     async with httpx.AsyncClient() as client:
#         inv_res = await client.get(
#             f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)",
#             headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
#         )
#         inv_res.raise_for_status()
#         invoice = inv_res.json()[0]
        
#         items_res = await client.get(
#             f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}",
#             headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
#         )
#         items_res.raise_for_status()
#         items = items_res.json()

#     # 2. Generate the PDF
#     pdf = FPDF()
#     pdf.add_page()
#     pdf.set_auto_page_break(auto=True, margin=15)
    
#     # Header
#     pdf.set_font("Helvetica", "B", 24)
#     pdf.cell(0, 15, "INVOICE", 0, 1, "R")
    
#     pdf.set_font("Helvetica", "", 10)
#     pdf.cell(0, 6, f"Invoice Number: {invoice['invoice_number']}", 0, 1)
#     pdf.cell(0, 6, f"Issue Date: {invoice['issue_date']}", 0, 1)
#     pdf.cell(0, 6, f"Due Date: {invoice['due_date'] or 'N/A'}", 0, 1)
#     pdf.ln(10)
    
#     # Bill To
#     pdf.set_font("Helvetica", "B", 12)
#     pdf.cell(0, 8, "BILL TO:", 0, 1)
#     pdf.set_font("Helvetica", "", 10)
#     pdf.cell(0, 6, invoice['clients']['name'], 0, 1)
#     pdf.cell(0, 6, invoice['clients']['email'], 0, 1)
#     pdf.ln(10)
    
#     # Table Header
#     pdf.set_fill_color(240, 240, 240)
#     pdf.set_font("Helvetica", "B", 10)
#     pdf.cell(100, 8, "Description", 1, 0, "L", True)
#     pdf.cell(25, 8, "Qty", 1, 0, "C", True)
#     pdf.cell(35, 8, "Rate", 1, 0, "R", True)
#     pdf.cell(30, 8, "Amount", 1, 1, "R", True)
    
#     # Table Rows
#     pdf.set_font("Helvetica", "", 10)
#     for item in items:
#         desc = item['description'][:45] # Truncate long descriptions
#         pdf.cell(100, 8, desc, 1, 0, "L")
#         pdf.cell(25, 8, str(item['quantity']), 1, 0, "C")
#         pdf.cell(35, 8, f"${float(item['rate']):.2f}", 1, 0, "R")
#         pdf.cell(30, 8, f"${float(item['amount']):.2f}", 1, 1, "R")
        
#     # Totals
#     pdf.ln(5)
#     pdf.set_font("Helvetica", "", 10)
#     pdf.cell(130, 8, "Subtotal:", 0, 0, "R")
#     pdf.cell(60, 8, f"${float(invoice['subtotal']):.2f}", 0, 1, "R")
    
#     pdf.cell(130, 8, f"Tax ({invoice['tax_rate']}%):", 0, 0, "R")
#     pdf.cell(60, 8, f"${float(invoice['tax_amount']):.2f}", 0, 1, "R")
    
#     pdf.cell(130, 8, "Discount:", 0, 0, "R")
#     pdf.cell(60, 8, f"-${float(invoice['discount']):.2f}", 0, 1, "R")
    
#     pdf.set_font("Helvetica", "B", 12)
#     pdf.cell(130, 10, "Total:", 0, 0, "R")
#     pdf.cell(60, 10, f"${float(invoice['total']):.2f}", 0, 1, "R")
    
#     # Notes
#     if invoice.get('notes'):
#         pdf.ln(10)
#         pdf.set_font("Helvetica", "B", 10)
#         pdf.cell(0, 6, "Notes:", 0, 1)
#         pdf.set_font("Helvetica", "", 9)
#         pdf.multi_cell(0, 5, invoice['notes'])

#     # 3. Output PDF as a downloadable stream
#     pdf_bytes = pdf.output()
    
#     return StreamingResponse(
#         io.BytesIO(pdf_bytes),
#         media_type="application/pdf",
#         headers={"Content-Disposition": f"inline; filename=invoice-{invoice['invoice_number']}.pdf"}
#     )
    
# # --- SETTINGS ROUTES ---

# @app.get("/api/settings")
# def get_settings(user = Depends(get_current_user)):
#     res = supabase.table('profiles').select('*').eq('user_id', user.id).execute()
#     return {"profile": res.data[0] if res.data else None}

# @app.put("/api/settings")
# async def update_settings(request: dict, user = Depends(get_current_user)):
#     res = supabase.table('profiles').select('id').eq('user_id', user.id).execute()
    
#     profile_data = {
#         "organization_name": request.get("organization_name"),
#         "gstin": request.get("gstin"),
#         "logo_url": request.get("logo_url"),
#         "invoice_prefix": request.get("invoice_prefix")
#     }
    
#     if not res.data:
#         profile_data["user_id"] = user.id
#         supabase.table('profiles').insert(profile_data).execute()
#     else:
#         supabase.table('profiles').update(profile_data).eq('user_id', user.id).execute()
        
#     return {"message": "Settings updated"}

# # --- INVOICE NUMBER GENERATION ---

# @app.get("/api/invoices/next-number")
# def get_next_invoice_number(user = Depends(get_current_user)):
#     prof_res = supabase.table('profiles').select('invoice_prefix, organization_name').eq('user_id', user.id).execute()
    
#     prefix = "INV"
#     if prof_res.data:
#         profile = prof_res.data[0]
#         if profile.get('invoice_prefix'):
#             prefix = profile['invoice_prefix'].upper()
#         elif profile.get('organization_name'):
#             prefix = profile['organization_name'][:4].upper()
            
#     if not prefix or len(prefix) < 2:
#         prefix = user.email.split('@')[0][:4].upper() if user.email else "INV"

#     # Find max invoice number for this user
#     inv_res = supabase.table('invoices').select('invoice_number').eq('user_id', user.id).execute()
#     max_num = 0
#     for inv in inv_res.data:
#         parts = inv['invoice_number'].split('-')
#         if len(parts) > 1:
#             try:
#                 num = int(parts[-1])
#                 if num > max_num: max_num = num
#             except ValueError:
#                 pass
                
#     return {"next_number": f"{prefix}-{max_num + 1}"}

# # --- GET SINGLE INVOICE (For Editing) ---

# @app.get("/api/invoices/{invoice_id}")
# def get_single_invoice(invoice_id: str, user = Depends(get_current_user)):
#     inv_res = supabase.table('invoices').select('*, clients(name)').eq('id', invoice_id).eq('user_id', user.id).execute()
#     if not inv_res.data:
#         raise HTTPException(status_code=404, detail="Invoice not found")
    
#     items_res = supabase.table('invoice_items').select('*').eq('invoice_id', invoice_id).execute()
#     return {"invoice": inv_res.data[0], "items": items_res.data}

# # --- EDIT & DELETE INVOICES ---

# @app.put("/api/invoices/{invoice_id}")
# async def update_invoice(invoice_id: str, request: dict, user = Depends(get_current_user)):
#     invoice_data = {
#         "client_id": request.get("client_id"),
#         "invoice_number": request.get("invoice_number"),
#         "status": request.get("status"),
#         "subtotal": request.get("subtotal"),
#         "tax": request.get("tax"),
#         "discount": request.get("discount"),
#         "total": request.get("total"),
#         "currency": request.get("currency", "USD")
#     }
#     supabase.table('invoices').update(invoice_data).eq('id', invoice_id).eq('user_id', user.id).execute()
    
#     # Delete old items and insert new ones
#     supabase.table('invoice_items').delete().eq('invoice_id', invoice_id).execute()
#     for item in request.get("items", []):
#         item_data = {
#             "invoice_id": invoice_id,
#             "product_id": item.get("product_id"),
#             "description": item.get("description"),
#             "quantity": item.get("quantity"),
#             "rate": item.get("rate"),
#             "amount": item.get("amount")
#         }
#         supabase.table('invoice_items').insert(item_data).execute()
        
#     return {"message": "Invoice updated"}

# @app.delete("/api/invoices/{invoice_id}")
# def delete_invoice(invoice_id: str, user = Depends(get_current_user)):
#     # Items are deleted automatically due to ON DELETE CASCADE in the DB schema
#     supabase.table('invoices').delete().eq('id', invoice_id).eq('user_id', user.id).execute()
#     return {"message": "Invoice deleted"}   


# backend/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
import httpx
import os
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
from fpdf import FPDF
import io

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

# 1. Initialize the client
base_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. ULTIMATE FIX: Force the Python client to use the 'freelancing_demo' schema via headers.
# This ensures the Settings, Invoice Number, and Update/Delete routes work perfectly.
base_supabase.postgrest.session.headers.update({
    "Accept-Profile": "freelancing_demo",
    "Content-Profile": "freelancing_demo"
})

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_response = base_supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user": user_response.user, "token": token}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")

# --- CORE ROUTES ---
@app.get("/")
def read_root():
    return {"message": "Freelance Portal API is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/dashboard")
def get_dashboard_data(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    # Now fetches real stats using the fixed base_supabase client!
    clients_res = base_supabase.table('clients').select('id', count='exact').eq('user_id', user.id).execute()
    invoices_res = base_supabase.table('invoices').select('status, total').eq('user_id', user.id).execute()
    
    pending = sum(1 for inv in invoices_res.data if inv['status'] in ['Sent', 'Overdue'])
    paid = sum(1 for inv in invoices_res.data if inv['status'] == 'Paid')
    revenue = sum(float(inv['total']) for inv in invoices_res.data if inv['status'] == 'Paid')

    return {
        "message": f"Welcome, {user.email}!", 
        "stats": {
            "clients": clients_res.count if clients_res.count is not None else 0,
            "pending": pending,
            "paid": paid,
            "revenue": round(revenue, 2)
        }
    }

# --- CLIENTS ROUTES (Using your robust httpx approach) ---
@app.get("/api/clients")
async def get_clients(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/clients",
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo"
            }
        )
        response.raise_for_status()
        return {"clients": response.json()}

@app.post("/api/clients")
async def create_client(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    client_data = {"user_id": user.id, "name": request.get("name"), "email": request.get("email")}
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/clients", json=client_data,
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
            }
        )
        response.raise_for_status()
        return {"client": response.json()[0]}

@app.patch("/api/clients/{client_id}")
async def update_client(client_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    update_data = {}
    if "name" in request: update_data["name"] = request["name"]
    if "email" in request: update_data["email"] = request["email"]
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}", json=update_data,
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
            }
        )
        response.raise_for_status()
        return {"client": response.json()[0]}

@app.delete("/api/clients/{client_id}")
async def delete_client(client_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{SUPABASE_URL}/rest/v1/clients?id=eq.{client_id}",
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"
            }
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return {"message": "Client deleted successfully"}

# --- PRODUCTS ROUTES ---
@app.get("/api/products")
async def get_products(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/products",
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo"
            }
        )
        response.raise_for_status()
        return {"products": response.json()}

@app.post("/api/products")
async def create_product(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    product_data = {"user_id": user.id, "name": request.get("name"), "rate": request.get("rate")}
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/products", json=product_data,
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
            }
        )
        response.raise_for_status()
        return {"product": response.json()[0]}

@app.patch("/api/products/{product_id}")
async def update_product(product_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    update_data = {}
    if "name" in request: update_data["name"] = request["name"]
    if "rate" in request: update_data["rate"] = request["rate"]
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}", json=update_data,
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
            }
        )
        response.raise_for_status()
        return {"product": response.json()[0]}

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
                "Accept-Profile": "freelancing_demo", "Content-Profile": "freelancing_demo", "Prefer": "return=minimal"
            }
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return {"message": "Product deleted successfully"}

# --- INVOICES ROUTES ---
@app.get("/api/invoices")
async def get_invoices(auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?select=*,clients(name,email)&order=created_at.desc",
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo"
            }
        )
        response.raise_for_status()
        return {"invoices": response.json()}

@app.post("/api/invoices")
async def create_invoice(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    token = auth_data["token"]
    
    invoice_data = {
        "user_id": user.id, "client_id": request.get("client_id"), "invoice_number": request.get("invoice_number"),
        "status": request.get("status", "Draft"), "subtotal": request.get("subtotal"),
        "tax_rate": request.get("tax_rate", 0), 
        "tax_amount": request.get("tax", request.get("tax_amount", 0)), # Maps frontend 'tax' to DB 'tax_amount'
        "discount": request.get("discount", 0), "total": request.get("total"),
        "notes": request.get("notes", ""), "issue_date": request.get("issue_date"), "due_date": request.get("due_date"),
        "currency": request.get("currency", "USD")
    }
    
    async with httpx.AsyncClient() as client:
        inv_response = await client.post(
            f"{SUPABASE_URL}/rest/v1/invoices", json=invoice_data,
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
                "Accept": "application/json", "Accept-Profile": "freelancing_demo",
                "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
            }
        )
        inv_response.raise_for_status()
        new_invoice = inv_response.json()[0]
        invoice_id = new_invoice["id"]
        
        items_data = []
        for item in request.get("items", []):
            items_data.append({
                "user_id": user.id, "invoice_id": invoice_id, "description": item.get("description"),
                "quantity": item.get("quantity"), "rate": item.get("rate"), "amount": item.get("amount")
            })
            
        if items_data:
            items_response = await client.post(
                f"{SUPABASE_URL}/rest/v1/invoice_items", json=items_data,
                headers={
                    "apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json",
                    "Accept": "application/json", "Accept-Profile": "freelancing_demo",
                    "Content-Profile": "freelancing_demo", "Prefer": "return=representation"
                }
            )
            items_response.raise_for_status()
            
        return {"invoice": new_invoice, "message": "Invoice created successfully"}

@app.get("/api/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
        )
        inv_res.raise_for_status()
        invoices = inv_res.json()
        if not invoices: raise HTTPException(status_code=404, detail="Invoice not found")
        
        items_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
        )
        items_res.raise_for_status()
        
        invoice = invoices[0]
        invoice['items'] = items_res.json()
        return {"invoice": invoice}

@app.put("/api/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    invoice_data = {
        "client_id": request.get("client_id"), "invoice_number": request.get("invoice_number"),
        "status": request.get("status"), "subtotal": request.get("subtotal"),
        "tax_amount": request.get("tax", request.get("tax_amount", 0)), # Maps frontend 'tax' to DB 'tax_amount'
        "discount": request.get("discount"), "total": request.get("total"), "currency": request.get("currency", "USD")
    }
    base_supabase.table('invoices').update(invoice_data).eq('id', invoice_id).eq('user_id', user.id).execute()
    
    base_supabase.table('invoice_items').delete().eq('invoice_id', invoice_id).execute()
    for item in request.get("items", []):
        item_data = {
            "invoice_id": invoice_id, "product_id": item.get("product_id"), "description": item.get("description"),
            "quantity": item.get("quantity"), "rate": item.get("rate"), "amount": item.get("amount")
        }
        base_supabase.table('invoice_items').insert(item_data).execute()
        
    return {"message": "Invoice updated"}

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: str, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    base_supabase.table('invoices').delete().eq('id', invoice_id).eq('user_id', user.id).execute()
    return {"message": "Invoice deleted"}   

# --- PDF GENERATION ---
@app.get("/api/invoices/{invoice_id}/pdf")
async def generate_invoice_pdf(invoice_id: str, auth_data: dict = Depends(get_current_user)):
    token = auth_data["token"]
    async with httpx.AsyncClient() as client:
        inv_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=*,clients(name,email)",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
        )
        inv_res.raise_for_status()
        invoice = inv_res.json()[0]
        
        items_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/invoice_items?invoice_id=eq.{invoice_id}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}", "Accept": "application/json", "Accept-Profile": "freelancing_demo"}
        )
        items_res.raise_for_status()
        items = items_res.json()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    pdf.set_font("Helvetica", "B", 24)
    pdf.cell(0, 15, "INVOICE", 0, 1, "R")
    
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Invoice Number: {invoice['invoice_number']}", 0, 1)
    pdf.cell(0, 6, f"Issue Date: {invoice.get('issue_date', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Due Date: {invoice.get('due_date', 'N/A')}", 0, 1)
    pdf.ln(10)
    
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "BILL TO:", 0, 1)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, invoice['clients']['name'], 0, 1)
    pdf.cell(0, 6, invoice['clients']['email'], 0, 1)
    pdf.ln(10)
    
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(100, 8, "Description", 1, 0, "L", True)
    pdf.cell(25, 8, "Qty", 1, 0, "C", True)
    pdf.cell(35, 8, "Rate", 1, 0, "R", True)
    pdf.cell(30, 8, "Amount", 1, 1, "R", True)
    
    pdf.set_font("Helvetica", "", 10)
    for item in items:
        desc = item['description'][:45]
        pdf.cell(100, 8, desc, 1, 0, "L")
        pdf.cell(25, 8, str(item['quantity']), 1, 0, "C")
        pdf.cell(35, 8, f"${float(item['rate']):.2f}", 1, 0, "R")
        pdf.cell(30, 8, f"${float(item['amount']):.2f}", 1, 1, "R")
        
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(130, 8, "Subtotal:", 0, 0, "R")
    pdf.cell(60, 8, f"${float(invoice['subtotal']):.2f}", 0, 1, "R")
    
    pdf.cell(130, 8, f"Tax ({invoice.get('tax_rate', 0)}%):", 0, 0, "R")
    pdf.cell(60, 8, f"${float(invoice.get('tax_amount', 0)):.2f}", 0, 1, "R")
    
    pdf.cell(130, 8, "Discount:", 0, 0, "R")
    pdf.cell(60, 8, f"-${float(invoice.get('discount', 0)):.2f}", 0, 1, "R")
    
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(130, 10, "Total:", 0, 0, "R")
    pdf.cell(60, 10, f"${float(invoice['total']):.2f}", 0, 1, "R")
    
    if invoice.get('notes'):
        pdf.ln(10)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, "Notes:", 0, 1)
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5, invoice['notes'])

    pdf_bytes = pdf.output()
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=invoice-{invoice['invoice_number']}.pdf"}
    )

# --- SETTINGS ROUTES ---
@app.get("/api/settings")
def get_settings(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    res = base_supabase.table('profiles').select('*').eq('user_id', user.id).execute()
    return {"profile": res.data[0] if res.data else None}

@app.put("/api/settings")
async def update_settings(request: dict, auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    res = base_supabase.table('profiles').select('id').eq('user_id', user.id).execute()
    profile_data = {
        "organization_name": request.get("organization_name"), "gstin": request.get("gstin"),
        "logo_url": request.get("logo_url"), "invoice_prefix": request.get("invoice_prefix")
    }
    if not res.data:
        profile_data["user_id"] = user.id
        base_supabase.table('profiles').insert(profile_data).execute()
    else:
        base_supabase.table('profiles').update(profile_data).eq('user_id', user.id).execute()
    return {"message": "Settings updated"}

# --- INVOICE NUMBER GENERATION ---
@app.get("/api/invoices/next-number")
def get_next_invoice_number(auth_data: dict = Depends(get_current_user)):
    user = auth_data["user"]
    prof_res = base_supabase.table('profiles').select('invoice_prefix, organization_name').eq('user_id', user.id).execute()
    prefix = "INV"
    if prof_res.data:
        profile = prof_res.data[0]
        if profile.get('invoice_prefix'): prefix = profile['invoice_prefix'].upper()
        elif profile.get('organization_name'): prefix = profile['organization_name'][:4].upper()
    if not prefix or len(prefix) < 2:
        prefix = user.email.split('@')[0][:4].upper() if user.email else "INV"

    inv_res = base_supabase.table('invoices').select('invoice_number').eq('user_id', user.id).execute()
    max_num = 0
    for inv in inv_res.data:
        parts = inv['invoice_number'].split('-')
        if len(parts) > 1:
            try:
                num = int(parts[-1])
                if num > max_num: max_num = num
            except ValueError: pass
    return {"next_number": f"{prefix}-{max_num + 1}"}


