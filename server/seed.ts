/**
 * Seeds the database with initial admin user and system defaults.
 * Safe to run multiple times (checks for existing data).
 */
import { db } from './db.js';
import { users, userRoles, systemSettings, dnsForwardZones, dnsLocalRecords, dnsFilterProfiles } from '../shared/schema.js';
import { hashPassword } from './auth.js';
import { eq, sql } from 'drizzle-orm';

const SYSTEM_DEFAULTS = [
  { key: 'hostname', value: 'sonaro-gw-01', description: 'Firewall hostname' },
  { key: 'timezone', value: 'Asia/Ho_Chi_Minh', description: 'System timezone' },
  { key: 'ntp_server', value: 'pool.ntp.org', description: 'NTP server' },
  { key: 'management_port', value: '443', description: 'HTTPS management port' },
  { key: 'session_timeout', value: '3600', description: 'Admin session timeout (seconds)' },
  { key: 'log_retention_days', value: '90', description: 'Log retention period in days' },
  { key: 'ids_mode', value: 'ips', description: 'IDS/IPS operating mode' },
  { key: 'operation_mode', value: 'NAT', description: 'Firewall operation mode (NAT/Transparent/Route)' },
  { key: 'ha_mode', value: 'Standalone', description: 'High Availability mode (Standalone/Active-Passive/Active-Active)' },
  { key: 'firmware_version', value: '2025.1 LTS', description: 'Firmware version string' },
  { key: 'serial_number', value: 'SONARO-GATE', description: 'Hardware serial number (auto-detected on boot)' },
];

/**
 * Ensure all system setting defaults exist.
 * Always runs — even on existing installs — to back-fill any missing keys.
 */
async function ensureSystemSettings() {
  for (const setting of SYSTEM_DEFAULTS) {
    const exists = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, setting.key))
      .limit(1);
    if (exists.length === 0) {
      await db.insert(systemSettings).values(setting);
    }
  }
}

async function ensureDnsDefaults() {
  // Forward zones — seeded once
  const zoneCount = await db.select({ c: sql<number>`count(*)` }).from(dnsForwardZones);
  if (Number(zoneCount[0].c) === 0) {
    await db.insert(dnsForwardZones).values([
      { name: '.', type: 'forward', servers: ['8.8.8.8', '8.8.4.4'], enabled: true },
      { name: 'local.lan', type: 'forward', servers: ['127.0.0.1'], enabled: true },
      { name: 'corp.internal', type: 'forward', servers: ['192.168.1.1'], enabled: true },
    ]);
  }

  // Local records
  const recCount = await db.select({ c: sql<number>`count(*)` }).from(dnsLocalRecords);
  if (Number(recCount[0].c) === 0) {
    await db.insert(dnsLocalRecords).values([
      { hostname: 'gateway',   domain: 'local.lan', type: 'A', address: '192.168.1.1',   ttl: 3600, enabled: true },
      { hostname: 'firewall',  domain: 'local.lan', type: 'A', address: '192.168.1.1',   ttl: 3600, enabled: true },
      { hostname: 'nas',       domain: 'local.lan', type: 'A', address: '192.168.1.10',  ttl: 3600, enabled: true },
      { hostname: 'webserver', domain: 'local.lan', type: 'A', address: '192.168.1.100', ttl: 3600, enabled: true },
    ]);
  }

  // Filter profiles
  const fpCount = await db.select({ c: sql<number>`count(*)` }).from(dnsFilterProfiles);
  if (Number(fpCount[0].c) === 0) {
    await db.insert(dnsFilterProfiles).values([
      { name: 'Default Security', comment: 'Default security profile with safe search', domain_filter: true, safe_search: true, fortiguard_category: false, youtube_restrict: false, log_all_domains: true, enabled: true, blocked_categories: 0, references_count: 0 },
      { name: 'Strict Filtering', comment: 'Blocks adult content, enforces YouTube Restrict', domain_filter: true, safe_search: true, fortiguard_category: false, youtube_restrict: true, log_all_domains: true, enabled: true, blocked_categories: 15, references_count: 0 },
      { name: 'Monitoring Only', comment: 'Logs all DNS queries without blocking', domain_filter: false, safe_search: false, fortiguard_category: false, youtube_restrict: false, log_all_domains: true, enabled: true, blocked_categories: 0, references_count: 0 },
    ]);
  }
}

export async function seedDatabase() {
  try {
    // Always ensure system settings are present (idempotent)
    await ensureSystemSettings();
    await ensureDnsDefaults();

    // Admin user — only create on first run
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@sonaro.local'))
      .limit(1);

    if (existing.length > 0) {
      console.log('[Seed] Admin user already exists, skipping seed.');
      return;
    }

    console.log('[Seed] Creating initial admin user...');
    const [admin] = await db.insert(users).values({
      email: 'admin@sonaro.local',
      full_name: 'Super Admin',
      password_hash: hashPassword('Admin123!'),
    }).returning();

    await db.insert(userRoles).values({ user_id: admin.id, role: 'super_admin' });

    console.log('[Seed] Database seeded successfully.');
    console.log('[Seed] Default login: admin@sonaro.local / Admin123!');
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
  }
}
