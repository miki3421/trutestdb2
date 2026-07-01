import json
import bcrypt
from datetime import datetime, timedelta
import secrets

def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "POSTGRESQL"):
        return {"ok": False, "error": "Database not configured"}

    data = dict(args) if isinstance(args, dict) else {}
    body = data.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:
            body = {}
    merged = dict(body) if isinstance(body, dict) else {}
    merged.update({k: v for k, v in data.items() if k not in {"body", "POSTGRES_URL"}})

    email = merged.get("email", "").strip().lower()
    password = merged.get("password")

    if not email or not password:
        return {"ok": False, "error": "Email e password sono richiesti"}

    conn = ctx.POSTGRESQL
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, nome, password FROM users WHERE email = %s", (email,))
            user = cur.fetchone()
            
            if not user:
                return {"ok": False, "error": "Credenziali non valide"}
            
            stored_hash = user[3]
            if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
                return {"ok": False, "error": "Credenziali non valide"}
            
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(hours=24)
            
            cur.execute(
                "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
                (user[0], token, expires_at)
            )
        
        conn.commit()
        
        return {
            "ok": True,
            "user": {
                "id": user[0],
                "email": user[1],
                "nome": user[2]
            },
            "token": token
        }
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
