/**
 * Network and firewall integration module.
 * Handles ALL kernel-level networking on Ubuntu:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  Layer     │ Tool           │ Status                        │
 *  ├────────────┼────────────────┼───────────────────────────────┤
 *  │  IP config │ ip addr/link   │ ✅ Implemented                │
 *  │  Routing   │ ip route       │ ✅ Implemented                │
 *  │  IP fwd    │ sysctl         │ ✅ Implemented                │
 *  │  Firewall  │ iptables       │ ✅ Implemented                │
 *  │  NAT       │ iptables -t nat│ ✅ Implemented                │
 *  │  Persist   │ netplan/sysctl │ ✅ Implemented                │
 *  │  DHCP srvr │ dnsmasq        │ ⚠️  External service required  │
 *  │  VPN       │ wireguard/ovpn │ ⚠️  External service required  │
 *  │  IDS/IPS   │ suricata       │ ✅ server/suricata.ts          │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Requires root for most operations. Gracefully degrades otherwise.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, appendFile } from 'fs/promises';
import { db } from './db.js';
import { firewallRules, natRules, networkInterfaces } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────
// Core helpers
// ─────────────────────────────────────────────────────────────────

/** Run a shell command. Returns stdout, stderr and success flag. */
async function runCmd(cmd: string): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 10_000 });
    return { stdout, stderr, ok: true };
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      ok: false,
    };
  }
}

/** Returns true when the process is running as uid 0 (root). */
export async function isRoot(): Promise<boolean> {
  const r = await runCmd('id -u');
  return r.stdout.trim() === '0';
}

/** Guard: return error result if not root. */
async function requireRoot(): Promise<null | { success: false; message: string; commands: string[] }> {
  if (!(await isRoot())) {
    return {
      success: false,
      message: 'Root privileges required. Start the server with: sudo npx tsx server/index.ts',
      commands: [],
    };
  }
  return null;
}

export interface CmdResult {
  success: boolean;
  message: string;
  commands: string[];
  details?: string;
}

// ─────────────────────────────────────────────────────────────────
// IP Forwarding  (REQUIRED for packet routing between interfaces)
// ─────────────────────────────────────────────────────────────────

/**
 * Enable IP forwarding so the Linux kernel forwards packets
 * between network interfaces (WAN ↔ LAN).
 * Without this, the machine cannot act as a router/firewall.
 */
export async function enableIpForwarding(): Promise<CmdResult> {
  const guard = await requireRoot();
  if (guard) return guard;

  const commands: string[] = [];
  const errors: string[] = [];

  // Activate immediately (survives only until reboot)
  const r1 = await runCmd('sysctl -w net.ipv4.ip_forward=1');
  commands.push('sysctl -w net.ipv4.ip_forward=1');
  if (!r1.ok) errors.push(r1.stderr);

  // Enable IPv6 forwarding too
  const r2 = await runCmd('sysctl -w net.ipv6.conf.all.forwarding=1');
  commands.push('sysctl -w net.ipv6.conf.all.forwarding=1');
  // IPv6 failure is non-fatal

  // Persist across reboots via /etc/sysctl.d/
  try {
    const conf = 'net.ipv4.ip_forward = 1\nnet.ipv6.conf.all.forwarding = 1\n';
    await writeFile('/etc/sysctl.d/99-sonaro-forward.conf', conf);
    commands.push('write /etc/sysctl.d/99-sonaro-forward.conf');
  } catch (e: any) {
    errors.push(`sysctl persist: ${e.message}`);
  }

  return errors.length > 0
    ? { success: false, message: errors.join('; '), commands }
    : { success: true, message: 'IP forwarding enabled and persisted', commands };
}

/** Read current ip_forward status from the kernel */
export async function getIpForwardingStatus(): Promise<boolean> {
  const r = await runCmd('cat /proc/sys/net/ipv4/ip_forward');
  return r.stdout.trim() === '1';
}

// ─────────────────────────────────────────────────────────────────
// iptables — filter table (INPUT / OUTPUT / FORWARD)
// ─────────────────────────────────────────────────────────────────

export async function checkIptablesAvailable(): Promise<{
  available: boolean;
  hasPermission: boolean;
  message: string;
}> {
  const ver = await runCmd('iptables --version');
  if (!ver.ok) {
    return { available: false, hasPermission: false, message: 'iptables binary not found' };
  }

  const list = await runCmd('iptables -L -n 2>&1');
  if (!list.ok || list.stderr.includes('Permission denied') || list.stderr.includes('must be root')) {
    return {
      available: true,
      hasPermission: false,
      message: 'iptables found but requires root. Run server with sudo.',
    };
  }
  return { available: true, hasPermission: true, message: 'iptables available' };
}

export async function getIptablesRules(): Promise<string> {
  const check = await checkIptablesAvailable();
  if (!check.hasPermission) return `# ${check.message}`;
  const r = await runCmd('iptables -L -n -v --line-numbers 2>&1');
  return r.stdout || r.stderr;
}

export async function getNftablesRules(): Promise<string> {
  const r = await runCmd('nft list ruleset 2>&1');
  return r.ok ? r.stdout : `# nft: ${r.stderr}`;
}

/** Apply a single firewall rule from the firewall_rules table to iptables. */
export async function applyFirewallRule(rule: any): Promise<{ success: boolean; message: string }> {
  const check = await checkIptablesAvailable();
  if (!check.available) return { success: false, message: 'iptables not found' };
  if (!check.hasPermission) return { success: false, message: check.message };

  const action = rule.action === 'pass' ? 'ACCEPT'
    : rule.action === 'reject' ? 'REJECT'
    : 'DROP';

  // Map direction to iptables chain.
  // For firewall rules between interfaces use FORWARD.
  const chain = rule.direction === 'in' ? 'INPUT'
    : rule.direction === 'out' ? 'OUTPUT'
    : 'FORWARD';

  const parts: string[] = ['iptables', '-A', chain];
  if (rule.protocol && rule.protocol !== 'any') parts.push('-p', rule.protocol);
  if (rule.source_value && rule.source_value !== '*' && rule.source_value !== 'any') parts.push('-s', rule.source_value);
  if (rule.destination_value && rule.destination_value !== '*' && rule.destination_value !== 'any') parts.push('-d', rule.destination_value);
  if (rule.destination_port && rule.protocol && rule.protocol !== 'any') parts.push('--dport', rule.destination_port);
  if (rule.logging) parts.push('-j', 'LOG', '--log-prefix', `"SONARO-${chain}: "`, '&&', 'iptables', '-A', chain);
  parts.push('-j', action);

  const cmd = parts.join(' ');
  const r = await runCmd(cmd);
  return r.ok
    ? { success: true, message: cmd }
    : { success: false, message: `${cmd} → ${r.stderr}` };
}

// ─────────────────────────────────────────────────────────────────
// iptables — nat table  (CRITICAL for traffic routing)
// ─────────────────────────────────────────────────────────────────

/**
 * Enable NAT masquerading on the WAN interface.
 * This is what lets LAN hosts access the internet through the firewall.
 *
 *   iptables -t nat -A POSTROUTING -o <wanIface> -j MASQUERADE
 *
 * Without this, traffic from LAN clients reaches the internet but
 * replies are dropped because the source IP is a private address.
 */
export async function enableNatMasquerade(wanIface: string): Promise<CmdResult> {
  const guard = await requireRoot();
  if (guard) return guard;

  const commands: string[] = [];
  const errors: string[] = [];

  // Also allow FORWARD traffic for established connections
  const r1 = await runCmd(
    'iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT'
  );
  commands.push('iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT');
  if (!r1.ok) errors.push(r1.stderr);

  // Allow forwarding from LAN to WAN
  const r2 = await runCmd(`iptables -A FORWARD -i ${wanIface} -j ACCEPT`);
  commands.push(`iptables -A FORWARD -i ${wanIface} -j ACCEPT`);
  if (!r2.ok) errors.push(r2.stderr);

  // NAT masquerade on WAN egress
  const r3 = await runCmd(`iptables -t nat -A POSTROUTING -o ${wanIface} -j MASQUERADE`);
  commands.push(`iptables -t nat -A POSTROUTING -o ${wanIface} -j MASQUERADE`);
  if (!r3.ok) errors.push(r3.stderr);

  return errors.length > 0
    ? { success: false, message: errors.join('; '), commands }
    : { success: true, message: `NAT masquerade enabled on ${wanIface}`, commands };
}

/**
 * Apply all enabled NAT rules from the nat_rules table to iptables.
 * Handles:
 *   - port-forward  → DNAT (PREROUTING) + allow in FORWARD
 *   - outbound-nat  → SNAT (POSTROUTING)
 *   - masquerade    → MASQUERADE (POSTROUTING)
 */
export async function applyNatRules(): Promise<{ applied: number; failed: number; errors: string[]; commands: string[] }> {
  const check = await checkIptablesAvailable();
  if (!check.hasPermission) {
    return { applied: 0, failed: 0, errors: [check.message], commands: [] };
  }

  let applied = 0;
  let failed = 0;
  const errors: string[] = [];
  const commands: string[] = [];

  const rules = await db
    .select()
    .from(natRules)
    .where(eq(natRules.enabled, true));

  for (const rule of rules) {
    try {
      if (rule.type === 'port-forward') {
        // DNAT: redirect incoming traffic on external_port → internal_address:internal_port
        const proto = rule.protocol !== 'any' ? `-p ${rule.protocol}` : '-p tcp';
        const extAddr = rule.external_address ? `-d ${rule.external_address}` : '';
        const dnatCmd = [
          'iptables -t nat -A PREROUTING',
          proto,
          extAddr,
          `--dport ${rule.external_port}`,
          '-j DNAT',
          `--to-destination ${rule.internal_address}:${rule.internal_port}`,
        ].filter(Boolean).join(' ');

        const r = await runCmd(dnatCmd);
        commands.push(dnatCmd);
        if (r.ok) {
          // Also allow this traffic through the FORWARD chain
          const fwdCmd = [
            'iptables -A FORWARD',
            proto,
            `-d ${rule.internal_address}`,
            `--dport ${rule.internal_port}`,
            '-m state --state NEW,ESTABLISHED,RELATED -j ACCEPT',
          ].filter(Boolean).join(' ');
          await runCmd(fwdCmd);
          commands.push(fwdCmd);
          applied++;
        } else {
          failed++;
          errors.push(`port-forward (${rule.external_port}→${rule.internal_address}:${rule.internal_port}): ${r.stderr}`);
        }
      } else if (rule.type === 'outbound-nat') {
        // SNAT: translate source IP for outbound traffic
        const proto = rule.protocol !== 'any' ? `-p ${rule.protocol}` : '';
        const cmd = [
          'iptables -t nat -A POSTROUTING',
          proto,
          rule.internal_address ? `-s ${rule.internal_address}` : '',
          '-j SNAT',
          `--to-source ${rule.external_address}`,
        ].filter(Boolean).join(' ');
        const r = await runCmd(cmd);
        commands.push(cmd);
        r.ok ? applied++ : (failed++, errors.push(r.stderr));
      } else if (rule.type === 'masquerade') {
        const cmd = [
          'iptables -t nat -A POSTROUTING',
          rule.interface !== 'WAN' ? `-o ${rule.interface}` : '',
          '-j MASQUERADE',
        ].filter(Boolean).join(' ');
        const r = await runCmd(cmd);
        commands.push(cmd);
        r.ok ? applied++ : (failed++, errors.push(r.stderr));
      }
    } catch (err: any) {
      failed++;
      errors.push(err.message);
    }
  }

  return { applied, failed, errors, commands };
}

// ─────────────────────────────────────────────────────────────────
// Full firewall apply (filter table)
// ─────────────────────────────────────────────────────────────────

export async function flushAndApplyAllRules(): Promise<{
  applied: number; failed: number; errors: string[];
}> {
  const check = await checkIptablesAvailable();
  if (!check.hasPermission) {
    return { applied: 0, failed: 0, errors: [check.message] };
  }

  let applied = 0;
  let failed = 0;
  const errors: string[] = [];

  const rules = await db
    .select()
    .from(firewallRules)
    .where(eq(firewallRules.enabled, true))
    .orderBy(firewallRules.rule_order);

  for (const rule of rules) {
    const result = await applyFirewallRule(rule);
    result.success ? applied++ : (failed++, errors.push(result.message));
  }

  return { applied, failed, errors };
}

// ─────────────────────────────────────────────────────────────────
// Master "Apply All" — call this to activate the full config
// ─────────────────────────────────────────────────────────────────

export interface FullApplyResult {
  success: boolean;
  steps: {
    ipForwarding: CmdResult;
    natMasquerade: { wanIface: string | null; result: CmdResult };
    natRules: { applied: number; failed: number; errors: string[] };
    firewallRules: { applied: number; failed: number; errors: string[] };
  };
  summary: string;
}

/**
 * Apply the complete firewall configuration from the database to the OS.
 * This is what makes the system actually function as a firewall/router.
 *
 * Steps:
 *  1. Enable ip_forward so packets can cross between interfaces
 *  2. Enable NAT masquerade on the detected WAN interface
 *  3. Apply all NAT rules (port-forwarding, SNAT, masquerade)
 *  4. Apply all firewall filter rules (INPUT/OUTPUT/FORWARD)
 */
export async function applyFullConfig(): Promise<FullApplyResult> {
  const guard = await requireRoot();
  const notRoot = !!guard;

  // Step 1: IP forwarding
  const ipForwarding = notRoot
    ? (guard as CmdResult)
    : await enableIpForwarding();

  // Step 2: Find WAN interface and enable masquerade
  let wanIface: string | null = null;
  let natMasqueradeResult: CmdResult;

  if (!notRoot) {
    // Detect WAN from DB (type = 'WAN')
    const wanRows = await db
      .select()
      .from(networkInterfaces)
      .where(eq(networkInterfaces.type, 'WAN'))
      .limit(1);

    if (wanRows.length > 0 && wanRows[0].name) {
      wanIface = wanRows[0].name;
      natMasqueradeResult = await enableNatMasquerade(wanIface);
    } else {
      natMasqueradeResult = {
        success: false,
        message: 'No WAN interface found in database. Configure interfaces first.',
        commands: [],
      };
    }
  } else {
    natMasqueradeResult = guard as CmdResult;
  }

  // Step 3: NAT rules (port-forward etc.)
  const natRulesResult = notRoot
    ? { applied: 0, failed: 0, errors: [(guard as CmdResult).message], commands: [] }
    : await applyNatRules();

  // Step 4: Filter rules
  const firewallResult = notRoot
    ? { applied: 0, failed: 0, errors: [(guard as CmdResult).message] }
    : await flushAndApplyAllRules();

  const totalErrors = [
    ...(!ipForwarding.success ? [ipForwarding.message] : []),
    ...(!natMasqueradeResult.success ? [natMasqueradeResult.message] : []),
    ...natRulesResult.errors,
    ...firewallResult.errors,
  ];

  const summary = notRoot
    ? 'NOT applied — server must run as root (sudo)'
    : totalErrors.length === 0
      ? `Config applied: ip_forward enabled, NAT masquerade on ${wanIface}, ` +
        `${natRulesResult.applied} NAT rules, ${firewallResult.applied} filter rules`
      : `Partially applied with ${totalErrors.length} error(s)`;

  return {
    success: totalErrors.length === 0,
    steps: {
      ipForwarding,
      natMasquerade: { wanIface, result: natMasqueradeResult },
      natRules: natRulesResult,
      firewallRules: firewallResult,
    },
    summary,
  };
}

// ─────────────────────────────────────────────────────────────────
// Network interface management (ip addr / ip link)
// ─────────────────────────────────────────────────────────────────

export async function getInterfaceDetails(iface: string): Promise<string> {
  const r = await runCmd(`ip addr show dev ${iface} 2>&1`);
  return r.stdout || r.stderr;
}

export async function getAllInterfaceDetails(): Promise<string> {
  const r = await runCmd('ip addr show 2>&1');
  return r.stdout || r.stderr;
}

/**
 * Assign an IP address to a network interface.
 *
 *   ip link set <iface> up
 *   ip addr flush dev <iface>
 *   ip addr add <ip>/<prefix> dev <iface>
 *   ip route add default via <gateway> dev <iface>   (if gateway provided)
 */
export async function applyInterfaceIP(
  iface: string,
  ip: string,
  subnet: string,
  gateway?: string,
): Promise<CmdResult> {
  const guard = await requireRoot();
  if (guard) return guard;

  const commands: string[] = [];
  const errors: string[] = [];
  const prefix = maskToCidr(subnet);

  const up = await runCmd(`ip link set ${iface} up`);
  commands.push(`ip link set ${iface} up`);
  if (!up.ok) errors.push(`link set up: ${up.stderr}`);

  const flush = await runCmd(`ip addr flush dev ${iface}`);
  commands.push(`ip addr flush dev ${iface}`);
  if (!flush.ok) errors.push(`addr flush: ${flush.stderr}`);

  const add = await runCmd(`ip addr add ${ip}/${prefix} dev ${iface}`);
  commands.push(`ip addr add ${ip}/${prefix} dev ${iface}`);
  if (!add.ok) errors.push(`addr add: ${add.stderr}`);

  if (gateway && gateway.trim()) {
    await runCmd(`ip route del default dev ${iface} 2>/dev/null`);
    const gw = await runCmd(`ip route add default via ${gateway} dev ${iface}`);
    commands.push(`ip route add default via ${gateway} dev ${iface}`);
    if (!gw.ok) errors.push(`route add: ${gw.stderr}`);
  }

  return errors.length > 0
    ? { success: false, message: errors.join('; '), commands }
    : { success: true, message: `${iface}: ${ip}/${prefix}${gateway ? ' gw ' + gateway : ''}`, commands };
}

/** Bring an interface up or down via ip link set. */
export async function setInterfaceState(
  iface: string,
  state: 'up' | 'down',
): Promise<CmdResult> {
  const guard = await requireRoot();
  if (guard) return guard;

  const cmd = `ip link set ${iface} ${state}`;
  const r = await runCmd(cmd);
  return r.ok
    ? { success: true, message: `${iface} is ${state}`, commands: [cmd] }
    : { success: false, message: r.stderr, commands: [cmd] };
}

/**
 * Write a Netplan config file and apply it.
 * Makes network configuration survive reboots on Ubuntu 18.04+.
 *
 * File: /etc/netplan/90-sonaro.yaml
 */
export async function applyNetplanConfig(interfaces: Array<{
  name: string;
  ip_address: string | null;
  subnet: string | null;
  gateway: string | null;
  dhcp: boolean;
}>): Promise<CmdResult> {
  const guard = await requireRoot();
  if (guard) return guard;

  const ethSection: Record<string, any> = {};

  for (const iface of interfaces) {
    if (iface.dhcp) {
      ethSection[iface.name] = { dhcp4: true };
    } else if (iface.ip_address) {
      const prefix = maskToCidr(iface.subnet ?? '255.255.255.0');
      const entry: any = {
        dhcp4: false,
        addresses: [`${iface.ip_address}/${prefix}`],
      };
      if (iface.gateway) {
        entry.routes = [{ to: 'default', via: iface.gateway }];
      }
      ethSection[iface.name] = entry;
    }
  }

  const lines = [
    'network:',
    '  version: 2',
    '  renderer: networkd',
    '  ethernets:',
  ];
  for (const [name, cfg] of Object.entries(ethSection)) {
    lines.push(`    ${name}:`);
    lines.push(`      dhcp4: ${cfg.dhcp4}`);
    if (cfg.addresses) lines.push(`      addresses: [${cfg.addresses.join(', ')}]`);
    if (cfg.routes) {
      lines.push('      routes:');
      for (const r of cfg.routes) {
        lines.push(`        - to: ${r.to}`);
        lines.push(`          via: ${r.via}`);
      }
    }
  }

  const yaml = lines.join('\n') + '\n';
  const netplanPath = '/etc/netplan/90-sonaro.yaml';
  const commands = [`write ${netplanPath}`, 'netplan apply'];

  try {
    await writeFile(netplanPath, yaml, { mode: 0o600 });
    const r = await runCmd('netplan apply 2>&1');
    return r.ok
      ? { success: true, message: 'Netplan applied — config will survive reboots', commands }
      : { success: false, message: `netplan apply: ${r.stderr}`, commands };
  } catch (err: any) {
    return { success: false, message: `write failed: ${err.message}`, commands };
  }
}

// ─────────────────────────────────────────────────────────────────
// Routing table helpers
// ─────────────────────────────────────────────────────────────────

export async function getRoutingTable(): Promise<string> {
  const r = await runCmd('ip route show 2>&1');
  return r.stdout || r.stderr;
}

export async function getSystemInfo() {
  const [uptime, meminfo, cpuinfo] = await Promise.all([
    runCmd('cat /proc/uptime 2>/dev/null'),
    runCmd('cat /proc/meminfo 2>/dev/null'),
    runCmd('cat /proc/cpuinfo 2>/dev/null'),
  ]);
  return { uptime: uptime.stdout, meminfo: meminfo.stdout, cpuinfo: cpuinfo.stdout };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Convert subnet mask OR CIDR string to a CIDR prefix number.
 * "255.255.255.0" → "24"
 * "24" → "24"
 * "255.255.0.0" → "16"
 */
function maskToCidr(mask: string): string {
  if (!mask || !mask.includes('.')) return mask || '24';
  try {
    const bits = mask.split('.').map(Number).reduce((acc, octet) => {
      return acc + octet.toString(2).split('').filter(b => b === '1').length;
    }, 0);
    return String(bits);
  } catch {
    return '24';
  }
}
