import { pgTable, text, boolean, integer, bigint, decimal, timestamp, uuid, serial } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

const now = () => sql`now()`;
const genUuid = () => sql`gen_random_uuid()`;

// ── Users ──────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(genUuid()),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull().default(''),
  password_hash: text('password_hash').notNull(),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().default(genUuid()),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
});

// ── Firewall Rules ──────────────────────────────────
export const firewallRules = pgTable('firewall_rules', {
  id: uuid('id').primaryKey().default(genUuid()),
  rule_order: integer('rule_order').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  action: text('action').notNull().default('block'),
  interface: text('interface').notNull().default('WAN'),
  direction: text('direction').notNull().default('in'),
  protocol: text('protocol').notNull().default('any'),
  source_type: text('source_type').notNull().default('any'),
  source_value: text('source_value').notNull().default('*'),
  source_port: text('source_port'),
  destination_type: text('destination_type').notNull().default('any'),
  destination_value: text('destination_value').notNull().default('*'),
  destination_port: text('destination_port'),
  description: text('description').notNull().default(''),
  logging: boolean('logging').notNull().default(false),
  hits: bigint('hits', { mode: 'number' }).notNull().default(0),
  last_hit: timestamp('last_hit', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  created_by: uuid('created_by'),
});

// ── NAT Rules ──────────────────────────────────────
export const natRules = pgTable('nat_rules', {
  id: uuid('id').primaryKey().default(genUuid()),
  type: text('type').notNull().default('port-forward'),
  enabled: boolean('enabled').notNull().default(true),
  interface: text('interface').notNull().default('WAN'),
  protocol: text('protocol').notNull().default('tcp'),
  external_address: text('external_address'),
  external_port: text('external_port').notNull().default(''),
  internal_address: text('internal_address').notNull().default(''),
  internal_port: text('internal_port').notNull().default(''),
  description: text('description').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
  created_by: uuid('created_by'),
});

// ── Network Interfaces ──────────────────────────────
export const networkInterfaces = pgTable('network_interfaces', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  type: text('type').notNull().default('LAN'),
  status: text('status').notNull().default('up'),
  ip_address: text('ip_address'),
  subnet: text('subnet'),
  gateway: text('gateway'),
  mac: text('mac'),
  speed: text('speed'),
  duplex: text('duplex').default('full'),
  mtu: integer('mtu').default(1500),
  vlan: integer('vlan'),
  rx_bytes: bigint('rx_bytes', { mode: 'number' }).default(0),
  tx_bytes: bigint('tx_bytes', { mode: 'number' }).default(0),
  rx_packets: bigint('rx_packets', { mode: 'number' }).default(0),
  tx_packets: bigint('tx_packets', { mode: 'number' }).default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── VPN Tunnels ────────────────────────────────────
export const vpnTunnels = pgTable('vpn_tunnels', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  type: text('type').notNull().default('ipsec'),
  status: text('status').notNull().default('disconnected'),
  remote_gateway: text('remote_gateway'),
  local_network: text('local_network'),
  remote_network: text('remote_network'),
  bytes_in: bigint('bytes_in', { mode: 'number' }).default(0),
  bytes_out: bigint('bytes_out', { mode: 'number' }).default(0),
  uptime: bigint('uptime', { mode: 'number' }).default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Threat Events ──────────────────────────────────
export const threatEvents = pgTable('threat_events', {
  id: uuid('id').primaryKey().default(genUuid()),
  severity: text('severity').notNull().default('low'),
  category: text('category').notNull().default(''),
  source_ip: text('source_ip'),
  destination_ip: text('destination_ip'),
  source_port: integer('source_port'),
  destination_port: integer('destination_port'),
  protocol: text('protocol'),
  signature: text('signature'),
  description: text('description'),
  action: text('action').notNull().default('blocked'),
  ai_confidence: decimal('ai_confidence', { precision: 5, scale: 2 }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
});

// ── System Settings ────────────────────────────────
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().default(genUuid()),
  key: text('key').notNull().unique(),
  value: text('value').notNull().default(''),
  description: text('description'),
  is_auditable: boolean('is_auditable').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Static Routes ──────────────────────────────────
export const staticRoutes = pgTable('static_routes', {
  id: uuid('id').primaryKey().default(genUuid()),
  destination: text('destination').notNull(),
  gateway: text('gateway').notNull(),
  interface: text('interface').notNull().default('wan1'),
  distance: integer('distance').notNull().default(10),
  priority: integer('priority').notNull().default(0),
  status: text('status').notNull().default('enabled'),
  comment: text('comment').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Policy Routes ──────────────────────────────────
export const policyRoutes = pgTable('policy_routes', {
  id: uuid('id').primaryKey().default(genUuid()),
  seq: integer('seq').notNull().default(1),
  incoming: text('incoming').notNull().default('internal'),
  source: text('source').notNull().default('0.0.0.0/0'),
  destination: text('destination').notNull().default('0.0.0.0/0'),
  protocol: text('protocol').notNull().default('any'),
  gateway: text('gateway').notNull().default(''),
  out_interface: text('out_interface').notNull().default('wan1'),
  status: text('status').notNull().default('enabled'),
  comment: text('comment').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Aliases ────────────────────────────────────────
export const aliases = pgTable('aliases', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  type: text('type').notNull().default('host'),
  values: text('values').array().notNull().default(sql`'{}'`),
  description: text('description').notNull().default(''),
  usage_count: integer('usage_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Services ───────────────────────────────────────
export const services = pgTable('services', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  category: text('category').notNull().default('Custom'),
  protocol: text('protocol').notNull().default('TCP'),
  dest_ports: text('dest_ports').notNull().default(''),
  source_ports: text('source_ports').notNull().default('1-65535'),
  comment: text('comment').notNull().default(''),
  references_count: integer('references_count').notNull().default(0),
  is_system: boolean('is_system').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Schedules ──────────────────────────────────────
export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  days: integer('days').array().notNull().default(sql`'{}'`),
  start_time: text('start_time').notNull().default('00:00'),
  end_time: text('end_time').notNull().default('23:59'),
  usage_count: integer('usage_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Certificates ───────────────────────────────────
export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  type: text('type').notNull().default('local'),
  subject: text('subject').notNull().default(''),
  issuer: text('issuer').notNull().default(''),
  serial_number: text('serial_number').notNull().default(''),
  valid_from: timestamp('valid_from', { withTimezone: true }).notNull().default(now()),
  valid_to: timestamp('valid_to', { withTimezone: true }).notNull().default(sql`now() + interval '1 year'`),
  status: text('status').notNull().default('valid'),
  key_type: text('key_type').notNull().default('RSA'),
  key_size: integer('key_size').notNull().default(2048),
  in_use: boolean('in_use').notNull().default(false),
  used_by: text('used_by').array().notNull().default(sql`'{}'`),
  signature_algorithm: text('signature_algorithm').notNull().default('SHA256withRSA'),
  fingerprint: text('fingerprint').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── IDS/IPS Signatures ─────────────────────────────
export const idsSignatures = pgTable('ids_signatures', {
  id: uuid('id').primaryKey().default(genUuid()),
  sid: integer('sid').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default(''),
  severity: text('severity').notNull().default('medium'),
  action: text('action').notNull().default('alert'),
  enabled: boolean('enabled').notNull().default(true),
  hits: bigint('hits', { mode: 'number' }).notNull().default(0),
  last_hit: timestamp('last_hit', { withTimezone: true }),
  description: text('description').notNull().default(''),
  cve: text('cve'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── DHCP Servers ───────────────────────────────────
export const dhcpServers = pgTable('dhcp_servers', {
  id: uuid('id').primaryKey().default(genUuid()),
  interface: text('interface').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  range_start: text('range_start').notNull().default(''),
  range_end: text('range_end').notNull().default(''),
  gateway: text('gateway').notNull().default(''),
  netmask: text('netmask').notNull().default('255.255.255.0'),
  dns1: text('dns1').notNull().default('8.8.8.8'),
  dns2: text('dns2').notNull().default('8.8.4.4'),
  domain: text('domain').notNull().default(''),
  lease_time: integer('lease_time').notNull().default(86400),
  active_leases: integer('active_leases').notNull().default(0),
  total_pool: integer('total_pool').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── DHCP Static Mappings ───────────────────────────
export const dhcpStaticMappings = pgTable('dhcp_static_mappings', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  mac: text('mac').notNull(),
  ip: text('ip').notNull(),
  interface: text('interface').notNull().default('LAN'),
  enabled: boolean('enabled').notNull().default(true),
  description: text('description').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── DHCP Leases ────────────────────────────────────
export const dhcpLeases = pgTable('dhcp_leases', {
  id: uuid('id').primaryKey().default(genUuid()),
  ip: text('ip').notNull(),
  mac: text('mac').notNull(),
  hostname: text('hostname').notNull().default(''),
  lease_start: timestamp('lease_start', { withTimezone: true }).notNull().default(now()),
  lease_end: timestamp('lease_end', { withTimezone: true }).notNull().default(sql`now() + interval '1 day'`),
  status: text('status').notNull().default('active'),
  interface: text('interface').notNull().default('LAN'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
});

// ── DNS Filter Profiles ────────────────────────────
export const dnsFilterProfiles = pgTable('dns_filter_profiles', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  comment: text('comment').notNull().default(''),
  domain_filter: boolean('domain_filter').notNull().default(true),
  fortiguard_category: boolean('fortiguard_category').notNull().default(true),
  safe_search: boolean('safe_search').notNull().default(true),
  youtube_restrict: boolean('youtube_restrict').notNull().default(false),
  log_all_domains: boolean('log_all_domains').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  blocked_categories: integer('blocked_categories').notNull().default(0),
  references_count: integer('references_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── DNS Forward Zones ──────────────────────────────
export const dnsForwardZones = pgTable('dns_forward_zones', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  type: text('type').notNull().default('forward'),
  servers: text('servers').array().notNull().default(sql`'{}'`),
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── DNS Local Records ──────────────────────────────
export const dnsLocalRecords = pgTable('dns_local_records', {
  id: uuid('id').primaryKey().default(genUuid()),
  hostname: text('hostname').notNull(),
  domain: text('domain').notNull().default(''),
  type: text('type').notNull().default('A'),
  address: text('address').notNull().default(''),
  ttl: integer('ttl').notNull().default(3600),
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── IP Pools ───────────────────────────────────────
export const ipPools = pgTable('ip_pools', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  comments: text('comments').notNull().default(''),
  type: text('type').notNull().default('overload'),
  start_ip: text('start_ip').notNull().default(''),
  end_ip: text('end_ip').notNull().default(''),
  associated_interface: text('associated_interface').notNull().default('wan1'),
  arp_reply: boolean('arp_reply').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  used_ips: integer('used_ips').notNull().default(0),
  total_ips: integer('total_ips').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Virtual IPs ────────────────────────────────────
export const virtualIps = pgTable('virtual_ips', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  comments: text('comments').notNull().default(''),
  type: text('type').notNull().default('static-nat'),
  external_ip: text('external_ip').notNull().default(''),
  mapped_ip: text('mapped_ip').notNull().default(''),
  interface: text('interface').notNull().default('wan1'),
  protocol: text('protocol').notNull().default('TCP'),
  external_port: text('external_port').notNull().default(''),
  mapped_port: text('mapped_port').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  sessions: integer('sessions').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Wildcard FQDNs ─────────────────────────────────
export const wildcardFqdns = pgTable('wildcard_fqdns', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  fqdn: text('fqdn').notNull(),
  interface: text('interface').notNull().default('any'),
  comment: text('comment').notNull().default(''),
  visibility: boolean('visibility').notNull().default(true),
  references_count: integer('references_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Traffic Shapers ────────────────────────────────
export const trafficShapers = pgTable('traffic_shapers', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  type: text('type').notNull().default('shared'),
  guaranteed_bandwidth: integer('guaranteed_bandwidth').notNull().default(0),
  maximum_bandwidth: integer('maximum_bandwidth').notNull().default(0),
  burst_bandwidth: integer('burst_bandwidth').notNull().default(0),
  priority: text('priority').notNull().default('medium'),
  per_policy: boolean('per_policy').notNull().default(true),
  diffserv_forward: boolean('diffserv_forward').notNull().default(false),
  enabled: boolean('enabled').notNull().default(true),
  current_usage: integer('current_usage').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Traffic Shaping Policies ───────────────────────
export const trafficShapingPolicies = pgTable('traffic_shaping_policies', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  src_interface: text('src_interface').notNull().default('lan'),
  dst_interface: text('dst_interface').notNull().default('wan1'),
  source: text('source').notNull().default('all'),
  destination: text('destination').notNull().default('all'),
  service: text('service').notNull().default('ALL'),
  application: text('application').notNull().default(''),
  traffic_shaper: text('traffic_shaper').notNull().default(''),
  reverse_shaper: text('reverse_shaper').notNull().default(''),
  per_ip_shaper: text('per_ip_shaper').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  matches: bigint('matches', { mode: 'number' }).notNull().default(0),
  bytes: bigint('bytes', { mode: 'number' }).notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── SSL Inspection Profiles ────────────────────────
export const sslInspectionProfiles = pgTable('ssl_inspection_profiles', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  comment: text('comment').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  inspection_mode: text('inspection_mode').notNull().default('certificate-inspection'),
  https_enabled: boolean('https_enabled').notNull().default(true),
  smtps_enabled: boolean('smtps_enabled').notNull().default(false),
  pop3s_enabled: boolean('pop3s_enabled').notNull().default(false),
  imaps_enabled: boolean('imaps_enabled').notNull().default(false),
  ftps_enabled: boolean('ftps_enabled').notNull().default(false),
  ca_certificate: text('ca_certificate').notNull().default(''),
  untrusted_cert_action: text('untrusted_cert_action').notNull().default('allow'),
  expired_cert_action: text('expired_cert_action').notNull().default('allow'),
  references_count: integer('references_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── AV Profiles ───────────────────────────────────
export const avProfiles = pgTable('av_profiles', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  comment: text('comment').notNull().default(''),
  http_scan: boolean('http_scan').notNull().default(true),
  ftp_scan: boolean('ftp_scan').notNull().default(true),
  imap_scan: boolean('imap_scan').notNull().default(true),
  pop3_scan: boolean('pop3_scan').notNull().default(true),
  smtp_scan: boolean('smtp_scan').notNull().default(true),
  action: text('action').notNull().default('block'),
  emulator_enabled: boolean('emulator_enabled').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Web Filter Profiles ────────────────────────────
export const webFilterProfiles = pgTable('web_filter_profiles', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  comment: text('comment').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  action: text('action').notNull().default('block'),
  references_count: integer('references_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(now()),
});

// ── Audit Logs ─────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(genUuid()),
  user_id: uuid('user_id'),
  action: text('action').notNull(),
  resource_type: text('resource_type').notNull().default(''),
  resource_id: text('resource_id'),
  details: text('details'),
  ip_address: text('ip_address'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
});

// ── System Metrics ─────────────────────────────────
export const systemMetrics = pgTable('system_metrics', {
  id: uuid('id').primaryKey().default(genUuid()),
  hostname: text('hostname').notNull().default(''),
  uptime: bigint('uptime', { mode: 'number' }).notNull().default(0),
  cpu_usage: decimal('cpu_usage', { precision: 5, scale: 2 }).notNull().default('0'),
  cpu_cores: integer('cpu_cores').notNull().default(1),
  cpu_temperature: decimal('cpu_temperature', { precision: 5, scale: 2 }).notNull().default('0'),
  memory_total: bigint('memory_total', { mode: 'number' }).notNull().default(0),
  memory_used: bigint('memory_used', { mode: 'number' }).notNull().default(0),
  memory_free: bigint('memory_free', { mode: 'number' }).notNull().default(0),
  memory_cached: bigint('memory_cached', { mode: 'number' }).notNull().default(0),
  disk_total: bigint('disk_total', { mode: 'number' }).notNull().default(0),
  disk_used: bigint('disk_used', { mode: 'number' }).notNull().default(0),
  disk_free: bigint('disk_free', { mode: 'number' }).notNull().default(0),
  load_1m: decimal('load_1m', { precision: 6, scale: 2 }).notNull().default('0'),
  load_5m: decimal('load_5m', { precision: 6, scale: 2 }).notNull().default('0'),
  load_15m: decimal('load_15m', { precision: 6, scale: 2 }).notNull().default('0'),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).notNull().default(now()),
});

// ── Traffic Stats ──────────────────────────────────
export const trafficStats = pgTable('traffic_stats', {
  id: uuid('id').primaryKey().default(genUuid()),
  interface: text('interface').notNull().default(''),
  inbound: bigint('inbound', { mode: 'number' }).notNull().default(0),
  outbound: bigint('outbound', { mode: 'number' }).notNull().default(0),
  blocked: bigint('blocked', { mode: 'number' }).notNull().default(0),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).notNull().default(now()),
});

// ── AI Analysis ────────────────────────────────────
export const aiAnalysis = pgTable('ai_analysis', {
  id: uuid('id').primaryKey().default(genUuid()),
  risk_score: integer('risk_score').notNull().default(0),
  anomalies_detected: integer('anomalies_detected').notNull().default(0),
  threats_blocked: integer('threats_blocked').notNull().default(0),
  predictions: text('predictions').notNull().default('{}'),
  recommendations: text('recommendations').notNull().default('[]'),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).notNull().default(now()),
});

// ── Packet Captures ────────────────────────────────
export const packetCaptures = pgTable('packet_captures', {
  id: uuid('id').primaryKey().default(genUuid()),
  name: text('name').notNull(),
  interface: text('interface').notNull().default('any'),
  filter: text('filter').notNull().default(''),
  status: text('status').notNull().default('stopped'),
  packets: integer('packets').notNull().default(0),
  size_bytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  pcap_file: text('pcap_file'),
  started_at: timestamp('started_at', { withTimezone: true }),
  stopped_at: timestamp('stopped_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(now()),
});

// ── Insert schemas ──────────────────────────────────
export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true, updated_at: true });
export const insertFirewallRuleSchema = createInsertSchema(firewallRules).omit({ id: true, created_at: true, updated_at: true });
export const insertNatRuleSchema = createInsertSchema(natRules).omit({ id: true, created_at: true, updated_at: true });
export const insertNetworkInterfaceSchema = createInsertSchema(networkInterfaces).omit({ id: true, created_at: true, updated_at: true });
export const insertVpnTunnelSchema = createInsertSchema(vpnTunnels).omit({ id: true, created_at: true, updated_at: true });
export const insertThreatEventSchema = createInsertSchema(threatEvents).omit({ id: true, created_at: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, created_at: true, updated_at: true });
export const insertStaticRouteSchema = createInsertSchema(staticRoutes).omit({ id: true, created_at: true, updated_at: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, created_at: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type FirewallRule = typeof firewallRules.$inferSelect;
export type NatRule = typeof natRules.$inferSelect;
export type NetworkInterface = typeof networkInterfaces.$inferSelect;
export type VpnTunnel = typeof vpnTunnels.$inferSelect;
export type ThreatEvent = typeof threatEvents.$inferSelect;
export type SystemMetric = typeof systemMetrics.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
