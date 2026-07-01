import json
import bcrypt
from datetime import datetime

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
    nome = merged.get("nome", "").strip()

    if not email or not password or not nome:
        return {"ok": False, "error": "Email, password e nome sono richiesti"}

    conn = ctx.POSTGRESQL
    
    try:
        with conn.cursor() as cur:
            # Check if user exists
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return {"ok": False, "error": "Email già registrata"}
            
            # Hash password
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Insert user
            cur.execute(
                "INSERT INTO users (email, password, nome) VALUES (%s, %s, %s) RETURNING id, email, nome, created_at",
                (email, hashed, nome)
            )
            user = cur.fetchone()
        
        conn.commit()
        
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
        conn.rollback()
        return {"ok": False, "error": str(e)}
