/**
 * PostgREST-compatible CRUD router for Drizzle ORM.
 * Handles the same query parameter style that the frontend QueryBuilder sends.
 */

import { Router } from 'express';
import { db } from './db.js';
import { requireAuth } from './auth.js';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

// Map table name → Drizzle table object
const TABLE_MAP: Record<string, any> = {
  firewall_rules: schema.firewallRules,
  nat_rules: schema.natRules,
  network_interfaces: schema.networkInterfaces,
  vpn_tunnels: schema.vpnTunnels,
  threat_events: schema.threatEvents,
  system_settings: schema.systemSettings,
  static_routes: schema.staticRoutes,
  policy_routes: schema.policyRoutes,
  aliases: schema.aliases,
  services: schema.services,
  schedules: schema.schedules,
  certificates: schema.certificates,
  ids_signatures: schema.idsSignatures,
  dhcp_servers: schema.dhcpServers,
  dhcp_static_mappings: schema.dhcpStaticMappings,
  dhcp_leases: schema.dhcpLeases,
  dns_filter_profiles: schema.dnsFilterProfiles,
  dns_forward_zones: schema.dnsForwardZones,
  dns_local_records: schema.dnsLocalRecords,
  ip_pools: schema.ipPools,
  virtual_ips: schema.virtualIps,
  wildcard_fqdns: schema.wildcardFqdns,
  traffic_shapers: schema.trafficShapers,
  traffic_shaping_policies: schema.trafficShapingPolicies,
  ssl_inspection_profiles: schema.sslInspectionProfiles,
  av_profiles: schema.avProfiles,
  web_filter_profiles: schema.webFilterProfiles,
  audit_logs: schema.auditLogs,
  system_metrics: schema.systemMetrics,
  traffic_stats: schema.trafficStats,
  ai_analysis: schema.aiAnalysis,
  packet_captures: schema.packetCaptures,
  config_backups: schema.configBackups,
  users: schema.users,
  user_roles: schema.userRoles,
};

// Parse PostgREST-style filter params into SQL WHERE conditions
function parseFilters(table: any, params: Record<string, string>): string[] {
  const reserved = new Set(['select', 'order', 'limit', 'offset']);
  const conditions: string[] = [];
  const tableName = table[Symbol.for('drizzle:Name')] || '';

  for (const [key, rawVal] of Object.entries(params)) {
    if (reserved.has(key)) continue;
    const colName = `"${key}"`;

    if (rawVal.startsWith('eq.')) {
      const v = rawVal.slice(3);
      conditions.push(`${colName} = '${v.replace(/'/g, "''")}'`);
    } else if (rawVal.startsWith('neq.')) {
      const v = rawVal.slice(4);
      conditions.push(`${colName} != '${v.replace(/'/g, "''")}'`);
    } else if (rawVal.startsWith('gt.')) {
      const v = rawVal.slice(3);
      conditions.push(`${colName} > '${v}'`);
    } else if (rawVal.startsWith('gte.')) {
      const v = rawVal.slice(4);
      conditions.push(`${colName} >= '${v}'`);
    } else if (rawVal.startsWith('lt.')) {
      const v = rawVal.slice(3);
      conditions.push(`${colName} < '${v}'`);
    } else if (rawVal.startsWith('lte.')) {
      const v = rawVal.slice(4);
      conditions.push(`${colName} <= '${v}'`);
    } else if (rawVal.startsWith('in.(') && rawVal.endsWith(')')) {
      const vals = rawVal.slice(4, -1).split(',').map(v => `'${v.trim().replace(/'/g, "''")}'`).join(',');
      conditions.push(`${colName} IN (${vals})`);
    } else if (rawVal.startsWith('is.')) {
      const v = rawVal.slice(3);
      if (v === 'null') conditions.push(`${colName} IS NULL`);
      else conditions.push(`${colName} IS NOT NULL`);
    }
  }

  return conditions;
}

function getTableName(table: any): string {
  // Drizzle stores table name as a symbol
  const sym = Object.getOwnPropertySymbols(table).find(s => String(s) === 'Symbol(drizzle:Name)');
  if (sym) return (table as any)[sym];
  return '';
}

function buildSelectQuery(tableName: string, params: Record<string, string>): string {
  const filters = parseFilters({}, params);
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const order = params.order ? `ORDER BY "${params.order.replace('.asc', '').replace('.desc', '')}" ${params.order.endsWith('.desc') ? 'DESC' : 'ASC'}` : '';
  const limit = params.limit ? `LIMIT ${parseInt(params.limit)}` : 'LIMIT 1000';
  const offset = params.offset ? `OFFSET ${parseInt(params.offset)}` : '';

  return `SELECT * FROM "${tableName}" ${where} ${order} ${limit} ${offset}`.trim();
}

export function createCrudRouter(): Router {
  const router = Router();

  // GET /:table — list / filter
  router.get('/:table', requireAuth, async (req, res) => {
    const table = req.params.table as string;
    if (!TABLE_MAP[table]) {
      return res.status(404).json({ message: `Table '${table}' not found` });
    }

    try {
      const q = buildSelectQuery(table, req.query as Record<string, string>);
      const result = await db.execute(sql.raw(q));
      res.json(result.rows);
    } catch (err: any) {
      console.error(`[CRUD] GET ${table} error:`, err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /:table — insert
  router.post('/:table', requireAuth, async (req, res) => {
    const table = req.params.table as string;
    if (!TABLE_MAP[table]) {
      return res.status(404).json({ message: `Table '${table}' not found` });
    }

    try {
      const body = req.body;
      const cols = Object.keys(body).map(k => `"${k}"`).join(', ');
      const vals = Object.values(body).map((v: any) => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') return String(v);
        if (Array.isArray(v)) return `ARRAY[${v.map(x => typeof x === 'number' ? String(x) : `'${String(x).replace(/'/g, "''")}'`).join(',')}]`;
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(', ');

      const q = `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`;
      const result = await db.execute(sql.raw(q));
      res.status(201).json(result.rows);
    } catch (err: any) {
      console.error(`[CRUD] POST ${table} error:`, err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /:table — update (filtered)
  router.patch('/:table', requireAuth, async (req, res) => {
    const table = req.params.table as string;
    if (!TABLE_MAP[table]) {
      return res.status(404).json({ message: `Table '${table}' not found` });
    }

    try {
      const filters = parseFilters({}, req.query as Record<string, string>);
      if (filters.length === 0) {
        return res.status(400).json({ message: 'Update requires at least one filter' });
      }

      const body = req.body;
      const updates = Object.entries(body).map(([k, v]: [string, any]) => {
        if (v === null || v === undefined) return `"${k}" = NULL`;
        if (typeof v === 'boolean') return `"${k}" = ${v ? 'TRUE' : 'FALSE'}`;
        if (typeof v === 'number') return `"${k}" = ${v}`;
        if (Array.isArray(v)) return `"${k}" = ARRAY[${v.map(x => typeof x === 'number' ? String(x) : `'${String(x).replace(/'/g, "''")}'`).join(',')}]`;
        return `"${k}" = '${String(v).replace(/'/g, "''")}'`;
      }).join(', ');

      // Auto-update updated_at if column exists
      const hasUpdatedAt = ['firewall_rules','nat_rules','network_interfaces','vpn_tunnels',
        'system_settings','static_routes','policy_routes','aliases','services','schedules',
        'certificates','ids_signatures','dhcp_servers','dhcp_static_mappings','dns_filter_profiles',
        'dns_forward_zones','dns_local_records','ip_pools','virtual_ips','wildcard_fqdns',
        'traffic_shapers','traffic_shaping_policies','ssl_inspection_profiles','av_profiles',
        'web_filter_profiles','users'].includes(table);

      const updatedAtClause = hasUpdatedAt ? `, "updated_at" = NOW()` : '';
      const where = filters.join(' AND ');
      const q = `UPDATE "${table}" SET ${updates}${updatedAtClause} WHERE ${where} RETURNING *`;
      const result = await db.execute(sql.raw(q));
      res.json(result.rows);
    } catch (err: any) {
      console.error(`[CRUD] PATCH ${table} error:`, err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /:table — delete (filtered)
  router.delete('/:table', requireAuth, async (req, res) => {
    const table = req.params.table as string;
    if (!TABLE_MAP[table]) {
      return res.status(404).json({ message: `Table '${table}' not found` });
    }

    try {
      const filters = parseFilters({}, req.query as Record<string, string>);
      if (filters.length === 0) {
        return res.status(400).json({ message: 'Delete requires at least one filter' });
      }

      const where = filters.join(' AND ');
      const q = `DELETE FROM "${table}" WHERE ${where} RETURNING *`;
      const result = await db.execute(sql.raw(q));
      res.json(result.rows);
    } catch (err: any) {
      console.error(`[CRUD] DELETE ${table} error:`, err.message);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
