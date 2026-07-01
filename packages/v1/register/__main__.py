#--kind python:default
#--web true
#--timeout 300000
import types
import os
import register

def init_postgresql(args, ctx):
    dburl = args.get("POSTGRES_URL") or os.getenv("POSTGRES_URL")
    import psycopg
    ctx.POSTGRESQL = psycopg.connect(dburl)

def main(args, ctx=None):
    if ctx is None:
        ctx = types.SimpleNamespace()
        init_postgresql(args, ctx)
    return {"body": register.main(args, ctx=ctx)}
