/**
 * Seeds the database with initial admin user and system defaults.
 * Safe to run multiple times (checks for existing data).
 */
import { db } from './db.js';
import {
  users, userRoles, systemSettings,
  dnsForwardZones, dnsLocalRecords, dnsFilterProfiles,
  services, schedules, trafficShapers, trafficShapingPolicies,
  virtualIps, ipPools, wildcardFqdns,
  vpnTunnels, idsSignatures,
} from '../shared/schema.js';
import { hashPassword } from './auth.js';
import { eq, sql } from 'drizzle-orm';
import { spawnSync } from 'child_process';

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
  { key: 'local_users', value: '[]', description: 'Firewall local user accounts (JSON)' },
  { key: 'user_groups', value: '[]', description: 'Firewall user groups (JSON)' },
  { key: 'auth_servers', value: '[]', description: 'External authentication servers (JSON)' },
  // Feature status — initial seed values; overwritten on every boot by detectAndUpdateFeatureStatus()
  { key: 'feature_core_status',      value: 'Valid',         description: 'Core application status' },
  { key: 'feature_ids_status',       value: 'Not Installed', description: 'IDS/IPS (Suricata) status' },
  { key: 'feature_webfilter_status', value: 'Not Installed', description: 'Web Filtering (dnsmasq) status' },
  { key: 'feature_vpn_status',       value: 'Not Installed', description: 'VPN (WireGuard / OpenVPN) status' },
  { key: 'bgp_config', value: JSON.stringify({ enabled: false, localAS: 65001, routerId: '', keepalive: 60, holdTime: 180, neighbors: [] }), description: 'BGP routing protocol configuration (JSON)' },
  { key: 'ospf_config', value: JSON.stringify({ enabled: false, routerId: '', abrType: 'Cisco', defaultMetric: 10, refBandwidth: 100, areas: [], interfaces: [] }), description: 'OSPF routing protocol configuration (JSON)' },
  { key: 'rip_config', value: JSON.stringify({ enabled: false, version: '2', defaultMetric: 1, updateTimer: 30, networks: [], interfaces: [] }), description: 'RIP routing protocol configuration (JSON)' },
];

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

// ─────────────────────────────────────────────────────────────────
// Feature Registry — extensible per-feature status detection
//
// Each entry in FEATURE_REGISTRY describes one dashboard feature:
//   key     : DB key in system_settings (single source of truth)
//   label   : short name used in log output
//   detect  : function called at boot to determine current status
//
// Possible status strings (displayed in the UI):
//   "Valid"              — installed and running / always available
//   "Installed"          — binary present but service not running
//   "Not Installed"      — binary / service not found on this host
//   "Licensed"           — (future) commercially licensed edition
//   "Trial"              — (future) time-limited evaluation key
//   "Expired"            — (future) license key has expired
//
// HOW TO ADD A NEW FEATURE:
//   1. Add an entry to FEATURE_REGISTRY with a unique key + detect().
//   2. Add the same key to SYSTEM_DEFAULTS below (initial seed value).
//   3. Add the key + display metadata to FEATURE_CATALOG in Index.tsx.
//   Done — the rest of the pipeline (upsert, dashboard render) is automatic.
// ─────────────────────────────────────────────────────────────────

type FeatureStatus =
  | 'Valid'
  | 'Installed'
  | 'Not Installed'
  | 'Licensed'
  | 'Trial'
  | 'Expired';

interface FeatureDefinition {
  key:    string;
  label:  string;
  detect: () => FeatureStatus;
}

function binaryExists(cmd: string): boolean {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function serviceActive(name: string): boolean {
  const r = spawnSync('systemctl', ['is-active', '--quiet', name], { encoding: 'utf8' });
  return r.status === 0;
}

const FEATURE_REGISTRY: FeatureDefinition[] = [
  // ── Core application — always valid (open-source, no key required)
  {
    key:    'feature_core_status',
    label:  'Core',
    detect: () => 'Valid',
  },

  // ── IDS & IPS — Suricata
  {
    key:   'feature_ids_status',
    label: 'IDS/IPS',
    detect: () => {
      const installed = binaryExists('suricata');
      if (!installed) return 'Not Installed';
      return serviceActive('suricata') ? 'Valid' : 'Installed';
    },
  },

  // ── Web Filtering — dnsmasq
  {
    key:   'feature_webfilter_status',
    label: 'Web Filter',
    detect: () => {
      const installed = binaryExists('dnsmasq');
      if (!installed) return 'Not Installed';
      return serviceActive('dnsmasq') ? 'Valid' : 'Installed';
    },
  },

  // ── VPN — WireGuard and/or OpenVPN
  {
    key:   'feature_vpn_status',
    label: 'VPN',
    detect: () => {
      const hasWg   = binaryExists('wg') || binaryExists('wg-quick');
      const hasOvpn = binaryExists('openvpn');
      if (!hasWg && !hasOvpn) return 'Not Installed';
      // At least one engine is installed — check if any VPN tunnel is active
      const wgActive   = hasWg   && (serviceActive('wg-quick@wg0') || serviceActive('wg-quick'));
      const ovpnActive = hasOvpn && (serviceActive('openvpn@server') || serviceActive('openvpn'));
      return (wgActive || ovpnActive) ? 'Valid' : 'Installed';
    },
  },

  // ── Add new features here following the same pattern.
  // ── Example for a future paid "Threat Intelligence" subscription:
  // {
  //   key:   'feature_threat_intel_status',
  //   label: 'Threat Intel',
  //   detect: () => {
  //     const licenseKey = process.env.THREAT_INTEL_LICENSE_KEY;
  //     if (!licenseKey) return 'Not Installed';
  //     // validate key against license server...
  //     return 'Licensed';
  //   },
  // },
];

/**
 * Run every feature's detect() function and upsert the results into
 * system_settings.  Called on every boot so the Dashboard always shows
 * the live state of the appliance without manual intervention.
 */
async function detectAndUpdateFeatureStatus(): Promise<void> {
  for (const feature of FEATURE_REGISTRY) {
    const status = feature.detect();
    await db
      .insert(systemSettings)
      .values({ key: feature.key, value: status, description: feature.label })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: status } });
  }

  const summary = FEATURE_REGISTRY
    .map(f => `${f.label}=${f.detect()}`)
    .join(', ');
  console.log(`[Seed] Feature status: ${summary}`);
}

async function ensureDnsDefaults() {
  const zoneCount = await db.select({ c: sql<number>`count(*)` }).from(dnsForwardZones);
  if (Number(zoneCount[0].c) === 0) {
    await db.insert(dnsForwardZones).values([
      { name: '.', type: 'forward', servers: ['8.8.8.8', '8.8.4.4'], enabled: true },
      { name: 'local.lan', type: 'forward', servers: ['127.0.0.1'], enabled: true },
    ]);
  }

  const fpCount = await db.select({ c: sql<number>`count(*)` }).from(dnsFilterProfiles);
  if (Number(fpCount[0].c) === 0) {
    await db.insert(dnsFilterProfiles).values([
      { name: 'Default Security', comment: 'Default security profile with safe search', domain_filter: true, safe_search: true, fortiguard_category: false, youtube_restrict: false, log_all_domains: true, enabled: true, blocked_categories: 0, references_count: 0 },
    ]);
  }
}

async function ensureServices() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(services);
  if (Number(count[0].c) > 0) return;
  await db.insert(services).values([
    { name: 'HTTP',        category: 'Web Access',       protocol: 'TCP',     dest_ports: '80',          source_ports: '1-65535', comment: 'Hypertext Transfer Protocol',           references_count: 0, is_system: true },
    { name: 'HTTPS',       category: 'Web Access',       protocol: 'TCP',     dest_ports: '443',         source_ports: '1-65535', comment: 'HTTP Secure',                           references_count: 0, is_system: true },
    { name: 'HTTP_HTTPS',  category: 'Web Access',       protocol: 'TCP',     dest_ports: '80,443',      source_ports: '1-65535', comment: 'HTTP and HTTPS combined',               references_count: 0, is_system: true },
    { name: 'SSH',         category: 'Remote Access',    protocol: 'TCP',     dest_ports: '22',          source_ports: '1-65535', comment: 'Secure Shell',                          references_count: 0, is_system: true },
    { name: 'TELNET',      category: 'Remote Access',    protocol: 'TCP',     dest_ports: '23',          source_ports: '1-65535', comment: 'Telnet Protocol',                       references_count: 0, is_system: true },
    { name: 'RDP',         category: 'Remote Access',    protocol: 'TCP',     dest_ports: '3389',        source_ports: '1-65535', comment: 'Remote Desktop Protocol',               references_count: 0, is_system: true },
    { name: 'VNC',         category: 'Remote Access',    protocol: 'TCP',     dest_ports: '5900-5910',   source_ports: '1-65535', comment: 'Virtual Network Computing',             references_count: 0, is_system: true },
    { name: 'FTP',         category: 'File Access',      protocol: 'TCP',     dest_ports: '21',          source_ports: '1-65535', comment: 'File Transfer Protocol',                references_count: 0, is_system: true },
    { name: 'FTP-DATA',    category: 'File Access',      protocol: 'TCP',     dest_ports: '20',          source_ports: '1-65535', comment: 'FTP Data Transfer',                     references_count: 0, is_system: true },
    { name: 'SFTP',        category: 'File Access',      protocol: 'TCP',     dest_ports: '22',          source_ports: '1-65535', comment: 'SSH File Transfer Protocol',            references_count: 0, is_system: true },
    { name: 'SMB',         category: 'File Access',      protocol: 'TCP',     dest_ports: '445',         source_ports: '1-65535', comment: 'Server Message Block',                  references_count: 0, is_system: true },
    { name: 'DNS',         category: 'Network Services', protocol: 'TCP/UDP', dest_ports: '53',          source_ports: '1-65535', comment: 'Domain Name System',                    references_count: 0, is_system: true },
    { name: 'DHCP',        category: 'Network Services', protocol: 'UDP',     dest_ports: '67-68',       source_ports: '1-65535', comment: 'Dynamic Host Config Protocol',          references_count: 0, is_system: true },
    { name: 'NTP',         category: 'Network Services', protocol: 'UDP',     dest_ports: '123',         source_ports: '1-65535', comment: 'Network Time Protocol',                 references_count: 0, is_system: true },
    { name: 'SNMP',        category: 'Network Services', protocol: 'UDP',     dest_ports: '161',         source_ports: '1-65535', comment: 'Simple Network Mgmt Protocol',          references_count: 0, is_system: true },
    { name: 'PING',        category: 'Network Services', protocol: 'ICMP',    dest_ports: '-',           source_ports: '-',       comment: 'ICMP Echo Request',                     references_count: 0, is_system: true },
    { name: 'SMTP',        category: 'Email',            protocol: 'TCP',     dest_ports: '25',          source_ports: '1-65535', comment: 'Simple Mail Transfer Protocol',         references_count: 0, is_system: true },
    { name: 'SMTP-TLS',    category: 'Email',            protocol: 'TCP',     dest_ports: '587',         source_ports: '1-65535', comment: 'SMTP with TLS (Submission)',             references_count: 0, is_system: true },
    { name: 'IMAP',        category: 'Email',            protocol: 'TCP',     dest_ports: '143,993',     source_ports: '1-65535', comment: 'Internet Message Access Protocol',      references_count: 0, is_system: true },
    { name: 'POP3',        category: 'Email',            protocol: 'TCP',     dest_ports: '110,995',     source_ports: '1-65535', comment: 'Post Office Protocol',                  references_count: 0, is_system: true },
    { name: 'LDAP',        category: 'Directory',        protocol: 'TCP',     dest_ports: '389',         source_ports: '1-65535', comment: 'Lightweight Directory Access Protocol', references_count: 0, is_system: true },
    { name: 'LDAPS',       category: 'Directory',        protocol: 'TCP',     dest_ports: '636',         source_ports: '1-65535', comment: 'LDAP over SSL',                         references_count: 0, is_system: true },
    { name: 'RADIUS',      category: 'Authentication',   protocol: 'UDP',     dest_ports: '1812-1813',   source_ports: '1-65535', comment: 'Remote Authentication',                 references_count: 0, is_system: true },
    { name: 'MYSQL',       category: 'Database',         protocol: 'TCP',     dest_ports: '3306',        source_ports: '1-65535', comment: 'MySQL Database',                        references_count: 0, is_system: true },
    { name: 'MSSQL',       category: 'Database',         protocol: 'TCP',     dest_ports: '1433',        source_ports: '1-65535', comment: 'Microsoft SQL Server',                  references_count: 0, is_system: true },
    { name: 'POSTGRESQL',  category: 'Database',         protocol: 'TCP',     dest_ports: '5432',        source_ports: '1-65535', comment: 'PostgreSQL Database',                   references_count: 0, is_system: true },
    { name: 'REDIS',       category: 'Database',         protocol: 'TCP',     dest_ports: '6379',        source_ports: '1-65535', comment: 'Redis Cache',                           references_count: 0, is_system: true },
    { name: 'ALL',         category: 'General',          protocol: 'TCP/UDP', dest_ports: '1-65535',     source_ports: '1-65535', comment: 'All TCP/UDP ports',                     references_count: 0, is_system: true },
  ]);
}

async function ensureSchedules() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(schedules);
  if (Number(count[0].c) > 0) return;
  await db.insert(schedules).values([
    { name: 'always', description: 'Active at all times (24/7)', enabled: true, days: [0,1,2,3,4,5,6], start_time: '00:00', end_time: '23:59', usage_count: 0 },
  ]);
}

async function ensureIDSSignatures() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(idsSignatures);
  if (Number(count[0].c) > 0) return;
  await db.insert(idsSignatures).values([
    { sid: 1000001, name: 'ET SCAN Nmap Scan',                     category: 'scan',        severity: 'medium',   action: 'alert', enabled: true,  hits: 0, description: 'Detects Nmap network scanning activity',                    cve: null },
    { sid: 1000002, name: 'ET EXPLOIT EternalBlue SMB RCE',        category: 'exploit',     severity: 'critical', action: 'drop',  enabled: true,  hits: 0, description: 'MS17-010 SMBv1 remote code execution (EternalBlue)',        cve: 'CVE-2017-0144' },
    { sid: 1000003, name: 'ET MALWARE Emotet CnC Beacon',          category: 'malware',     severity: 'critical', action: 'drop',  enabled: true,  hits: 0, description: 'Detects Emotet trojan command-and-control communication',   cve: null },
    { sid: 1000004, name: 'ET WEB_SERVER SQL Injection Attempt',   category: 'web_attack',  severity: 'high',     action: 'alert', enabled: true,  hits: 0, description: 'Generic SQL injection pattern in HTTP request',             cve: null },
    { sid: 1000005, name: 'ET DOS UDP Flood',                      category: 'dos',         severity: 'high',     action: 'drop',  enabled: true,  hits: 0, description: 'High-rate UDP flood consistent with DDoS',                  cve: null },
    { sid: 1000006, name: 'ET POLICY Cleartext Password over HTTP', category: 'policy',     severity: 'medium',   action: 'alert', enabled: true,  hits: 0, description: 'Password transmitted in cleartext via HTTP Basic Auth',     cve: null },
    { sid: 1000007, name: 'ET TROJAN Cobalt Strike Beacon',        category: 'malware',     severity: 'critical', action: 'drop',  enabled: true,  hits: 0, description: 'Cobalt Strike C2 beacon detected in network traffic',       cve: null },
    { sid: 1000008, name: 'ET SCAN SSH Brute Force Attempt',       category: 'scan',        severity: 'medium',   action: 'alert', enabled: true,  hits: 0, description: 'Multiple failed SSH login attempts indicating brute force', cve: null },
    { sid: 1000009, name: 'ET WEB_CLIENT IE Use-After-Free',       category: 'exploit',     severity: 'high',     action: 'alert', enabled: false, hits: 0, description: 'Internet Explorer use-after-free vulnerability exploit',    cve: 'CVE-2020-1380' },
    { sid: 1000010, name: 'ET POLICY TOR Exit Node Traffic',       category: 'policy',      severity: 'low',      action: 'alert', enabled: true,  hits: 0, description: 'Traffic destined for known TOR exit nodes',                 cve: null },
    { sid: 1000011, name: 'ET MALWARE Mirai Botnet HTTP Request',  category: 'malware',     severity: 'high',     action: 'drop',  enabled: true,  hits: 0, description: 'Mirai IoT botnet HTTP C2 communication pattern',            cve: null },
    { sid: 1000012, name: 'ET EXPLOIT Log4Shell RCE Attempt',      category: 'exploit',     severity: 'critical', action: 'drop',  enabled: true,  hits: 0, description: 'Log4j2 JNDI injection remote code execution attempt',       cve: 'CVE-2021-44228' },
    { sid: 1000013, name: 'ET SCAN Port Scan SYN Sweep',           category: 'scan',        severity: 'low',      action: 'alert', enabled: true,  hits: 0, description: 'TCP SYN scan sweeping multiple destination ports',          cve: null },
    { sid: 1000014, name: 'ET WEB_SERVER XSS Attempt Generic',     category: 'web_attack',  severity: 'medium',   action: 'alert', enabled: true,  hits: 0, description: 'Cross-site scripting attempt in HTTP parameter',            cve: null },
    { sid: 1000015, name: 'ET POLICY DNS-over-HTTPS Bypass',       category: 'policy',      severity: 'low',      action: 'alert', enabled: false, hits: 0, description: 'DoH traffic that may bypass DNS filtering controls',        cve: null },
  ]);
}

// Stale email addresses from previous project iterations that must be cleaned up
const STALE_EMAILS = ['admin@aegis.local', 'admin@wallix.local'];

async function cleanupStaleUsers() {
  for (const email of STALE_EMAILS) {
    const [stale] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (stale) {
      await db.delete(userRoles).where(eq(userRoles.user_id, stale.id));
      await db.delete(users).where(eq(users.id, stale.id));
      console.log(`[Seed] Removed stale account: ${email}`);
    }
  }
}

export async function seedDatabase() {
  try {
    await ensureSystemSettings();
    // Detect real service availability and write accurate feature status to DB.
    // Runs on every boot so installs/removals are reflected automatically.
    await detectAndUpdateFeatureStatus();
    await ensureDnsDefaults();
    await ensureServices();
    await ensureSchedules();
    await ensureIDSSignatures();
    await cleanupStaleUsers();

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@sonaro.local'))
      .limit(1);

    if (existing.length > 0) {
      console.log('[Seed] Default admin account exists — skipping user seed.');
      return;
    }

    // Role choice: super_admin (not admin).
    // Reason: this is the bootstrap account created on a fresh install when no
    // other users exist. It must have super_admin so it can create additional
    // admin/operator/auditor accounts via the UI.  Once initial setup is done,
    // operators should log in with least-privilege accounts (admin/operator).
    // The super_admin account is analogous to FortiGate's built-in "admin" —
    // always full-access, used for emergency recovery and user management.
    console.log('[Seed] Creating initial super-admin account...');
    const [admin] = await db.insert(users).values({
      email: 'admin@sonaro.local',
      full_name: 'System Administrator',
      password_hash: hashPassword('Admin123!'),
    }).returning();

    await db.insert(userRoles).values({ user_id: admin.id, role: 'super_admin' });

    console.log('[Seed] Database seeded successfully.');
    console.log('[Seed] Default login: admin@sonaro.local / Admin123!');
    console.log('[Seed] Role: super_admin (full access — change after first login)');
  } catch (err: any) {
    console.error('[Seed] Error during seeding:', err);
  }
}
