import json
from datetime import datetime, timedelta

def get_user_id_from_token(args, conn):
    headers = args.get("__ow_headers") or {}
    auth_header = headers.get("authorization", "")
    
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if not token:
        query_params = args.get("__ow_query_raw") or {}
        if isinstance(query_params, str):
            from urllib.parse import parse_qs
            parsed = parse_qs(query_params)
            token = parsed.get("token", [None])[0]
        elif isinstance(query_params, dict):
            token = query_params.get("token")
    
    if not token and "token" in args:
        token = args["token"]
    
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
            with conn.cursor() as cur:
                # Get total invoices count
                cur.execute("""
                    SELECT COUNT(*) FROM orders WHERE user_id = %s
                """, (user_id,))
                totale_fatture = cur.fetchone()[0]
                
                # Get total issued amount
                cur.execute("""
                    SELECT COALESCE(SUM(totale), 0) FROM orders WHERE user_id = %s
                """, (user_id,))
                totale_emesse = float(cur.fetchone()[0]) or 0.0
                
                # Get total collected amount
                cur.execute("""
                    SELECT COALESCE(SUM(importo), 0) 
                    FROM pagamenti 
                    WHERE user_id = %s
                """, (user_id,))
                totale_incassato = float(cur.fetchone()[0]) or 0.0
                
                # Get total to collect
                cur.execute("""
                    SELECT COALESCE(SUM(residuo), 0) 
                    FROM fatture_con_stato_pagamento 
                    WHERE user_id = %s
                    AND stato_pagamento IN ('da_pagare', 'parzialmente_pagata')
                """, (user_id,))
                totale_da_incassare = float(cur.fetchone()[0]) or 0.0
                
                # Get overdue invoices count
                today = datetime.now().date()
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM fatture_con_stato_pagamento 
                    WHERE user_id = %s
                    AND data_fattura < %s
                    AND stato_pagamento IN ('da_pagare', 'parzialmente_pagata')
                """, (user_id, today))
                scadute_count = cur.fetchone()[0]
                
                # Get last 5 payments
                cur.execute("""
                    SELECT p.id, p.order_id, p.importo, p.data_pagamento, 
                           p.metodo, p.nota, o.cliente_id, c.nome as cliente_nome
                    FROM pagamenti p
                    LEFT JOIN orders o ON p.order_id = o.id
                    LEFT JOIN clienti c ON o.cliente_id = c.id
                    WHERE p.user_id = %s
                    ORDER BY p.data_pagamento DESC, p.created_at DESC
                    LIMIT 5
                """, (user_id,))
                last_payments_rows = cur.fetchall()
                
                ultimi_pagamenti = []
                for row in last_payments_rows:
                    ultimi_pagamenti.append({
                        "id": row[0],
                        "order_id": row[1],
                        "importo": float(row[2]) if row[2] else 0.0,
                        "data_pagamento": str(row[3]) if row[3] else None,
                        "metodo": row[4],
                        "nota": row[5],
                        "cliente_id": row[6],
                        "cliente_nome": row[7] or ""
                    })
                
                return {
                    "ok": True,
                    "dashboard": {
                        "totale_fatture": totale_fatture,
                        "totale_emesse": totale_emesse,
                        "totale_incassato": totale_incassato,
                        "totale_da_incassare": totale_da_incassare,
                        "scadute_count": scadute_count,
                        "ultimi_pagamenti": ultimi_pagamenti
                    }
                }
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
