def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "POSTGRESQL"):
        return {"ok": False, "error": "Database not configured"}

    conn = ctx.POSTGRESQL
    
    try:
        with conn.cursor() as cur:
            # Create users table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    nome VARCHAR(100) NOT NULL,
                    cognome VARCHAR(100),
                    indirizzo TEXT,
                    piva VARCHAR(50),
                    iva_esente BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create contacts table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS contacts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    nome VARCHAR(100) NOT NULL,
                    cognome VARCHAR(100),
                    email VARCHAR(255),
                    telefono VARCHAR(20),
                    indirizzo TEXT,
                    nota TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create orders table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    contatto_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
                    data_ordine DATE NOT NULL,
                    stato VARCHAR(20) DEFAULT 'pending',
                    totale DECIMAL(10,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create sessions table for token authentication
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                )
            """)
            
            # Add missing columns to users table if they don't exist
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS cognome VARCHAR(100)
            """)
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS indirizzo TEXT
            """)
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS piva VARCHAR(50)
            """)
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS iva_esente BOOLEAN DEFAULT FALSE
            """)
            
            # Add missing columns to contacts table if they don't exist
            cur.execute("""
                ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cognome VARCHAR(100)
            """)
            cur.execute("""
                ALTER TABLE contacts ADD COLUMN IF NOT EXISTS indirizzo TEXT
            """)
        
        conn.commit()
        return {"ok": True, "message": "Database tables created successfully"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
