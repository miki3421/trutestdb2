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
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT o.id, o.user_id, o.contatto_id, o.data_ordine, o.stato, o.totale, o.created_at 
                       FROM orders o 
                       WHERE o.user_id = %s 
                       ORDER BY o.created_at DESC""",
                    (user_id,)
                )
                rows = cur.fetchall()
                orders = []
                for row in rows:
                    orders.append({
                        "id": row[0],
                        "user_id": row[1],
                        "contatto_id": row[2],
                        "data_ordine": str(row[3]) if row[3] else None,
                        "stato": row[4],
                        "totale": float(row[5]) if row[5] else None,
                        "created_at": str(row[6]) if row[6] else None
                    })
                return {"ok": True, "orders": orders}
        
        elif method == "POST":
            data_ordine = merged.get("data_ordine")
            if not data_ordine:
                return {"ok": False, "error": "Data ordine è richiesta"}
            
            contatto_id = merged.get("contatto_id")
            stato = merged.get("stato", "pending")
            totale = merged.get("totale")
            
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO orders (user_id, contatto_id, data_ordine, stato, totale) 
                       VALUES (%s, %s, %s, %s, %s) 
                       RETURNING id, user_id, contatto_id, data_ordine, stato, totale, created_at""",
                    (user_id, contatto_id, data_ordine, stato, totale)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "order": {
                    "id": row[0],
                    "user_id": row[1],
                    "contatto_id": row[2],
                    "data_ordine": str(row[3]) if row[3] else None,
                    "stato": row[4],
                    "totale": float(row[5]) if row[5] else None,
                    "created_at": str(row[6]) if row[6] else None
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
                data_ordine = merged.get("data_ordine")
                stato = merged.get("stato", "pending")
                totale = merged.get("totale")
                
                cur.execute(
                    """UPDATE orders 
                       SET contatto_id=%s, data_ordine=%s, stato=%s, totale=%s 
                       WHERE id = %s AND user_id = %s 
                       RETURNING id, user_id, contatto_id, data_ordine, stato, totale, created_at""",
                    (contatto_id, data_ordine, stato, totale, order_id, user_id)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "order": {
                    "id": row[0],
                    "user_id": row[1],
                    "contatto_id": row[2],
                    "data_ordine": str(row[3]) if row[3] else None,
                    "stato": row[4],
                    "totale": float(row[5]) if row[5] else None,
                    "created_at": str(row[6]) if row[6] else None
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
