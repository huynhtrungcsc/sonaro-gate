-- ─────────────────────────────────────────────────────────────────────────────
-- Sonaro Gate • 2025.1 LTS  —  PostgreSQL Initialization
-- GitHub: https://github.com/huynhtrungcsc/sonaro-gate
--
-- Runs ONCE when the PostgreSQL container is first created.
-- Only creates extensions; all tables are managed by Drizzle ORM.
--
-- ⚠  Do NOT define tables here.
--    Sonaro Gate uses Drizzle ORM (npm run db:push) to manage the schema.
--    Defining tables manually would conflict with Drizzle migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- UUID and crypto support (required by Drizzle schema primary keys / bcrypt)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Application role enum — created here so it exists before the first db:push
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'operator', 'auditor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
