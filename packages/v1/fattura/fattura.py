import json
from datetime import datetime

def get_request_route_id(args, data, resource_name):
    for key in ("id", f"{resource_name}_id"):
        value = data.get(key)
        if value not in (None, ""):
            return str(value)

    raw_path = str(args.get("__ow_path") or args.get("path") or "").strip("/")
    if not raw_path:
        return ""

    parts = [part for part in raw_path.split("/") if part]
    if not parts:
        return ""

    if resource_name in parts:
        index = parts.index(resource_name)
        if index + 1 < len(parts):
            return parts[index + 1]

    return parts[-1] if parts else ""

def get_user_id_from_token(args, conn):
    headers = args.get("__ow_headers") or {}
    auth_header = headers.get("authorization", "")
    
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if not token:
        return None
    
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT s.user_id FROM sessions s 
                   WHERE s.token = %s AND (s.expires_at IS NULL OR s.expires_at > %s)""",
                (token, datetime.now())
            )
            result = cur.fetchone()
            return result[0] if result else None
    except:
        return None

def get_company_info(conn, user_id):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT nome, cognome, email, telefono, indirizzo, piva, iva_esente 
                   FROM users WHERE id = %s""",
                (user_id,)
            )
            row = cur.fetchone()
            if row:
                return {
                    "nome": f"{row[0]} {row[1]}" if row[0] and row[1] else (row[0] or row[1] or ""),
                    "email": row[2],
                    "telefono": row[3],
                    "indirizzo": row[4],
                    "piva": row[5],
                    "iva_esente": row[6]
                }
    except:
        pass
    return None

def get_contact_info(conn, contatto_id):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT nome, cognome, email, telefono, indirizzo 
                   FROM contacts WHERE id = %s""",
                (contatto_id,)
            )
            row = cur.fetchone()
            if row:
                return {
                    "nome": f"{row[0]} {row[1]}" if row[0] and row[1] else (row[0] or row[1] or ""),
                    "email": row[2],
                    "telefono": row[3],
                    "indirizzo": row[4]
                }
    except:
        pass
    return None

def get_order_details(conn, order_id, user_id):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT o.id, o.contatto_id, o.data_ordine, o.stato, o.totale, c.nome as contatto_nome
                   FROM orders o 
                   LEFT JOIN contacts c ON o.contatto_id = c.id
                   WHERE o.id = %s AND o.user_id = %s""",
                (order_id, user_id)
            )
            row = cur.fetchone()
            if row:
                return {
                    "id": row[0],
                    "contatto_id": row[1],
                    "data_ordine": str(row[2]) if row[2] else None,
                    "stato": row[3],
                    "totale": float(row[4]) if row[4] else 0.0,
                    "contatto_nome": row[5]
                }
    except:
        pass
    return None

def generate_invoice_html(order_details, company_info, contact_info):
    today = datetime.now().strftime("%d/%m/%Y")
    
    html = f"""<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fattura #{order_details['id']}</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
        }}
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }}
        .logo {{
            width: 150px;
            height: auto;
        }}
        .company-info {{
            text-align: right;
        }}
        .invoice-title {{
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 10px;
        }}
        .section {{
            margin-bottom: 30px;
        }}
        .section-title {{
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 10px;
            color: #444;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }}
        .info-block {{}}
        .info-block p {{
            margin: 5px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #f5f5f5;
            font-weight: bold;
        }}
        .total {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #333;
            text-align: right;
            font-size: 1.3em;
            font-weight: bold;
        }}
        .status {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 3px;
            font-weight: bold;
            margin-top: 20px;
        }}
        .status.pending {{ background-color: #fef3c7; color: #92400e; }}
        .status.shipped {{ background-color: #dbeafe; color: #1e40af; }}
        .status.delivered {{ background-color: #dcfce7; color: #166534; }}
        .status.cancelled {{ background-color: #fee2e2; color: #991b1b; }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <img src="https://via.placeholder.com/150x80?text=LOGO" alt="Logo" class="logo">
        </div>
        <div class="company-info">
            <div class="invoice-title">FATTURA</div>
            <p><strong>Fattura N° {order_details['id']}</strong></p>
            <p>Data: {today}</p>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-block">
            <div class="section-title">Mittente</div>
            <p><strong>{company_info['nome']}</strong></p>
            {company_info.get('indirizzo') and f"<p>{company_info['indirizzo']}</p>"}
            {company_info.get('email') and f"<p>{company_info['email']}</p>"}
            {company_info.get('telefono') and f"<p>Tel: {company_info['telefono']}</p>"}
        </div>
        <div class="info-block">
            <div class="section-title">Destinatario</div>
            <p><strong>{contact_info['nome'] if contact_info else 'N/A'}</strong></p>
            {contact_info and contact_info.get('indirizzo') and f"<p>{contact_info['indirizzo']}</p>"}
            {contact_info and contact_info.get('email') and f"<p>{contact_info['email']}</p>"}
            {contact_info and contact_info.get('telefono') and f"<p>Tel: {contact_info['telefono']}</p>"}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Dettagli Ordine</div>
        <table>
            <thead>
                <tr>
                    <th>Descrizione</th>
                    <th>Data Ordine</th>
                    <th>Totale</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{contact_info['nome'] if contact_info else 'Ordine'}</td>
                    <td>{order_details['data_ordine'] or '-'}</td>
                    <td>€ {order_details['totale']:,.2f}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="total">
        Totale: € {order_details['totale']:,.2f}
    </div>

    <div style="text-align: center; margin-top: 40px;">
        <span class="status {order_details['stato']}">{order_details['stato'].upper()}</span>
    </div>

    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 0.9em;">
        {company_info.get('piva') and f"P.IVA: {company_info['piva']}"}
        {company_info.get('iva_esente') and company_info['piva'] and ' - '}{company_info.get('iva_esente') and 'IVA Esente'}
    </div>
</body>
</html>"""
    
    return html

def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "POSTGRESQL"):
        return {"ok": False, "error": "Database non configurato"}

    method = (args.get("__ow_method") or args.get("method") or "GET").upper()
    
    data = dict(args) if isinstance(args, dict) else {}
    body = data.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:
            body = {}
    merged = dict(body) if isinstance(body, dict) else {}
    merged.update({k: v for k, v in data.items() if k not in {"body", "POSTGRES_URL"}})

    conn = ctx.POSTGRESQL
    user_id = get_user_id_from_token(args, conn)
    
    if not user_id:
        return {"ok": False, "error": "Autenticazione richiesta"}
    
    try:
        if method == "GET":
            order_id = get_request_route_id(args, merged, "fattura")
            if not order_id:
                return {"ok": False, "error": "ID fattura non fornito"}
            
            order_details = get_order_details(conn, order_id, user_id)
            if not order_details:
                return {"ok": False, "error": "Fattura non trovata"}
            
            company_info = get_company_info(conn, user_id)
            contact_info = None
            if order_details.get('contatto_id'):
                contact_info = get_contact_info(conn, order_details['contatto_id'])
            
            html = generate_invoice_html(order_details, company_info or {}, contact_info or {})
            
            return {
                "ok": True,
                "html": html,
                "order": order_details
            }
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
