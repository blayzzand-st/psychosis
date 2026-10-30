"""Idempotent PostgreSQL schema upgrades for existing installations."""
from sqlalchemy import Engine, inspect, text
import secrets

from app.database import Base


def initialize_database(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(781024029)"))
        Base.metadata.create_all(connection)
        connection.execute(text('ALTER TABLE user_refresh_tokens ADD COLUMN IF NOT EXISTS family_id UUID'))
        connection.execute(text('UPDATE user_refresh_tokens SET family_id=id WHERE family_id IS NULL'))
        connection.execute(text('ALTER TABLE user_refresh_tokens ALTER COLUMN family_id SET NOT NULL'))
        connection.execute(text('CREATE INDEX IF NOT EXISTS ix_user_refresh_tokens_family_id ON user_refresh_tokens(family_id)'))
        connection.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0"))
        connection.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0"))
        connection.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ"))
        connection.execute(text('INSERT INTO authentication_keys (id, secret) VALUES (1, :secret) ON CONFLICT (id) DO NOTHING'),
                           {'secret': secrets.token_urlsafe(48)})
        connection.execute(text('ALTER TABLE authentication_keys ADD COLUMN IF NOT EXISTS private_key TEXT'))
        connection.execute(text('ALTER TABLE authentication_keys ADD COLUMN IF NOT EXISTS public_key TEXT'))
        connection.execute(text('ALTER TABLE administrator_sessions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() NOT NULL'))
        connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_admin_session_id ON administrator_sessions(id)'))
        connection.execute(text('ALTER TABLE administrator_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ'))
        if not connection.scalar(text('SELECT private_key FROM authentication_keys WHERE id = 1')):
            from app.tokens import generate_keys
            private, public = generate_keys()
            connection.execute(text('UPDATE authentication_keys SET private_key=:private, public_key=:public WHERE id=1'),
                               {'private': private, 'public': public})
            # Old symmetric JWT and opaque admin sessions must not remain valid after migration.
            connection.execute(text("UPDATE user_refresh_tokens SET revoked_at=now(), revoked_reason='signing_key_migration' WHERE revoked_at IS NULL"))
            connection.execute(text('UPDATE administrator_sessions SET revoked_at=now() WHERE revoked_at IS NULL'))
        for field in ('first_name', 'last_name'):
            constraint = f'ck_medical_workers_{field}_length'
            checks = inspect(connection).get_check_constraints('medical_workers')
            current = next((item['sqltext'] for item in checks if item['name'] == constraint), '')
            if 'BETWEEN 1 AND 24' not in current and '>= 1' not in current:
                connection.execute(text(f'ALTER TABLE medical_workers DROP CONSTRAINT IF EXISTS {constraint}'))
                connection.execute(text(f'ALTER TABLE medical_workers ADD CONSTRAINT {constraint} CHECK (length({field}) BETWEEN 1 AND 24)'))
        connection.execute(text('ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_label VARCHAR(128)'))
        connection.execute(text('ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS display_message TEXT'))
        connection.execute(text("""
            CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'Audit events cannot be changed or deleted' USING ERRCODE = '55000';
            END;
            $$
        """))
        if not connection.scalar(text("""
            SELECT EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgrelid = 'audit_events'::regclass AND tgname = 'audit_append_only')
        """)):
            connection.execute(text("""
                CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
                ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation()
            """))
        connection.execute(text("""
            CREATE OR REPLACE FUNCTION notify_audit_insert() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                PERFORM pg_notify('psychosis_audit_' || md5(TG_TABLE_SCHEMA), NEW.event_id::text);
                RETURN NEW;
            END;
            $$
        """))
        if not connection.scalar(text("""
            SELECT EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgrelid = 'audit_events'::regclass AND tgname = 'audit_insert_notification')
        """)):
            connection.execute(text("""
                CREATE TRIGGER audit_insert_notification AFTER INSERT ON audit_events
                FOR EACH ROW EXECUTE FUNCTION notify_audit_insert()
            """))
        columns = {column["name"] for column in inspect(connection).get_columns("medical_workers")}
        if "role" not in columns:
            connection.execute(text(
                "ALTER TABLE medical_workers ADD COLUMN role VARCHAR(21) NOT NULL DEFAULT 'other'"
            ))
        constraints = {item["name"] for item in inspect(connection).get_check_constraints("medical_workers")}
        if "ck_medical_workers_role" not in constraints:
            connection.execute(text(
                "ALTER TABLE medical_workers ADD CONSTRAINT ck_medical_workers_role "
                "CHECK (role IN ('doctor', 'laboratory-technician', 'nurse', 'other'))"
            ))
