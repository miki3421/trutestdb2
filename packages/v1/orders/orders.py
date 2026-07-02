import json
from datetime import datetime, date as date_type

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

def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "POSTGRESQL"):
        return {"ok": False, "error": "Database not configured"}

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
            # Get filters from query params
            cliente_id = merged.get("cliente_id")
            stato_pagamento = merged.get("stato_pagamento")
            from_date = merged.get("from_date")
            to_date = merged.get("to_date")
            
            with conn.cursor() as cur:
                # Use the view that calculates payment status
                query = """
                    SELECT order_id, user_id, contatto_id, cliente_id, cliente_nome, 
                           data_fattura, stato_ordine, importo_fattura, totale_pagato,
                           stato_pagamento, residuo, ultimo_pagamento
                    FROM fatture_con_stato_pagamento
                    WHERE user_id = %s
                """
                params = [user_id]
                
                if cliente_id:
                    query += " AND cliente_id = %s"
                    params.append(cliente_id)
                
                if stato_pagamento:
                    query += " AND stato_pagamento = %s"
                    params.append(stato_pagamento)
                
                if from_date:
                    query += " AND data_fattura >= %s"
                    params.append(from_date)
                
                if to_date:
                    query += " AND data_fattura <= %s"
                    params.append(to_date)
                
                query += " ORDER BY data_fattura DESC"
                
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                orders = []
                for row in rows:
                    orders.append({
                        "id": row[0],
                        "user_id": row[1],
                        "contatto_id": row[2],
                        "cliente_id": row[3],
                        "cliente_nome": row[4] or "",
                        "data_ordine": str(row[5]) if row[5] else None,
                        "stato": row[6],
                        "totale": float(row[7]) if row[7] else None,
                        "totale_pagato": float(row[8]) if row[8] else 0.0,
                        "stato_pagamento": row[9],
                        "residuo": float(row[10]) if row[10] else 0.0,
                        "ultimo_pagamento": str(row[11]) if row[11] else None
                    })
                return {"ok": True, "orders": orders}
        
        elif method == "POST":
            data_ordine = merged.get("data_ordine")
            if not data_ordine:
                return {"ok": False, "error": "Data ordine è richiesta"}
            
            contatto_id = merged.get("contatto_id")
            cliente_id = merged.get("cliente_id")
            stato = merged.get("stato", "pending")
            totale = merged.get("totale")
            
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO orders (user_id, contatto_id, cliente_id, data_ordine, stato, totale) 
                       VALUES (%s, %s, %s, %s, %s, %s) 
                       RETURNING id, user_id, contatto_id, cliente_id, data_ordine, stato, totale, created_at""",
                    (user_id, contatto_id, cliente_id, data_ordine, stato, totale)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "order": {
                    "id": row[0],
                    "user_id": row[1],
                    "contatto_id": row[2],
                    "cliente_id": row[3],
                    "data_ordine": str(row[4]) if row[4] else None,
                    "stato": row[5],
                    "totale": float(row[6]) if row[6] else None,
                    "created_at": str(row[7]) if row[7] else None
                }
            }
        
        elif method == "PUT":
            order_id = get_request_route_id(args, merged, "order")
            if not order_id:
                return {"ok": False, "error": "ID ordine non fornito"}
            
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM orders WHERE id = %s AND user_id = %s", (order_id, user_id))
                if not cur.fetchone():
                    return {"ok": False, "error": "Ordine non trovato"}
                
                contatto_id = merged.get("contatto_id")
                cliente_id = merged.get("cliente_id")
                data_ordine = merged.get("data_ordine")
                stato = merged.get("stato", "pending")
                totale = merged.get("totale")
                
                cur.execute(
                    """UPDATE orders 
                       SET contatto_id=%s, cliente_id=%s, data_ordine=%s, stato=%s, totale=%s 
                       WHERE id = %s AND user_id = %s 
                       RETURNING id, user_id, contatto_id, cliente_id, data_ordine, stato, totale, created_at""",
                    (contatto_id, cliente_id, data_ordine, stato, totale, order_id, user_id)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "order": {
                    "id": row[0],
                    "user_id": row[1],
                    "contatto_id": row[2],
                    "cliente_id": row[3],
                    "data_ordine": str(row[4]) if row[4] else None,
                    "stato": row[5],
                    "totale": float(row[6]) if row[6] else None,
                    "created_at": str(row[7]) if row[7] else None
                }
            }
        
        elif method == "DELETE":
            order_id = get_request_route_id(args, merged, "order")
            if not order_id:
                return {"ok": False, "error": "ID ordine non fornito"}
            
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM orders WHERE id = %s AND user_id = %s", (order_id, user_id))
                if not cur.fetchone():
                    return {"ok": False, "error": "Ordine non trovato"}
                
                cur.execute("DELETE FROM orders WHERE id = %s AND user_id = %s", (order_id, user_id))
            
            conn.commit()
            
            return {"ok": True, "message": "Ordine eliminato"}
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
