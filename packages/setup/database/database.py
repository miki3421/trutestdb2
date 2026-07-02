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
                    telefono VARCHAR(20),
                    indirizzo TEXT,
                    piva VARCHAR(50),
                    iva_esente BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create clienti table (for invoices/customers)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS clienti (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    nome VARCHAR(100) NOT NULL,
                    email VARCHAR(255),
                    telefono VARCHAR(20),
                    citta VARCHAR(100),
                    nota TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create contacts table (kept for backward compatibility)
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
            
            # Create orders table with cliente_id reference
            cur.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    contatto_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
                    cliente_id INTEGER REFERENCES clienti(id) ON DELETE SET NULL,
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
            
            # Create pagamenti table for tracking invoice payments
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pagamenti (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                    importo DECIMAL(10,2) NOT NULL,
                    data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
                    metodo VARCHAR(50) NOT NULL,
                    nota TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create view for invoice payment status
            cur.execute("""
                CREATE OR REPLACE VIEW fatture_con_stato_pagamento AS
                SELECT 
                    o.id as order_id,
                    o.user_id,
                    o.contatto_id,
                    o.cliente_id,
                    c.nome as cliente_nome,
                    o.data_ordine as data_fattura,
                    o.stato as stato_ordine,
                    o.totale as importo_fattura,
                    COALESCE(SUM(p.importo), 0) as totale_pagato,
                    CASE 
                        WHEN COALESCE(SUM(p.importo), 0) = 0 THEN 'da_pagare'
                        WHEN COALESCE(SUM(p.importo), 0) < o.totale THEN 'parzialmente_pagata'
                        ELSE 'pagata'
                    END as stato_pagamento,
                    o.totale - COALESCE(SUM(p.importo), 0) as residuo,
                    MAX(p.data_pagamento) as ultimo_pagamento
                FROM orders o
                LEFT JOIN clienti c ON o.cliente_id = c.id
                LEFT JOIN pagamenti p ON p.order_id = o.id AND p.user_id = o.user_id
                GROUP BY o.id, o.user_id, o.contatto_id, o.cliente_id, 
                         c.nome, o.data_ordine, o.stato, o.totale
            """)
            
            # Create documenti table for client documents
            cur.execute("""
                CREATE TABLE IF NOT EXISTS documenti (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    cliente_id INTEGER REFERENCES clienti(id) ON DELETE CASCADE,
                    nome_file VARCHAR(255) NOT NULL,
                    categoria VARCHAR(100) NOT NULL,
                    descrizione TEXT,
                    s3_key VARCHAR(500) NOT NULL,
                    content_type VARCHAR(100),
                    size_bytes INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create index for faster document lookups by client
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_documenti_cliente_id 
                ON documenti(cliente_id)
            """)
            
            # Add missing columns to users table if they don't exist
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS cognome VARCHAR(100)
            """)
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono VARCHAR(20)
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
            
            # Add cliente_id column to orders table if it doesn't exist
            cur.execute("""
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clienti(id) ON DELETE SET NULL
            """)
        
        conn.commit()
        return {"ok": True, "message": "Database tables created successfully"}
    
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
