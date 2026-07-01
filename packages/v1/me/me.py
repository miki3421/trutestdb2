import json
from datetime import datetime

def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "POSTGRESQL"):
        return {"ok": False, "error": "Database not configured"}

    headers = args.get("__ow_headers") or {}
    auth_header = headers.get("authorization", "")
    
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    if not token:
        return {"ok": False, "error": "Token non fornito"}

    conn = ctx.POSTGRESQL
    
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT s.user_id FROM sessions s 
                   WHERE s.token = %s AND (s.expires_at IS NULL OR s.expires_at > %s)""",
                (token, datetime.now())
            )
            result = cur.fetchone()
            
            if not result:
                return {"ok": False, "error": "Token non valido o scaduto"}
            
            user_id = result[0]
            
            cur.execute("SELECT id, email, nome, created_at FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            
            if not user:
                return {"ok": False, "error": "Utente non trovato"}
        
        return {
            "ok": True,
            "user": {
                "id": user[0],
                "email": user[1],
                "nome": user[2],
                "created_at": str(user[3]) if user[3] else None
            }
        }
    
    except Exception as e:
        return {"ok": False, "error": str(e)}
