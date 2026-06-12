"""gisctl — UGROADS geodatabase management CLI. Backend access, change and
repair WITHOUT the front end. All operations are audited by the DB triggers.

  python tools/gisctl.py status                      health, sizes, row counts
  python tools/gisctl.py layers                      spatial layers + SRID + extent
  python tools/gisctl.py sql "UPDATE core.bridges SET ..."     ad-hoc change
  python tools/gisctl.py sql --file fix.sql                    scripted change
  python tools/gisctl.py repair                      ST_MakeValid every geometry
  python tools/gisctl.py vacuum | reindex            maintenance
  python tools/gisctl.py backup [--dir G:\\...]      pg_dump custom-format
  python tools/gisctl.py restore <dump> [--dry-run]  full restore
  python tools/gisctl.py history core.bridges --limit 20       audit trail
  python tools/gisctl.py undo <history_id>           restore a deleted row
"""
import argparse, os, subprocess, sys, datetime
import psycopg2
import psycopg2.extras

HERE = os.path.dirname(os.path.abspath(__file__))

def env(key, default=None):
    envfile = os.path.join(HERE, '..', '.env')
    if os.path.exists(envfile):
        for line in open(envfile, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
    return os.environ.get(key, default)

def connect():
    return psycopg2.connect(host=env('PGHOST', 'localhost'), port=env('PGPORT', '5432'),
                            dbname=env('PGDATABASE', 'ugroads'),
                            user=env('PGUSER', 'gis_admin'), password=env('PGPASSWORD', ''))

def q(sql, params=None, fetch=True):
    with connect() as cx, cx.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall() if fetch and cur.description else None

def cmd_status(_):
    v = q("SELECT version() v, postgis_full_version() p")[0]
    print(v['v'].split(',')[0]);  print(v['p'].split('GEOS')[0])
    print(f"\n{'table':<28}{'rows':>10}{'size':>12}")
    for r in q("""
        SELECT schemaname||'.'||relname t, n_live_tup n,
               pg_size_pretty(pg_total_relation_size(relid)) s
        FROM pg_stat_user_tables
        WHERE schemaname IN ('core','traffic','pms','rms','audit')
        ORDER BY 1"""):
        print(f"{r['t']:<28}{r['n']:>10}{r['s']:>12}")

def cmd_layers(_):
    for r in q("""
        SELECT f_table_schema||'.'||f_table_name layer, f_geometry_column col,
               srid, type,
               (SELECT count(*) FROM information_schema.tables) dummy
        FROM geometry_columns ORDER BY 1"""):
        ext = q(f"SELECT st_extent({r['col']})::text e FROM {r['layer']}")[0]['e']
        print(f"{r['layer']:<28} {r['type']:<18} SRID {r['srid']}  extent {ext}")

def cmd_sql(a):
    stmt = open(a.file, encoding='utf-8').read() if a.file else a.statement
    if not stmt:
        sys.exit('provide a statement or --file')
    with connect() as cx, cx.cursor() as cur:
        cur.execute("SELECT set_config('ugroads.app_user', %s, false)", (env('USERNAME', 'gisctl'),))
        cur.execute(stmt)
        if cur.description:
            for row in cur.fetchmany(50):
                print(row)
        print(f'OK — {cur.rowcount} row(s) affected (audited)')

def cmd_repair(_):
    total = 0
    for r in q("SELECT f_table_schema s, f_table_name t, f_geometry_column c FROM geometry_columns"):
        res = q(f"""UPDATE {r['s']}.{r['t']}
                    SET {r['c']} = ST_MakeValid({r['c']})
                    WHERE {r['c']} IS NOT NULL AND NOT ST_IsValid({r['c']})
                    RETURNING 1""", fetch=True) or []
        if res:
            print(f"  {r['s']}.{r['t']}: repaired {len(res)} geometries")
        total += len(res)
    print(f'repair complete — {total} invalid geometries fixed')

def cmd_vacuum(_):
    cx = connect(); cx.autocommit = True
    with cx.cursor() as cur:
        cur.execute('VACUUM (ANALYZE)')
    print('vacuum analyze complete')

def cmd_reindex(_):
    cx = connect(); cx.autocommit = True
    with cx.cursor() as cur:
        for s in ('core', 'traffic', 'pms', 'rms', 'audit'):
            cur.execute(f'REINDEX SCHEMA {s}')
            print(f'  reindexed {s}')

def cmd_backup(a):
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M')
    out = os.path.join(a.dir, f'ugroads_{stamp}.dump')
    os.makedirs(a.dir, exist_ok=True)
    envp = dict(os.environ, PGPASSWORD=env('PGPASSWORD', ''))
    subprocess.check_call(['pg_dump', '-h', env('PGHOST', 'localhost'), '-p', env('PGPORT', '5432'),
                           '-U', env('PGUSER', 'gis_admin'), '-d', env('PGDATABASE', 'ugroads'),
                           '-Fc', '-f', out], env=envp)
    print(f'backup written: {out} ({os.path.getsize(out)/1e6:.1f} MB)')

def cmd_restore(a):
    if a.dry_run:
        subprocess.check_call(['pg_restore', '--list', a.dump])
        print('\nDRY RUN ok — archive is readable. Re-run without --dry-run to restore.')
        return
    envp = dict(os.environ, PGPASSWORD=env('PGPASSWORD', ''))
    subprocess.check_call(['pg_restore', '-h', env('PGHOST', 'localhost'), '-p', env('PGPORT', '5432'),
                           '-U', env('PGUSER', 'gis_admin'), '-d', env('PGDATABASE', 'ugroads'),
                           '--clean', '--if-exists', a.dump], env=envp)
    print('restore complete')

def cmd_history(a):
    sch, tbl = a.table.split('.')
    for r in q("""SELECT id, happened_at, db_user, op, pk
                  FROM audit.history WHERE schema_name=%s AND table_name=%s
                  ORDER BY id DESC LIMIT %s""", (sch, tbl, a.limit)):
        print(f"#{r['id']:<8}{str(r['happened_at'])[:19]}  {r['db_user']:<12}{r['op']:<8}{r['pk']}")

def cmd_undo(a):
    print(q("SELECT audit.restore_row((SELECT (schema_name||'.'||table_name)::regclass "
            "FROM audit.history WHERE id=%s), %s) r", (a.id, a.id))[0]['r'])

p = argparse.ArgumentParser(description='UGROADS geodatabase control')
sub = p.add_subparsers(dest='cmd', required=True)
sub.add_parser('status').set_defaults(fn=cmd_status)
sub.add_parser('layers').set_defaults(fn=cmd_layers)
s = sub.add_parser('sql'); s.add_argument('statement', nargs='?'); s.add_argument('--file'); s.set_defaults(fn=cmd_sql)
sub.add_parser('repair').set_defaults(fn=cmd_repair)
sub.add_parser('vacuum').set_defaults(fn=cmd_vacuum)
sub.add_parser('reindex').set_defaults(fn=cmd_reindex)
s = sub.add_parser('backup'); s.add_argument('--dir', default=r'G:\My Drive\MOWT\Uganda National Road Network Repository\db_backups'); s.set_defaults(fn=cmd_backup)
s = sub.add_parser('restore'); s.add_argument('dump'); s.add_argument('--dry-run', action='store_true'); s.set_defaults(fn=cmd_restore)
s = sub.add_parser('history'); s.add_argument('table'); s.add_argument('--limit', type=int, default=20); s.set_defaults(fn=cmd_history)
s = sub.add_parser('undo'); s.add_argument('id', type=int); s.set_defaults(fn=cmd_undo)
a = p.parse_args()
a.fn(a)
