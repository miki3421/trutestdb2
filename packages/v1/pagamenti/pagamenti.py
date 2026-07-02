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
    
    try:
        if method == "GET":
            # List all payments for the user's orders
            user_id = get_user_id_from_token(args, conn)
            if not user_id:
                return {"ok": False, "error": "Autenticazione richiesta"}
            
            order_id = merged.get("order_id")
            query = """
                SELECT p.id, p.order_id, p.importo, p.data_pagamento, 
                       p.metodo, p.nota, p.created_at
                FROM pagamenti p
                WHERE p.user_id = %s
            """
            params = [user_id]
            
            if order_id:
                query += " AND p.order_id = %s"
                params.append(order_id)
            
            query += " ORDER BY p.data_pagamento DESC, p.created_at DESC"
            
            with conn.cursor() as cur:
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                
                pagamenti = []
                for row in rows:
                    pagamenti.append({
                        "id": row[0],
                        "order_id": row[1],
                        "importo": float(row[2]) if row[2] else 0.0,
                        "data_pagamento": str(row[3]) if row[3] else None,
                        "metodo": row[4],
                        "nota": row[5],
                        "created_at": str(row[6]) if row[6] else None
                    })
                
                return {"ok": True, "pagamenti": pagamenti}
        
        elif method == "POST":
            # Create new payment
            user_id = get_user_id_from_token(args, conn)
            if not user_id:
                return {"ok": False, "error": "Autenticazione richiesta"}
            
            order_id = merged.get("order_id")
            importo = merged.get("importo")
            data_pagamento = merged.get("data_pagamento") or datetime.now().strftime("%Y-%m-%d")
            metodo = merged.get("metodo", "")
            nota = merged.get("nota", "")
            
            if not order_id or not importo:
                return {"ok": False, "error": "order_id e importo sono obbligatori"}
            
            # Verify the order belongs to user
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM orders WHERE id = %s AND user_id = %s",
                    (order_id, user_id)
                )
                if not cur.fetchone():
                    return {"ok": False, "error": "Ordine non trovato"}
                
                cur.execute(
                    """INSERT INTO pagamenti (user_id, order_id, importo, data_pagamento, metodo, nota)
                       VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                    (user_id, order_id, float(importo), data_pagamento, metodo, nota or "")
                )
                new_id = cur.fetchone()[0]
            
            conn.commit()
            return {"ok": True, "id": new_id}
        
        elif method == "PUT":
            # Update payment
            user_id = get_user_id_from_token(args, conn)
            if not user_id:
                return {"ok": False, "error": "Autenticazione richiesta"}
            
            payment_id = get_request_route_id(args, merged, "pagamenti")
            if not payment_id:
                return {"ok": False, "error": "ID pagamento non fornito"}
            
            importo = merged.get("importo")
            data_pagamento = merged.get("data_pagamento")
            metodo = merged.get("metodo")
            nota = merged.get("nota")
            
            with conn.cursor() as cur:
                # Verify ownership
                cur.execute(
                    "SELECT id FROM pagamenti WHERE id = %s AND user_id = %s",
                    (payment_id, user_id)
                )
                if not cur.fetchone():
                    return {"ok": False, "error": "Pagamento non trovato"}
                
                updates = []
                params = []
                
                if importo is not None:
                    updates.append("importo = %s")
                    params.append(float(importo))
                if data_pagamento:
                    updates.append("data_pagamento = %s")
                    params.append(data_pagamento)
                if metodo is not None:
                    updates.append("metodo = %s")
                    params.append(metodo)
                if nota is not None:
                    updates.append("nota = %s")
                    params.append(nota)
                
                if updates:
                    updates.append("user_id = %s")
                    params.append(user_id)
                    query = f"UPDATE pagamenti SET {', '.join(updates[:-1])} WHERE user_id = %s AND id = %s"
                    params.append(payment_id)
                    cur.execute(query, tuple(params))
            
            conn.commit()
            return {"ok": True}
        
        elif method == "DELETE":
            # Delete payment
            user_id = get_user_id_from_token(args, conn)
            if not user_id:
                return {"ok": False, "error": "Autenticazione richiesta"}
            
            payment_id = get_request_route_id(args, merged, "pagamenti")
            if not payment_id:
                return {"ok": False, "error": "ID pagamento non fornito"}
            
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM pagamenti WHERE id = %s AND user_id = %s",
                    (payment_id, user_id)
                )
                if not cur.fetchone():
                    return {"ok": False, "error": "Pagamento non trovato"}
                
                cur.execute("DELETE FROM pagamenti WHERE id = %s AND user_id = %s",
                           (payment_id, user_id))
            
            conn.commit()
            return {"ok": True}
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
