/**
 * Sonaro Gate — Database Migration Handler
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * https://github.com/huynhtrungcsc/sonaro-gate
 * SPDX-License-Identifier: MIT
 */

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { db } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, '..', 'drizzle');
  console.log('[DB] Checking database schema...');

  // Detect whether the DB already has our tables (e.g. set up via drizzle-kit push).
  // On a fresh production DB there are no tables — migrate() creates them all.
  // On the dev/Replit DB tables already exist; migrate() would crash with
  // "relation already exists" (PG 42P07) because there is no __drizzle_migrations
  // tracking table yet. In that case we skip the initial migration.
  const res = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS has_tables,
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
    ) AS has_tracking
  `);

  const { has_tables, has_tracking } = (res.rows[0] ?? {}) as {
    has_tables: boolean;
    has_tracking: boolean;
  };

  if (has_tables && !has_tracking) {
    // Tables exist but were created via drizzle-kit push (no migration history).
    // The schema is already up to date — nothing to migrate.
    console.log('[DB] Schema already present (created via drizzle push) — skipping migrations');
    return;
  }

  // Either fresh DB (no tables) or DB with proper migration tracking — run normally.
  // migrate() is idempotent: it only runs migrations not yet recorded in
  // __drizzle_migrations, so repeated restarts are safe.
  console.log('[DB] Running migrations from:', migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log('[DB] All migrations applied');
}
