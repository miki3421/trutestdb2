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
    user_id = get_user_id_from_token(args, conn)
    
    if not user_id:
        return {"ok": False, "error": "Autenticazione richiesta"}
    
    try:
        if method == "GET":
            query_search = merged.get("search") or merged.get("q")
            
            with conn.cursor() as cur:
                if query_search:
                    search_pattern = f"%{query_search}%"
                    cur.execute(
                        """SELECT id, user_id, nome, email, telefono, citta, nota, created_at 
                           FROM clienti 
                           WHERE user_id = %s 
                           AND (nome ILIKE %s OR email ILIKE %s OR telefono ILIKE %s OR citta ILIKE %s OR nota ILIKE %s)
                           ORDER BY nome ASC""",
                        (user_id, search_pattern, search_pattern, search_pattern, search_pattern, search_pattern)
                    )
                else:
                    cur.execute(
                        """SELECT id, user_id, nome, email, telefono, citta, nota, created_at 
                           FROM clienti 
                           WHERE user_id = %s 
                           ORDER BY nome ASC""",
                        (user_id,)
                    )
                
                rows = cur.fetchall()
                clienti = []
                for row in rows:
                    clienti.append({
                        "id": row[0],
                        "user_id": row[1],
                        "nome": row[2] or "",
                        "email": row[3] or "",
                        "telefono": row[4] or "",
                        "citta": row[5] or "",
                        "nota": row[6] or "",
                        "created_at": str(row[7]) if row[7] else None
                    })
                return {"ok": True, "clienti": clienti}
        
        elif method == "POST":
            nome = merged.get("nome")
            if not nome:
                return {"ok": False, "error": "Nome è richiesto"}
            
            email = merged.get("email") or ""
            telefono = merged.get("telefono") or ""
            citta = merged.get("citta") or ""
            nota = merged.get("nota") or ""
            
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO clienti (user_id, nome, email, telefono, citta, nota) 
                       VALUES (%s, %s, %s, %s, %s, %s) 
                       RETURNING id, user_id, nome, email, telefono, citta, nota, created_at""",
                    (user_id, nome, email, telefono, citta, nota)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "cliente": {
                    "id": row[0],
                    "user_id": row[1],
                    "nome": row[2] or "",
                    "email": row[3] or "",
                    "telefono": row[4] or "",
                    "citta": row[5] or "",
                    "nota": row[6] or "",
                    "created_at": str(row[7]) if row[7] else None
                }
            }
        
        elif method == "PUT":
            cliente_id = get_request_route_id(args, merged, "cliente")
            if not cliente_id:
                return {"ok": False, "error": "ID cliente non fornito"}
            
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM clienti WHERE id = %s AND user_id = %s", (cliente_id, user_id))
                if not cur.fetchone():
                    return {"ok": False, "error": "Cliente non trovato"}
                
                nome = merged.get("nome")
                if not nome:
                    return {"ok": False, "error": "Nome è richiesto"}
                
                email = merged.get("email") or ""
                telefono = merged.get("telefono") or ""
                citta = merged.get("citta") or ""
                nota = merged.get("nota") or ""
                
                cur.execute(
                    """UPDATE clienti 
                       SET nome=%s, email=%s, telefono=%s, citta=%s, nota=%s 
                       WHERE id = %s AND user_id = %s 
                       RETURNING id, user_id, nome, email, telefono, citta, nota, created_at""",
                    (nome, email, telefono, citta, nota, cliente_id, user_id)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "cliente": {
                    "id": row[0],
                    "user_id": row[1],
                    "nome": row[2] or "",
                    "email": row[3] or "",
                    "telefono": row[4] or "",
                    "citta": row[5] or "",
                    "nota": row[6] or "",
                    "created_at": str(row[7]) if row[7] else None
                }
            }
        
        elif method == "DELETE":
            cliente_id = get_request_route_id(args, merged, "cliente")
            if not cliente_id:
                return {"ok": False, "error": "ID cliente non fornito"}
            
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM clienti WHERE id = %s AND user_id = %s", (cliente_id, user_id))
                if not cur.fetchone():
                    return {"ok": False, "error": "Cliente non trovato"}
                
                cur.execute("DELETE FROM clienti WHERE id = %s AND user_id = %s", (cliente_id, user_id))
            
            conn.commit()
            
            return {"ok": True, "message": "Cliente eliminato"}
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
