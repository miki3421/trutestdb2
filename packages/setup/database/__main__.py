#--kind python:default
#--web false
#--timeout 300000
import types
import os
import database

def init_postgresql(args, ctx):
    dburl = args.get("POSTGRES_URL") or os.getenv("POSTGRES_URL")
    import psycopg
    ctx.POSTGRESQL = psycopg.connect(dburl)

def main(args, ctx=None):
    if ctx is None:
        ctx = types.SimpleNamespace()
        init_postgresql(args, ctx)
    return {"body": database.main(args, ctx=ctx)}
