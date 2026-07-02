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
            # Get unpaid invoices ordered by due date (data_ordine as due date)
            # Show only da_pagare and parzialmente_pagata
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT order_id, user_id, contatto_id, cliente_id, cliente_nome, 
                           data_fattura, stato_ordine, importo_fattura, totale_pagato,
                           stato_pagamento, residuo, ultimo_pagamento
                    FROM fatture_con_stato_pagamento
                    WHERE user_id = %s 
                    AND stato_pagamento IN ('da_pagare', 'parzialmente_pagata')
                    ORDER BY data_fattura ASC
                """, (user_id,))
                rows = cur.fetchall()
                
                today = datetime.now().date()
                scadenza_settimana = today + timedelta(days=7)
                
                scadenze = []
                for row in rows:
                    data_fattura = row[5]
                    is_scaduta = data_fattura and data_fattura < today
                    is_prossima_scadenza = (data_fattura and 
                                           data_fattura >= today and 
                                           data_fattura <= scadenza_settimana)
                    
                    scadenze.append({
                        "id": row[0],
                        "user_id": row[1],
                        "contatto_id": row[2],
                        "cliente_id": row[3],
                        "cliente_nome": row[4] or "",
                        "data_ordine": str(data_fattura) if data_fattura else None,
                        "stato": row[6],
                        "totale": float(row[7]) if row[7] else None,
                        "totale_pagato": float(row[8]) if row[8] else 0.0,
                        "stato_pagamento": row[9],
                        "residuo": float(row[10]) if row[10] else 0.0,
                        "ultimo_pagamento": str(row[11]) if row[11] else None,
                        "is_scaduta": is_scaduta,
                        "is_prossima_scadenza": is_prossima_scadenza
                    })
                
                return {"ok": True, "scadenze": scadenze}
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
