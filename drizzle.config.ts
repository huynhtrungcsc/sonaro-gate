import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Fallback to a dummy URL so `drizzle-kit generate` works at Docker build
    // time when DATABASE_URL is not set (generate reads schema only, no DB).
    url: process.env.DATABASE_URL ?? 'postgresql://localhost/dummy',
  },
});
