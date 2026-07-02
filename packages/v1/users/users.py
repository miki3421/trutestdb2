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
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, nome, cognome, email, telefono, indirizzo, piva, iva_esente 
                       FROM users WHERE id = %s""",
                    (user_id,)
                )
                row = cur.fetchone()
                
                if not row:
                    return {"ok": False, "error": "Utente non trovato"}
                
                return {
                    "ok": True,
                    "user": {
                        "id": row[0],
                        "nome": row[1],
                        "cognome": row[2],
                        "email": row[3],
                        "telefono": row[4],
                        "indirizzo": row[5],
                        "piva": row[6],
                        "iva_esente": row[7] if row[7] else False
                    }
                }
        
        elif method == "PUT":
            nome = merged.get("nome", "").strip() or ""
            cognome = merged.get("cognome", "").strip() or None
            email = merged.get("email", "").strip() or None
            telefono = merged.get("telefono", "").strip() or None
            indirizzo = merged.get("indirizzo", "").strip() or None
            piva = merged.get("piva", "").strip() or None
            iva_esente = merged.get("iva_esente", False)
            
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE users 
                       SET nome=%s, cognome=%s, email=%s, telefono=%s, indirizzo=%s, piva=%s, iva_esente=%s 
                       WHERE id = %s 
                       RETURNING id, nome, cognome, email, telefono, indirizzo, piva, iva_esente""",
                    (nome, cognome, email, telefono, indirizzo, piva, iva_esente, user_id)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            if not row:
                return {"ok": False, "error": "Utente non trovato"}
            
            return {
                "ok": True,
                "user": {
                    "id": row[0],
                    "nome": row[1],
                    "cognome": row[2],
                    "email": row[3],
                    "telefono": row[4],
                    "indirizzo": row[5],
                    "piva": row[6],
                    "iva_esente": bool(row[7])
                }
            }
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
