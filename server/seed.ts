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
} from '../shared/schema.js';
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
  const zoneCount = await db.select({ c: sql<number>`count(*)` }).from(dnsForwardZones);
  if (Number(zoneCount[0].c) === 0) {
    await db.insert(dnsForwardZones).values([
      { name: '.', type: 'forward', servers: ['8.8.8.8', '8.8.4.4'], enabled: true },
      { name: 'local.lan', type: 'forward', servers: ['127.0.0.1'], enabled: true },
      { name: 'corp.internal', type: 'forward', servers: ['192.168.1.1'], enabled: true },
    ]);
  }

  const recCount = await db.select({ c: sql<number>`count(*)` }).from(dnsLocalRecords);
  if (Number(recCount[0].c) === 0) {
    await db.insert(dnsLocalRecords).values([
      { hostname: 'gateway',   domain: 'local.lan', type: 'A', address: '192.168.1.1',   ttl: 3600, enabled: true },
      { hostname: 'firewall',  domain: 'local.lan', type: 'A', address: '192.168.1.1',   ttl: 3600, enabled: true },
      { hostname: 'nas',       domain: 'local.lan', type: 'A', address: '192.168.1.10',  ttl: 3600, enabled: true },
      { hostname: 'webserver', domain: 'local.lan', type: 'A', address: '192.168.1.100', ttl: 3600, enabled: true },
    ]);
  }

  const fpCount = await db.select({ c: sql<number>`count(*)` }).from(dnsFilterProfiles);
  if (Number(fpCount[0].c) === 0) {
    await db.insert(dnsFilterProfiles).values([
      { name: 'Default Security', comment: 'Default security profile with safe search', domain_filter: true, safe_search: true, fortiguard_category: false, youtube_restrict: false, log_all_domains: true, enabled: true, blocked_categories: 0, references_count: 0 },
      { name: 'Strict Filtering', comment: 'Blocks adult content, enforces YouTube Restrict', domain_filter: true, safe_search: true, fortiguard_category: false, youtube_restrict: true, log_all_domains: true, enabled: true, blocked_categories: 15, references_count: 0 },
      { name: 'Monitoring Only', comment: 'Logs all DNS queries without blocking', domain_filter: false, safe_search: false, fortiguard_category: false, youtube_restrict: false, log_all_domains: true, enabled: true, blocked_categories: 0, references_count: 0 },
    ]);
  }
}

async function ensureServices() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(services);
  if (Number(count[0].c) > 0) return;
  await db.insert(services).values([
    { name: 'HTTP',        category: 'Web Access',       protocol: 'TCP',     dest_ports: '80',          source_ports: '1-65535', comment: 'Hypertext Transfer Protocol', references_count: 0, is_system: true },
    { name: 'HTTPS',       category: 'Web Access',       protocol: 'TCP',     dest_ports: '443',         source_ports: '1-65535', comment: 'HTTP Secure',                references_count: 0, is_system: true },
    { name: 'HTTP_HTTPS',  category: 'Web Access',       protocol: 'TCP',     dest_ports: '80,443',      source_ports: '1-65535', comment: 'HTTP and HTTPS combined',     references_count: 0, is_system: true },
    { name: 'SSH',         category: 'Remote Access',    protocol: 'TCP',     dest_ports: '22',          source_ports: '1-65535', comment: 'Secure Shell',                references_count: 0, is_system: true },
    { name: 'TELNET',      category: 'Remote Access',    protocol: 'TCP',     dest_ports: '23',          source_ports: '1-65535', comment: 'Telnet Protocol',             references_count: 0, is_system: true },
    { name: 'RDP',         category: 'Remote Access',    protocol: 'TCP',     dest_ports: '3389',        source_ports: '1-65535', comment: 'Remote Desktop Protocol',     references_count: 0, is_system: true },
    { name: 'VNC',         category: 'Remote Access',    protocol: 'TCP',     dest_ports: '5900-5910',   source_ports: '1-65535', comment: 'Virtual Network Computing',   references_count: 0, is_system: true },
    { name: 'FTP',         category: 'File Access',      protocol: 'TCP',     dest_ports: '21',          source_ports: '1-65535', comment: 'File Transfer Protocol',      references_count: 0, is_system: true },
    { name: 'FTP-DATA',    category: 'File Access',      protocol: 'TCP',     dest_ports: '20',          source_ports: '1-65535', comment: 'FTP Data Transfer',           references_count: 0, is_system: true },
    { name: 'SFTP',        category: 'File Access',      protocol: 'TCP',     dest_ports: '22',          source_ports: '1-65535', comment: 'SSH File Transfer Protocol',  references_count: 0, is_system: true },
    { name: 'SMB',         category: 'File Access',      protocol: 'TCP',     dest_ports: '445',         source_ports: '1-65535', comment: 'Server Message Block',        references_count: 0, is_system: true },
    { name: 'DNS',         category: 'Network Services', protocol: 'TCP/UDP', dest_ports: '53',          source_ports: '1-65535', comment: 'Domain Name System',          references_count: 0, is_system: true },
    { name: 'DHCP',        category: 'Network Services', protocol: 'UDP',     dest_ports: '67-68',       source_ports: '1-65535', comment: 'Dynamic Host Config Protocol',references_count: 0, is_system: true },
    { name: 'NTP',         category: 'Network Services', protocol: 'UDP',     dest_ports: '123',         source_ports: '1-65535', comment: 'Network Time Protocol',       references_count: 0, is_system: true },
    { name: 'SNMP',        category: 'Network Services', protocol: 'UDP',     dest_ports: '161',         source_ports: '1-65535', comment: 'Simple Network Mgmt Protocol',references_count: 0, is_system: true },
    { name: 'PING',        category: 'Network Services', protocol: 'ICMP',    dest_ports: '-',           source_ports: '-',       comment: 'ICMP Echo Request',           references_count: 0, is_system: true },
    { name: 'SMTP',        category: 'Email',            protocol: 'TCP',     dest_ports: '25',          source_ports: '1-65535', comment: 'Simple Mail Transfer Protocol',references_count: 0, is_system: true },
    { name: 'SMTP-TLS',    category: 'Email',            protocol: 'TCP',     dest_ports: '587',         source_ports: '1-65535', comment: 'SMTP with TLS (Submission)',   references_count: 0, is_system: true },
    { name: 'IMAP',        category: 'Email',            protocol: 'TCP',     dest_ports: '143,993',     source_ports: '1-65535', comment: 'Internet Message Access Protocol', references_count: 0, is_system: true },
    { name: 'POP3',        category: 'Email',            protocol: 'TCP',     dest_ports: '110,995',     source_ports: '1-65535', comment: 'Post Office Protocol',        references_count: 0, is_system: true },
    { name: 'LDAP',        category: 'Directory',        protocol: 'TCP',     dest_ports: '389',         source_ports: '1-65535', comment: 'Lightweight Directory Access Protocol', references_count: 0, is_system: true },
    { name: 'LDAPS',       category: 'Directory',        protocol: 'TCP',     dest_ports: '636',         source_ports: '1-65535', comment: 'LDAP over SSL',               references_count: 0, is_system: true },
    { name: 'RADIUS',      category: 'Authentication',   protocol: 'UDP',     dest_ports: '1812-1813',   source_ports: '1-65535', comment: 'Remote Authentication',       references_count: 0, is_system: true },
    { name: 'MYSQL',       category: 'Database',         protocol: 'TCP',     dest_ports: '3306',        source_ports: '1-65535', comment: 'MySQL Database',              references_count: 0, is_system: true },
    { name: 'MSSQL',       category: 'Database',         protocol: 'TCP',     dest_ports: '1433',        source_ports: '1-65535', comment: 'Microsoft SQL Server',        references_count: 0, is_system: true },
    { name: 'POSTGRESQL',  category: 'Database',         protocol: 'TCP',     dest_ports: '5432',        source_ports: '1-65535', comment: 'PostgreSQL Database',         references_count: 0, is_system: true },
    { name: 'REDIS',       category: 'Database',         protocol: 'TCP',     dest_ports: '6379',        source_ports: '1-65535', comment: 'Redis Cache',                 references_count: 0, is_system: true },
    { name: 'VoIP-SIP',    category: 'VoIP',             protocol: 'UDP',     dest_ports: '5060-5061',   source_ports: '1-65535', comment: 'SIP Signaling',               references_count: 0, is_system: false },
    { name: 'VoIP-RTP',    category: 'VoIP',             protocol: 'UDP',     dest_ports: '10000-20000', source_ports: '1-65535', comment: 'RTP Media Streams',           references_count: 0, is_system: false },
    { name: 'ALL',         category: 'General',          protocol: 'TCP/UDP', dest_ports: '1-65535',     source_ports: '1-65535', comment: 'All TCP/UDP ports',           references_count: 0, is_system: true },
  ]);
}

async function ensureSchedules() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(schedules);
  if (Number(count[0].c) > 0) return;
  await db.insert(schedules).values([
    { name: 'always',             description: 'Active at all times', enabled: true, days: [0,1,2,3,4,5,6], start_time: '00:00', end_time: '23:59', usage_count: 0 },
    { name: 'business_hours',     description: 'Standard business hours Mon-Fri', enabled: true, days: [1,2,3,4,5], start_time: '08:00', end_time: '18:00', usage_count: 0 },
    { name: 'after_hours',        description: 'After business hours Mon-Fri',    enabled: true, days: [1,2,3,4,5], start_time: '18:00', end_time: '08:00', usage_count: 0 },
    { name: 'weekends',           description: 'All day Saturday and Sunday',     enabled: true, days: [0,6],       start_time: '00:00', end_time: '23:59', usage_count: 0 },
    { name: 'maintenance_window', description: 'Sunday 2am-6am maintenance',     enabled: true, days: [0],         start_time: '02:00', end_time: '06:00', usage_count: 0 },
    { name: 'lunch_break',        description: 'Lunch break restriction Mon-Fri', enabled: true, days: [1,2,3,4,5], start_time: '12:00', end_time: '13:00', usage_count: 0 },
    { name: 'night_shift',        description: 'Night shift access Mon-Fri',      enabled: false, days: [1,2,3,4,5], start_time: '22:00', end_time: '06:00', usage_count: 0 },
  ]);
}

async function ensureTrafficShapers() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(trafficShapers);
  if (Number(count[0].c) > 0) return;
  await db.insert(trafficShapers).values([
    { name: 'High-Priority',    type: 'shared',  guaranteed_bandwidth: 2000,  maximum_bandwidth: 10000, burst_bandwidth: 12000, priority: 'high',   per_policy: true,  diffserv_forward: true,  enabled: true, current_usage: 450  },
    { name: 'Standard-WAN',     type: 'shared',  guaranteed_bandwidth: 1000,  maximum_bandwidth: 5000,  burst_bandwidth: 6000,  priority: 'medium', per_policy: true,  diffserv_forward: false, enabled: true, current_usage: 1200 },
    { name: 'Low-Priority',     type: 'shared',  guaranteed_bandwidth: 100,   maximum_bandwidth: 1000,  burst_bandwidth: 1200,  priority: 'low',    per_policy: false, diffserv_forward: false, enabled: true, current_usage: 80   },
    { name: 'Per-User-10Mbps',  type: 'per-ip',  guaranteed_bandwidth: 500,   maximum_bandwidth: 10000, burst_bandwidth: 12000, priority: 'medium', per_policy: true,  diffserv_forward: false, enabled: true, current_usage: 0    },
    { name: 'VoIP-Priority',    type: 'shared',  guaranteed_bandwidth: 500,   maximum_bandwidth: 2000,  burst_bandwidth: 2500,  priority: 'high',   per_policy: true,  diffserv_forward: true,  enabled: true, current_usage: 120  },
    { name: 'Bulk-Download',    type: 'per-ip',  guaranteed_bandwidth: 100,   maximum_bandwidth: 2000,  burst_bandwidth: 2500,  priority: 'low',    per_policy: false, diffserv_forward: false, enabled: false, current_usage: 0   },
  ]);
}

async function ensureTrafficShapingPolicies() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(trafficShapingPolicies);
  if (Number(count[0].c) > 0) return;
  await db.insert(trafficShapingPolicies).values([
    { name: 'VoIP-Priority-Policy', src_interface: 'LAN (port1)',  dst_interface: 'WAN1 (wan1)', source: 'all', destination: 'all', service: 'VoIP-SIP', application: 'VoIP',    traffic_shaper: 'VoIP-Priority',   reverse_shaper: 'VoIP-Priority', per_ip_shaper: '',              enabled: true,  matches: 1250,  bytes: 52428800  },
    { name: 'Web-Standard',         src_interface: 'LAN (port1)',  dst_interface: 'WAN1 (wan1)', source: 'all', destination: 'all', service: 'HTTP_HTTPS', application: 'Web',   traffic_shaper: 'Standard-WAN',    reverse_shaper: 'Standard-WAN',  per_ip_shaper: '',              enabled: true,  matches: 45820, bytes: 2147483648 },
    { name: 'P2P-Throttle',         src_interface: 'LAN (port1)',  dst_interface: 'WAN1 (wan1)', source: 'all', destination: 'all', service: 'ALL',       application: 'P2P',   traffic_shaper: 'Low-Priority',    reverse_shaper: 'Low-Priority',  per_ip_shaper: 'Per-User-10Mbps', enabled: true, matches: 820,   bytes: 104857600 },
    { name: 'Bulk-Traffic-Limit',   src_interface: 'LAN (port1)',  dst_interface: 'WAN1 (wan1)', source: 'all', destination: 'all', service: 'ALL',       application: '',      traffic_shaper: 'Bulk-Download',   reverse_shaper: '',              per_ip_shaper: 'Per-User-10Mbps', enabled: false, matches: 0,    bytes: 0         },
  ]);
}

async function ensureVirtualIPs() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(virtualIps);
  if (Number(count[0].c) > 0) return;
  await db.insert(virtualIps).values([
    { name: 'WebServer-VIP',    comments: 'Main web server HTTPS',       type: 'static-nat',   external_ip: '203.0.113.10', mapped_ip: '192.168.1.100', interface: 'wan1', protocol: 'TCP', external_port: '443',         mapped_port: '443',         enabled: true,  sessions: 1247 },
    { name: 'MailServer-VIP',   comments: 'Email server SMTP/IMAP',      type: 'static-nat',   external_ip: '203.0.113.11', mapped_ip: '192.168.1.101', interface: 'wan1', protocol: 'TCP', external_port: '25,143,993',  mapped_port: '25,143,993',  enabled: true,  sessions: 89   },
    { name: 'FTP-VIP',          comments: 'FTP server access',           type: 'static-nat',   external_ip: '203.0.113.12', mapped_ip: '192.168.1.102', interface: 'wan1', protocol: 'TCP', external_port: '21',          mapped_port: '21',          enabled: false, sessions: 0    },
    { name: 'LoadBalancer-VIP', comments: 'Load balanced web farm',      type: 'load-balance', external_ip: '203.0.113.20', mapped_ip: '192.168.1.110', interface: 'wan1', protocol: 'TCP', external_port: '80,443',      mapped_port: '80,443',      enabled: true,  sessions: 3521 },
  ]);
}

async function ensureIPPools() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(ipPools);
  if (Number(count[0].c) > 0) return;
  await db.insert(ipPools).values([
    { name: 'WAN-Pool-Main',    comments: 'Primary WAN IP pool for outbound NAT',     type: 'overload',          start_ip: '203.0.113.100', end_ip: '203.0.113.110', associated_interface: 'wan1', arp_reply: true,  enabled: true,  used_ips: 8,  total_ips: 11 },
    { name: 'WAN-1to1-Pool',    comments: 'One-to-one NAT pool for servers',          type: 'one-to-one',        start_ip: '203.0.113.120', end_ip: '203.0.113.125', associated_interface: 'wan1', arp_reply: true,  enabled: true,  used_ips: 4,  total_ips: 6  },
    { name: 'Port-Range-Pool',  comments: 'Fixed port range for remote offices',      type: 'fixed-port-range',  start_ip: '203.0.113.130', end_ip: '203.0.113.135', associated_interface: 'wan1', arp_reply: false, enabled: true,  used_ips: 2,  total_ips: 6  },
    { name: 'Backup-Pool',      comments: 'Backup pool for failover',                 type: 'overload',          start_ip: '203.0.113.200', end_ip: '203.0.113.210', associated_interface: 'wan2', arp_reply: true,  enabled: false, used_ips: 0,  total_ips: 11 },
  ]);
}

async function ensureWildcardFQDNs() {
  const count = await db.select({ c: sql<number>`count(*)` }).from(wildcardFqdns);
  if (Number(count[0].c) > 0) return;
  await db.insert(wildcardFqdns).values([
    { name: 'google-services',  fqdn: '*.google.com',      interface: 'any',  comment: 'All Google services',       visibility: true, references_count: 0 },
    { name: 'microsoft-cloud',  fqdn: '*.microsoft.com',   interface: 'any',  comment: 'Microsoft cloud services',  visibility: true, references_count: 0 },
    { name: 'facebook-cdn',     fqdn: '*.facebook.com',    interface: 'any',  comment: 'Facebook CDN',              visibility: true, references_count: 0 },
    { name: 'cloudflare-cdn',   fqdn: '*.cloudflare.com',  interface: 'any',  comment: 'Cloudflare CDN',            visibility: true, references_count: 0 },
    { name: 'aws-s3',           fqdn: '*.s3.amazonaws.com',interface: 'wan1', comment: 'AWS S3 buckets',            visibility: true, references_count: 0 },
  ]);
}

export async function seedDatabase() {
  try {
    await ensureSystemSettings();
    await ensureDnsDefaults();
    await ensureServices();
    await ensureSchedules();
    await ensureTrafficShapers();
    await ensureTrafficShapingPolicies();
    await ensureVirtualIPs();
    await ensureIPPools();
    await ensureWildcardFQDNs();

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@sonaro.local'))
      .limit(1);

    if (existing.length > 0) {
      console.log('[Seed] Admin user already exists, skipping user seed.');
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
  } catch (err: any) {
    console.error('[Seed] Error during seeding:', err);
  }
}
