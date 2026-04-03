/**
 * Suricata IDS/IPS integration module.
 * Manages Suricata rules, signatures, and service lifecycle on Ubuntu.
 *
 * Installation requirement:
 *   apt-get install suricata suricata-update
 *   suricata-update
 *   systemctl enable suricata
 *
 * Custom rules are written to /etc/suricata/rules/sonaro-local.rules
 * Managed rule sets come from suricata-update (ET/open, etc.)
 */

import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import { hostExec, hostBinaryExists, hostServiceActive } from './host.js';

// Suricata lives on the HOST — paths are the same whether native or Docker
// because /etc/suricata and /var/log/suricata are bind-mounted into the container.
const SURICATA_BINARY  = '/usr/bin/suricata';
const SURICATA_RULES   = '/etc/suricata/rules/sonaro-local.rules';
const SURICATA_CONF    = '/etc/suricata/suricata.yaml';
const SURICATA_LOG     = '/var/log/suricata/fast.log';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

// Alias for backwards-compat with existing call sites
const run = (cmd: string, opts?: { timeout?: number }) => hostExec(cmd, opts);

// ─── Status ─────────────────────────────────────────────────────────────────

export async function getSuricataStatus(): Promise<{
  installed: boolean;
  running: boolean;
  version: string | null;
  ruleCount: number;
  pid: number | null;
}> {
  // Check the host binary (Docker-aware)
  const installed = hostBinaryExists('suricata');
  if (!installed) {
    return { installed: false, running: false, version: null, ruleCount: 0, pid: null };
  }

  const [ver, pidRes] = await Promise.all([
    run('suricata --build-info 2>/dev/null | head -1'),
    run('pidof suricata 2>/dev/null'),
  ]);

  const running = hostServiceActive('suricata');
  const pid = pidRes.ok && pidRes.stdout ? parseInt(pidRes.stdout.split(' ')[0]) : null;

  const localRulesExist = await fileExists(SURICATA_RULES);
  let localRuleCount = 0;
  if (localRulesExist) {
    const content = await readFile(SURICATA_RULES, 'utf8').catch(() => '');
    localRuleCount = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
  }

  return {
    installed,
    running,
    version: ver.ok ? ver.stdout.split('\n')[0] : null,
    ruleCount: localRuleCount,
    pid,
  };
}

// ─── Service control ─────────────────────────────────────────────────────────

export async function startSuricata(): Promise<{ ok: boolean; message: string }> {
  const res = await run('systemctl start suricata');
  return { ok: res.ok, message: res.ok ? 'Suricata started' : res.stderr };
}

export async function stopSuricata(): Promise<{ ok: boolean; message: string }> {
  const res = await run('systemctl stop suricata');
  return { ok: res.ok, message: res.ok ? 'Suricata stopped' : res.stderr };
}

export async function reloadSuricata(): Promise<{ ok: boolean; message: string }> {
  // SIGUSR2 triggers a live rule reload without restarting
  const res = await run('kill -USR2 $(pidof suricata) 2>/dev/null || systemctl reload suricata 2>/dev/null || true');
  return { ok: true, message: 'Suricata rules reloaded' };
}

// ─── Signature update ────────────────────────────────────────────────────────

export async function updateSignatures(): Promise<{ ok: boolean; message: string; output: string }> {
  const installed = await fileExists('/usr/bin/suricata-update');
  if (!installed) {
    return {
      ok: false,
      message: 'suricata-update not installed. Run: apt-get install suricata-update',
      output: '',
    };
  }
  const res = await run('suricata-update 2>&1');
  if (res.ok) {
    await reloadSuricata();
  }
  return {
    ok: res.ok,
    message: res.ok ? 'Signatures updated and reloaded' : 'Update failed',
    output: (res.stdout + res.stderr).slice(0, 2000),
  };
}

// ─── Local rules file ────────────────────────────────────────────────────────

async function readLocalRules(): Promise<string[]> {
  if (!(await fileExists(SURICATA_RULES))) return [];
  const content = await readFile(SURICATA_RULES, 'utf8');
  return content.split('\n');
}

async function writeLocalRules(lines: string[]): Promise<void> {
  const dir = SURICATA_RULES.substring(0, SURICATA_RULES.lastIndexOf('/'));
  await run(`mkdir -p ${dir}`);
  await writeFile(SURICATA_RULES, lines.join('\n') + '\n', 'utf8');
}

/**
 * Write a custom Suricata rule to the local rules file.
 * Rule format: action protocol src_ip src_port -> dst_ip dst_port (options)
 *
 * Example:
 *   alert tcp any any -> any 80 (msg:"Test rule"; sid:9000001; rev:1;)
 */
export async function addLocalRule(params: {
  sid: number;
  action: 'alert' | 'drop' | 'reject' | 'pass';
  protocol: string;
  srcIp: string;
  srcPort: string;
  dstIp: string;
  dstPort: string;
  message: string;
  category: string;
  severity: string;
}): Promise<{ ok: boolean; message: string; rule: string }> {
  const sevMap: Record<string, number> = {
    critical: 1, high: 2, medium: 3, low: 4, info: 5,
  };
  const classtype = params.category.toLowerCase().replace(/\s+/g, '-') || 'policy-violation';
  const rule = `${params.action} ${params.protocol} ${params.srcIp} ${params.srcPort} -> ${params.dstIp} ${params.dstPort} (msg:"${params.message}"; classtype:${classtype}; priority:${sevMap[params.severity] ?? 3}; sid:${params.sid}; rev:1;)`;

  const lines = await readLocalRules();
  // Prevent duplicate SID
  if (lines.some(l => l.includes(`sid:${params.sid};`))) {
    return { ok: false, message: `SID ${params.sid} already exists`, rule };
  }
  lines.push(rule);
  await writeLocalRules(lines);
  await reloadSuricata();
  return { ok: true, message: 'Rule added and Suricata reloaded', rule };
}

/**
 * Enable or disable a rule by SID by commenting/uncommenting it.
 */
export async function setRuleEnabled(sid: number, enabled: boolean): Promise<{ ok: boolean }> {
  const lines = await readLocalRules();
  const updated = lines.map(line => {
    const isThisSid = line.includes(`sid:${sid};`);
    if (!isThisSid) return line;
    if (enabled) return line.replace(/^#\s*/, '');
    if (!line.trim().startsWith('#')) return `# ${line}`;
    return line;
  });
  await writeLocalRules(updated);
  await reloadSuricata();
  return { ok: true };
}

/**
 * Delete a rule by SID.
 */
export async function deleteRule(sid: number): Promise<{ ok: boolean }> {
  const lines = await readLocalRules();
  const updated = lines.filter(l => !l.includes(`sid:${sid};`));
  await writeLocalRules(updated);
  await reloadSuricata();
  return { ok: true };
}

// ─── Recent alerts ───────────────────────────────────────────────────────────

export async function getRecentAlerts(limit = 50): Promise<string[]> {
  if (!(await fileExists(SURICATA_LOG))) return [];
  const res = await run(`tail -${limit} ${SURICATA_LOG} 2>/dev/null`);
  return res.ok ? res.stdout.split('\n').filter(Boolean) : [];
}
