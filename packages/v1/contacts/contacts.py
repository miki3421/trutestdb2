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
                    "SELECT id, user_id, nome, email, telefono, nota, created_at FROM contacts WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,)
                )
                rows = cur.fetchall()
                contacts = []
                for row in rows:
                    contacts.append({
                        "id": row[0],
                        "user_id": row[1],
                        "nome": row[2],
                        "email": row[3],
                        "telefono": row[4],
                        "nota": row[5],
                        "created_at": str(row[6]) if row[6] else None
                    })
                return {"ok": True, "contacts": contacts}
        
        elif method == "POST":
            nome = merged.get("nome", "").strip()
            if not nome:
                return {"ok": False, "error": "Nome è richiesto"}
            
            email = merged.get("email", "").strip() or None
            telefono = merged.get("telefono", "").strip() or None
            nota = merged.get("nota", "").strip() or None
            
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO contacts (user_id, nome, email, telefono, nota) VALUES (%s, %s, %s, %s, %s) RETURNING id, user_id, nome, email, telefono, nota, created_at",
                    (user_id, nome, email, telefono, nota)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "contact": {
                    "id": row[0],
                    "user_id": row[1],
                    "nome": row[2],
                    "email": row[3],
                    "telefono": row[4],
                    "nota": row[5],
                    "created_at": str(row[6]) if row[6] else None
                }
            }
        
        elif method == "PUT":
            contact_id = get_request_route_id(args, merged, "contact")
            if not contact_id:
                return {"ok": False, "error": "ID contatto non fornito"}
            
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM contacts WHERE id = %s AND user_id = %s", (contact_id, user_id))
                if not cur.fetchone():
                    return {"ok": False, "error": "Contatto non trovato"}
                
                nome = merged.get("nome", "").strip() or ""
                email = merged.get("email", "").strip() or ""
                telefono = merged.get("telefono", "").strip() or ""
                nota = merged.get("nota", "").strip() or ""
                
                cur.execute(
                    "UPDATE contacts SET nome=%s, email=%s, telefono=%s, nota=%s WHERE id = %s AND user_id = %s RETURNING id, user_id, nome, email, telefono, nota, created_at",
                    (nome, email, telefono, nota, contact_id, user_id)
                )
                row = cur.fetchone()
            
            conn.commit()
            
            return {
                "ok": True,
                "contact": {
                    "id": row[0],
                    "user_id": row[1],
                    "nome": row[2],
                    "email": row[3],
                    "telefono": row[4],
                    "nota": row[5],
                    "created_at": str(row[6]) if row[6] else None
                }
            }
        
        elif method == "DELETE":
            contact_id = get_request_route_id(args, merged, "contact")
            if not contact_id:
                return {"ok": False, "error": "ID contatto non fornito"}
            
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM contacts WHERE id = %s AND user_id = %s", (contact_id, user_id))
                if not cur.fetchone():
                    return {"ok": False, "error": "Contatto non trovato"}
                
                cur.execute("DELETE FROM contacts WHERE id = %s AND user_id = %s", (contact_id, user_id))
            
            conn.commit()
            
            return {"ok": True, "message": "Contatto eliminato"}
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
