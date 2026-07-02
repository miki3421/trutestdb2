import json
import os
from datetime import datetime
from urllib.parse import unquote, quote

# Allowed file extensions and their content types
ALLOWED_EXTENSIONS = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
}

CATEGORIES = ['contratto', 'documento_identita', 'preventivo', 'fattura', 'altro']

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

def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "POSTGRESQL"):
        return {"ok": False, "error": "Database non configurato"}
    
    if not hasattr(ctx, "S3_CLIENT") or not hasattr(ctx, "S3_DATA"):
        return {"ok": False, "error": "S3 non configurato"}

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
    s3_client = ctx.S3_CLIENT
    s3_data = ctx.S3_DATA
    
    user_id = get_user_id_from_token(args, conn)
    
    if not user_id:
        return {"ok": False, "error": "Autenticazione richiesta"}
    
    try:
        if method == "GET":
            # List documents with optional filters
            cliente_id = merged.get("cliente_id")
            categoria = merged.get("categoria")
            search = merged.get("search") or merged.get("q")
            
            query = """
                SELECT id, user_id, cliente_id, nome_file, categoria, descrizione, 
                       s3_key, content_type, size_bytes, created_at
                FROM documenti
                WHERE user_id = %s
            """
            params = [user_id]
            
            if cliente_id:
                query += " AND cliente_id = %s"
                params.append(cliente_id)
            
            if categoria:
                query += " AND categoria = %s"
                params.append(categoria)
            
            if search:
                search_pattern = f"%{search}%"
                query += " AND (nome_file ILIKE %s OR descrizione ILIKE %s)"
                params.extend([search_pattern, search_pattern])
            
            query += " ORDER BY created_at DESC"
            
            with conn.cursor() as cur:
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                
                documenti = []
                for row in rows:
                    documenti.append({
                        "id": row[0],
                        "user_id": row[1],
                        "cliente_id": row[2],
                        "nome_file": row[3],
                        "categoria": row[4],
                        "descrizione": row[5] or "",
                        "s3_key": row[6],
                        "content_type": row[7],
                        "size_bytes": row[8],
                        "created_at": str(row[9]) if row[9] else None
                    })
                
                return {"ok": True, "documenti": documenti}
        
        elif method == "POST":
            # Upload new document
            cliente_id = merged.get("cliente_id")
            categoria = merged.get("categoria")
            descrizione = merged.get("descrizione", "")
            
            if not cliente_id or not categoria:
                return {"ok": False, "error": "cliente_id e categoria sono obbligatori"}
            
            if categoria not in CATEGORIES:
                return {"ok": False, "error": f"Categoria non valida. Valori consentiti: {', '.join(CATEGORIES)}"}
            
            # Verify cliente belongs to user
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM clienti WHERE id = %s AND user_id = %s",
                    (cliente_id, user_id)
                )
                if not cur.fetchone():
                    return {"ok": False, "error": "Cliente non trovato"}
            
            # Check for file upload in args
            nome_file = merged.get("nome_file") or merged.get("filename")
            content_type = merged.get("content_type") or merged.get("type")
            file_data = merged.get("file_data")  # Base64 encoded file data
            
            if not nome_file or not file_data:
                return {"ok": False, "error": "File non fornito. Inviare file_data (base64) e nome_file"}
            
            # Validate file extension
            ext = os.path.splitext(nome_file)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                return {
                    "ok": False, 
                    "error": f"Tipo di file non supportato: {ext}. Formati consentiti: PDF, immagini (JPG, PNG, GIF), testo, Word (.doc, .docx)"
                }
            
            # Generate unique S3 key
            import base64
            import hashlib
            
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            file_hash = hashlib.md5(file_data.encode()).hexdigest()[:8]
            s3_key = f"documenti/{user_id}/{timestamp}_{file_hash}_{os.path.basename(nome_file)}"
            
            # Calculate size
            try:
                size_bytes = len(base64.b64decode(file_data))
            except Exception:
                size_bytes = 0
            
            # Upload to S3
            s3_client.put_object(
                Bucket=s3_data,
                Key=s3_key,
                Body=base64.b64decode(file_data),
                ContentType=content_type or ALLOWED_EXTENSIONS.get(ext, 'application/octet-stream')
            )
            
            # Save metadata to database
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO documenti 
                       (user_id, cliente_id, nome_file, categoria, descrizione, s3_key, content_type, size_bytes)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id""",
                    (user_id, cliente_id, nome_file, categoria, descrizione, s3_key, 
                     content_type or ALLOWED_EXTENSIONS.get(ext), size_bytes)
                )
                new_id = cur.fetchone()[0]
            
            conn.commit()
            
            return {
                "ok": True,
                "id": new_id,
                "message": "Documento caricato con successo"
            }
        
        elif method == "PUT":
            # Update document metadata (not file content)
            doc_id = get_request_route_id(args, merged, "documenti")
            if not doc_id:
                return {"ok": False, "error": "ID documento non fornito"}
            
            categoria = merged.get("categoria")
            descrizione = merged.get("descrizione")
            
            with conn.cursor() as cur:
                # Verify ownership
                cur.execute(
                    "SELECT id FROM documenti WHERE id = %s AND user_id = %s",
                    (doc_id, user_id)
                )
                if not cur.fetchone():
                    return {"ok": False, "error": "Documento non trovato"}
                
                updates = []
                params = []
                
                if categoria:
                    if categoria not in CATEGORIES:
                        return {"ok": False, "error": f"Categoria non valida. Valori consentiti: {', '.join(CATEGORIES)}"}
                    updates.append("categoria = %s")
                    params.append(categoria)
                
                if descrizione is not None:
                    updates.append("descrizione = %s")
                    params.append(descrizione)
                
                if updates:
                    query = f"UPDATE documenti SET {', '.join(updates)} WHERE id = %s AND user_id = %s"
                    params.extend([doc_id, user_id])
                    cur.execute(query, tuple(params))
            
            conn.commit()
            return {"ok": True, "message": "Documento aggiornato"}
        
        elif method == "DELETE":
            # Delete document
            doc_id = get_request_route_id(args, merged, "documenti")
            if not doc_id:
                return {"ok": False, "error": "ID documento non fornito"}
            
            with conn.cursor() as cur:
                # Get S3 key and verify ownership
                cur.execute(
                    "SELECT s3_key FROM documenti WHERE id = %s AND user_id = %s",
                    (doc_id, user_id)
                )
                result = cur.fetchone()
                if not result:
                    return {"ok": False, "error": "Documento non trovato"}
                
                s3_key = result[0]
                
                # Delete from S3
                try:
                    s3_client.delete_object(Bucket=s3_data, Key=s3_key)
                except Exception as e:
                    pass  # Continue even if S3 delete fails
                
                # Delete from database
                cur.execute("DELETE FROM documenti WHERE id = %s AND user_id = %s", (doc_id, user_id))
            
            conn.commit()
            return {"ok": True, "message": "Documento eliminato"}
        
        elif method == "HEAD" or args.get("__ow_path", "").endswith("/download"):
            # Download document - get presigned URL
            doc_id = merged.get("id") or get_request_route_id(args, merged, "documenti")
            
            if not doc_id:
                return {"ok": False, "error": "ID documento non fornito"}
            
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT s3_key, nome_file, content_type 
                       FROM documenti 
                       WHERE id = %s AND user_id = %s""",
                    (doc_id, user_id)
                )
                result = cur.fetchone()
                
                if not result:
                    return {"ok": False, "error": "Documento non trovato"}
                
                s3_key, nome_file, content_type = result
            
            # Generate presigned URL
            from urllib.parse import quote_plus
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': s3_data,
                    'Key': s3_key,
                    'ResponseContentDisposition': f'attachment; filename="{quote_plus(nome_file)}"'
                },
                ExpiresIn=3600  # URL valid for 1 hour
            )
            
            return {
                "ok": True,
                "presigned_url": presigned_url,
                "nome_file": nome_file,
                "content_type": content_type
            }
        
        else:
            return {"ok": False, "error": f"Metodo non supportato: {method}"}
    
    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        return {"ok": False, "error": str(e)}
