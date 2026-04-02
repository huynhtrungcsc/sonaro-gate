import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, '..', 'drizzle');
  console.log('[DB] Running migrations from:', migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log('[DB] All migrations applied');
}
