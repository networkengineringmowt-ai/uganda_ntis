-- ════════════════════════════════════════════════════════════════════════════
-- UGROADS GIS Enterprise · 03 — row-level versioning ("geodatabase archiving")
-- Every INSERT/UPDATE/DELETE on every data table is snapshotted to
-- audit.history with user + timestamp + old/new JSONB. Recover any row with
-- audit.restore_row(). psql -U gis_admin -d ugroads -f sql/03_audit_triggers.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit.history (
  id          bigserial PRIMARY KEY,
  happened_at timestamptz NOT NULL DEFAULT now(),
  db_user     text        NOT NULL DEFAULT current_user,
  app_user    text        DEFAULT current_setting('ugroads.app_user', true),
  schema_name text NOT NULL,
  table_name  text NOT NULL,
  op          text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  pk          jsonb,
  old_row     jsonb,
  new_row     jsonb
);
CREATE INDEX IF NOT EXISTS history_table_ix ON audit.history (schema_name, table_name, happened_at DESC);

CREATE OR REPLACE FUNCTION audit.log_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pk jsonb;
BEGIN
  -- primary-key snapshot (first PK column)
  SELECT jsonb_object_agg(a.attname,
           CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)->>a.attname
                ELSE to_jsonb(NEW)->>a.attname END)
    INTO pk
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = TG_RELID AND i.indisprimary;

  INSERT INTO audit.history (schema_name, table_name, op, pk, old_row, new_row)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, pk,
          CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach the trigger to every table in the data schemas (idempotent)
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('core','traffic','pms','rms')
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_log ON %I.%I;
       CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON %I.%I
       FOR EACH ROW EXECUTE FUNCTION audit.log_change();',
      t.schemaname, t.tablename, t.schemaname, t.tablename);
  END LOOP;
END $$;

-- ── Point-in-row recovery ─────────────────────────────────────────────────────
-- SELECT audit.restore_row('core.bridges', 12345);  -- history id
CREATE OR REPLACE FUNCTION audit.restore_row(target regclass, history_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE h audit.history; cols text; vals text;
BEGIN
  SELECT * INTO h FROM audit.history WHERE id = history_id;
  IF h.id IS NULL THEN RETURN 'history id not found'; END IF;
  IF h.old_row IS NULL THEN RETURN 'no old_row snapshot (was an INSERT)'; END IF;

  SELECT string_agg(quote_ident(key), ', '),
         string_agg(format('(%L)::%s', value,
           (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
             WHERE a.attrelid = target AND a.attname = key)), ', ')
    INTO cols, vals
  FROM jsonb_each_text(h.old_row);

  EXECUTE format('INSERT INTO %s (%s) VALUES (%s)
                  ON CONFLICT DO NOTHING', target, cols, vals);
  RETURN format('restored 1 row into %s from history %s (%s at %s)',
                target, history_id, h.op, h.happened_at);
END $$;

GRANT USAGE ON SCHEMA audit TO gis_viewer, gis_editor;
GRANT SELECT ON audit.history TO gis_viewer, gis_editor;
