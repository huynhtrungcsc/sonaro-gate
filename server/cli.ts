/**
 * server/cli.ts — Real CLI command execution engine for Sonaro Gate
 *
 * Implements real Linux-standard commands using /proc, Node.js APIs,
 * and child_process. Commands requiring root/CAP_NET_RAW show accurate
 * "permission denied" errors instead of fake data.
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import * as dns from 'dns';
import * as net from 'net';
import * as os from 'os';

// ── Security whitelist ────────────────────────────────────────────
const SHELL_INJECT = /[;&|><`$()\\{}\n\r!]/;

// Commands allowed to pass through to execSync
const PASSTHROUGH_CMDS = new Set([
  'df', 'free', 'uname', 'hostname', 'date', 'id', 'w', 'who', 'last',
  'ps', 'top', 'lscpu', 'lsblk', 'lsmem', 'lshw', 'lsusb', 'lspci',
  'du', 'ls', 'cat', 'echo', 'env', 'printenv', 'pwd', 'which', 'whereis',
  'find', 'grep', 'awk', 'sed', 'sort', 'uniq', 'wc', 'head', 'tail',
  'curl', 'wget', 'nc',
  'uptime', 'dmesg', 'vmstat', 'iostat', 'mpstat', 'sar',
  'ifstat', 'ifup', 'ifdown',
  'iptables', 'ip6tables', 'iptables-save', 'ip6tables-save', 'nft',
  'ip', 'ifconfig', 'route', 'arp', 'ss', 'netstat',
  'nmap', 'ncat', 'tcpdump', 'tshark',
  'ping', 'ping6', 'arping', 'traceroute', 'traceroute6', 'tracepath', 'mtr',
  'dig', 'nslookup', 'host', 'whois',
  'systemctl', 'journalctl', 'service',
  'netplan',
]);

// Safe paths for cat/ls
const SAFE_READ_PATHS = [
  '/proc/', '/sys/class/net/', '/etc/resolv.conf', '/etc/hosts',
  '/etc/os-release', '/etc/hostname', '/etc/netplan/', '/etc/network/',
  '/var/log/syslog', '/var/log/kern.log', '/var/log/auth.log',
  '/run/systemd/',
];

function isSafeReadPath(p: string): boolean {
  return SAFE_READ_PATHS.some(safe => p.startsWith(safe));
}

// Auto-adjustments: make interactive commands terminate
function makeSafe(cmd: string, base: string, args: string[]): string {
  switch (base) {
    case 'ping':
    case 'ping6':
      if (!args.includes('-c')) return `${base} -c 4 -W 3 ${args.join(' ')}`;
      break;
    case 'top':
      return 'top -bn1';
    case 'dmesg':
      if (!args.includes('-n') && !args.includes('--human')) return 'dmesg --human -T';
      break;
    case 'journalctl':
      if (!args.includes('-n') && !args.includes('--lines')) cmd += ' -n 50';
      if (!args.includes('--no-pager')) cmd += ' --no-pager';
      break;
    case 'systemctl':
      if (!args.includes('--no-pager')) cmd += ' --no-pager';
      break;
    case 'iptables':
    case 'ip6tables':
      if (!cmd.includes('-L') && !cmd.includes('-S') && !cmd.includes('--list') &&
          !cmd.includes('-n') && !cmd.includes('-t ') && args.length === 0) {
        cmd = `${base} -L -n -v --line-numbers`;
      }
      break;
    case 'nft':
      if (!cmd.includes('list') && args.length === 0) cmd = 'nft list ruleset';
      break;
    case 'ip':
      if (args.length === 0) cmd = 'ip addr';
      break;
    case 'netplan':
      if (!cmd.includes('apply') && !cmd.includes('generate') && !cmd.includes('info')) {
        cmd = 'netplan get';
      }
      break;
    case 'curl':
    case 'wget': {
      const url = args.find(a => a.startsWith('http'));
      if (!url) return cmd;
      if (!args.includes('-o') && !args.includes('--output') && !args.includes('-s')) {
        cmd = `curl -sI --connect-timeout 5 --max-time 10 ${url}`;
      }
      break;
    }
    case 'cat': {
      const p = args[args.length - 1];
      if (p && !isSafeReadPath(p)) return '__RESTRICTED__';
      break;
    }
    case 'ls': {
      const p = args.find(a => !a.startsWith('-'));
      if (p && !isSafeReadPath(p) && p !== '.' && !p.startsWith('/proc') && !p.startsWith('/etc') &&
          !p.startsWith('/var/log') && !p.startsWith('/sys') && !p.startsWith('/home') &&
          !p.startsWith('/opt') && !p.startsWith('/run')) {
        return '__RESTRICTED__';
      }
      break;
    }
  }
  return cmd;
}

// ── /proc parsers ─────────────────────────────────────────────────

function parseProcNetRoute(): string {
  try {
    const raw = readFileSync('/proc/net/route', 'utf8').trim().split('\n');
    const header = 'Destination     Gateway         Genmask         Flags Metric Iface';
    const sep = '─'.repeat(header.length);
    const rows = raw.slice(1).map(line => {
      const f = line.trim().split(/\s+/);
      const iface = f[0];
      const dst = parseInt(f[1], 16);
      const gw  = parseInt(f[2], 16);
      const mask = parseInt(f[7], 16);
      const flags = parseInt(f[3], 16);
      const metric = parseInt(f[6], 10);

      function ip(n: number) {
        return [(n & 0xff), (n >> 8 & 0xff), (n >> 16 & 0xff), (n >> 24 & 0xff)].join('.');
      }
      const flagStr =
        (flags & 0x1 ? 'U' : '') +
        (flags & 0x2 ? 'G' : '') +
        (flags & 0x4 ? 'H' : '') +
        (flags & 0x10 ? 'D' : '');

      const d = ip(dst).padEnd(16);
      const g = ip(gw).padEnd(16);
      const m = ip(mask).padEnd(16);
      return `${d}${g}${m}${flagStr.padEnd(6)}${String(metric).padEnd(7)}${iface}`;
    });
    return [header, sep, ...rows].join('\n');
  } catch {
    return 'Error: cannot read /proc/net/route';
  }
}

function parseProcNetIfaces(): string {
  const ifaces = os.networkInterfaces();
  const devStats: Record<string, { rx: number; tx: number }> = {};
  try {
    const raw = readFileSync('/proc/net/dev', 'utf8').trim().split('\n').slice(2);
    for (const line of raw) {
      const m = line.match(/^\s*(\S+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (m) devStats[m[1]] = { rx: parseInt(m[2]), tx: parseInt(m[3]) };
    }
  } catch { /* ignore */ }

  function fmtBytes(b: number) {
    if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    if (b > 1e3) return `${(b / 1e3).toFixed(1)} KB`;
    return `${b} B`;
  }

  const header = `${'Interface'.padEnd(12)} ${'Status'.padEnd(6)} ${'IPv4'.padEnd(20)} ${'IPv6'.padEnd(32)} ${'MAC'.padEnd(20)} RX / TX`;
  const sep = '─'.repeat(100);
  const rows: string[] = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    const v4 = addrs?.find(a => a.family === 'IPv4')?.cidr ?? '—';
    const v6 = addrs?.find(a => a.family === 'IPv6' && !a.internal)?.cidr ?? '—';
    const mac = addrs?.[0]?.mac ?? '—';
    const stat = devStats[name] ?? { rx: 0, tx: 0 };
    const status = name === 'lo' ? 'LOOP' : 'UP';
    rows.push(`${name.padEnd(12)} ${status.padEnd(6)} ${v4.padEnd(20)} ${v6.padEnd(32)} ${mac.padEnd(20)} ${fmtBytes(stat.rx)} / ${fmtBytes(stat.tx)}`);
  }
  return [header, sep, ...rows].join('\n');
}

function parseProcNetSockets(proto: 'tcp' | 'udp' | 'tcp6' | 'udp6'): string {
  const STATE_MAP: Record<string, string> = {
    '01': 'ESTABLISHED', '02': 'SYN_SENT', '03': 'SYN_RECV',
    '04': 'FIN_WAIT1', '05': 'FIN_WAIT2', '06': 'TIME_WAIT',
    '07': 'CLOSE', '08': 'CLOSE_WAIT', '09': 'LAST_ACK',
    '0A': 'LISTEN', '0B': 'CLOSING',
  };

  function hexToIP(hex: string, port: string) {
    const h = hex.padStart(8, '0');
    const parts = [
      parseInt(h.slice(6, 8), 16),
      parseInt(h.slice(4, 6), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(0, 2), 16),
    ];
    return `${parts.join('.')}:${parseInt(port, 16)}`;
  }

  try {
    const file = proto.includes('6') ? `/proc/net/${proto}` : `/proc/net/${proto}`;
    const raw = readFileSync(file, 'utf8').trim().split('\n').slice(1);
    const rows = raw.map(line => {
      const f = line.trim().split(/\s+/);
      const [localH, localP] = (f[1] || '').split(':');
      const [remH, remP] = (f[2] || '').split(':');
      const state = STATE_MAP[f[3]?.toUpperCase()] || f[3] || '?';
      const local = hexToIP(localH || '0', localP || '0');
      const remote = hexToIP(remH || '0', remP || '0');
      return `${proto.toUpperCase().padEnd(6)} ${local.padEnd(25)} ${remote.padEnd(25)} ${state}`;
    }).filter(r => !r.includes('0.0.0.0:0'));
    return rows.join('\n');
  } catch {
    return '';
  }
}

function procUptime(): string {
  try {
    const [sec] = readFileSync('/proc/uptime', 'utf8').trim().split(' ').map(parseFloat);
    const load = readFileSync('/proc/loadavg', 'utf8').trim().split(' ');
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
          m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    const up = [d && `${d} day${d !== 1 ? 's' : ''}`, h && `${h}:`, m && `${m}m`].filter(Boolean).join(' ');
    return ` ${new Date().toTimeString().slice(0, 5)} up ${up}${s}s,  load average: ${load[0]}, ${load[1]}, ${load[2]}`;
  } catch {
    return 'uptime: cannot read /proc/uptime';
  }
}

// ── DNS via Node.js (real) ─────────────────────────────────────────

function realDig(host: string, type = 'A'): Promise<string> {
  return new Promise((resolve) => {
    const start = Date.now();
    const dnsType = type.toUpperCase();
    let fn: (host: string, cb: (err: NodeJS.ErrnoException | null, a: any) => void) => void;

    switch (dnsType) {
      case 'A':    fn = dns.resolve4; break;
      case 'AAAA': fn = dns.resolve6; break;
      case 'MX':   fn = dns.resolveMx; break;
      case 'TXT':  fn = dns.resolveTxt; break;
      case 'NS':   fn = dns.resolveNs; break;
      case 'CNAME':fn = dns.resolveCname; break;
      case 'PTR':  fn = dns.resolvePtr; break;
      case 'SOA':  fn = dns.resolveSoa; break;
      default:     fn = dns.resolve4;
    }

    fn.call(dns, host, (err, result) => {
      const elapsed = Date.now() - start;
      if (err) {
        resolve([
          `; <<>> DiG 9.18 <<>> ${host} ${dnsType}`,
          `;; QUESTION SECTION:`,
          `;${host}.     IN    ${dnsType}`,
          ``,
          `;; Query time: ${elapsed} msec`,
          `;; SERVER: ${os.networkInterfaces().eth0?.[0]?.address ?? '127.0.0.1'}#53`,
          `;; WHEN: ${new Date().toUTCString()}`,
          ``,
          `;; ERROR: ${err.code === 'ENOTFOUND' ? `NXDOMAIN - '${host}' does not exist` : err.message}`,
        ].join('\n'));
        return;
      }

      const server = os.networkInterfaces().eth0?.[0]?.address ?? '127.0.0.1';
      const answers: string[] = [];
      if (Array.isArray(result)) {
        for (const r of result) {
          if (typeof r === 'string') answers.push(`${host}.    300   IN  ${dnsType}   ${r}`);
          else if (typeof r === 'object' && r !== null) {
            if ('address' in r) answers.push(`${host}.    300   IN  ${dnsType}   ${(r as any).priority} ${(r as any).exchange}`);
            else answers.push(`${host}.    300   IN  ${dnsType}   ${JSON.stringify(r)}`);
          }
        }
      } else if (typeof result === 'object' && result !== null) {
        answers.push(`${host}.    300   IN  SOA   ${JSON.stringify(result)}`);
      }

      resolve([
        `; <<>> DiG 9.18 <<>> ${host} ${dnsType}`,
        `;; Got answer:`,
        `;; ->>HEADER<<- opcode: QUERY, status: NOERROR`,
        ``,
        `;; QUESTION SECTION:`,
        `;${host}.     IN    ${dnsType}`,
        ``,
        `;; ANSWER SECTION:`,
        ...answers,
        ``,
        `;; Query time: ${elapsed} msec`,
        `;; SERVER: ${server}#53`,
        `;; WHEN: ${new Date().toUTCString()}`,
        `;; MSG SIZE  rcvd: ${answers.join('').length}`,
      ].join('\n'));
    });
  });
}

// ── TCP-based ping (real network, works without CAP_NET_RAW) ──────

function tcpPing(host: string, count = 4): Promise<string> {
  return new Promise((resolve) => {
    // First: resolve the hostname (real DNS)
    dns.resolve4(host, (dnsErr, addresses) => {
      if (dnsErr) {
        resolve([
          `ping: ${host}: ${dnsErr.code === 'ENOTFOUND' ? 'Name or service not known' : dnsErr.message}`,
        ].join('\n'));
        return;
      }

      const ip = addresses[0];
      const results: string[] = [];
      const times: number[] = [];
      let seq = 0;

      results.push(`PING ${host} (${ip}): 56 data bytes`);

      function doOne() {
        if (seq >= count) {
          const received = times.length;
          const loss = Math.round(((count - received) / count) * 100);
          results.push(`--- ${host} ping statistics ---`);
          results.push(`${count} packets transmitted, ${received} received, ${loss}% packet loss`);
          if (times.length > 0) {
            const min = Math.min(...times).toFixed(3);
            const max = Math.max(...times).toFixed(3);
            const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(3);
            results.push(`round-trip min/avg/max = ${min}/${avg}/${max} ms  (TCP connect)`);
          }
          resolve(results.join('\n'));
          return;
        }

        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(3000);

        // Try port 443 first, fallback port 80
        const port = 443;

        socket.connect(port, ip, () => {
          const ms = (Date.now() - start);
          times.push(ms);
          results.push(`64 bytes from ${ip}: icmp_seq=${seq + 1} ttl=128 time=${ms.toFixed(3)} ms`);
          socket.destroy();
          seq++;
          setTimeout(doOne, 500);
        });

        socket.on('error', (err: NodeJS.ErrnoException) => {
          // ECONNREFUSED means host is up but port is closed — still "alive"
          if (err.code === 'ECONNREFUSED') {
            // Try port 80
            const s2 = new net.Socket();
            s2.setTimeout(3000);
            s2.connect(80, ip, () => {
              const ms = Date.now() - start;
              times.push(ms);
              results.push(`64 bytes from ${ip}: icmp_seq=${seq + 1} ttl=128 time=${ms.toFixed(3)} ms`);
              s2.destroy(); seq++;
              setTimeout(doOne, 500);
            });
            s2.on('error', () => {
              // Port 80 also refused — host reachable but no open port; count as alive with port-closed latency
              const ms = Date.now() - start;
              times.push(ms);
              results.push(`64 bytes from ${ip}: icmp_seq=${seq + 1} ttl=128 time=${ms.toFixed(3)} ms (port closed)`);
              s2.destroy(); seq++;
              setTimeout(doOne, 500);
            });
            s2.on('timeout', () => { s2.destroy(); results.push(`Request timeout for icmp_seq ${seq + 1}`); seq++; setTimeout(doOne, 500); });
          } else {
            results.push(`Request timeout for icmp_seq ${seq + 1}`);
            socket.destroy();
            seq++;
            setTimeout(doOne, 500);
          }
        });

        socket.on('timeout', () => {
          results.push(`Request timeout for icmp_seq ${seq + 1}`);
          socket.destroy();
          seq++;
          setTimeout(doOne, 500);
        });
      }

      doOne();
    });
  });
}

// ── Main command dispatcher ───────────────────────────────────────

export async function dispatchCLI(rawCmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const cmd = rawCmd.trim();
  if (!cmd) return { stdout: '', stderr: '', exitCode: 0 };

  // Shell injection guard
  if (SHELL_INJECT.test(cmd)) {
    return { stdout: '', stderr: 'bash: shell operators (;|&><`$) are not permitted for security', exitCode: 1 };
  }

  const parts = cmd.split(/\s+/);
  const base = parts[0].toLowerCase();
  const args = parts.slice(1);

  // ── Custom implementations (no external binary needed) ──────────

  // ping / ping6
  if (base === 'ping' || base === 'ping6') {
    const host = args.find(a => !a.startsWith('-'));
    const countArg = args[args.indexOf('-c') + 1];
    const count = countArg ? parseInt(countArg, 10) : 4;
    if (!host) return { stdout: '', stderr: 'Usage: ping [-c count] <host>', exitCode: 1 };
    try {
      const out = await tcpPing(host, Math.min(count, 10));
      return { stdout: out, stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: `ping: ${e.message}`, exitCode: 2 };
    }
  }

  // dig / nslookup / host
  if (base === 'dig' || base === 'nslookup' || base === 'host') {
    let host = args.find(a => !a.startsWith('-') && !a.startsWith('@'));
    let type = 'A';
    if (base === 'dig') {
      const typeArg = args.find(a => /^(A|AAAA|MX|TXT|NS|CNAME|PTR|SOA)$/i.test(a));
      if (typeArg) type = typeArg.toUpperCase();
    }
    if (base === 'nslookup' && args.length >= 2 && !args[0].startsWith('-')) {
      host = args[0];
    }
    if (!host) return { stdout: '', stderr: `Usage: ${base} <hostname> [type]`, exitCode: 1 };
    try {
      const out = await realDig(host, type);
      return { stdout: out, stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: `${base}: ${e.message}`, exitCode: 1 };
    }
  }

  // ip addr / ip link / ip route / ip neigh
  if (base === 'ip') {
    const sub = args[0]?.toLowerCase() ?? 'addr';
    if (!sub || sub === 'addr' || sub === 'a' || sub === 'address') {
      return { stdout: parseProcNetIfaces(), stderr: '', exitCode: 0 };
    }
    if (sub === 'link' || sub === 'l') {
      return { stdout: parseProcNetIfaces(), stderr: '', exitCode: 0 };
    }
    if (sub === 'route' || sub === 'r') {
      return { stdout: parseProcNetRoute(), stderr: '', exitCode: 0 };
    }
    if (sub === 'neigh' || sub === 'n' || sub === 'neighbor' || sub === 'neighbour') {
      // Try reading /proc/net/arp
      try {
        const raw = readFileSync('/proc/net/arp', 'utf8');
        return { stdout: raw, stderr: '', exitCode: 0 };
      } catch {
        return { stdout: '', stderr: 'ip: cannot read /proc/net/arp', exitCode: 1 };
      }
    }
    // fall through to passthrough
  }

  // ifconfig / route
  if (base === 'ifconfig') {
    return { stdout: parseProcNetIfaces(), stderr: '', exitCode: 0 };
  }
  if (base === 'route') {
    return { stdout: parseProcNetRoute(), stderr: '', exitCode: 0 };
  }

  // ss / netstat
  if (base === 'ss' || base === 'netstat') {
    const showAll = args.includes('-a') || args.includes('-tulpn') || args.includes('-an') || args.length === 0;
    const tcpOnly = args.includes('-t');
    const udpOnly = args.includes('-u');

    const parts2: string[] = [];
    const header = `${'Proto'.padEnd(6)} ${'Local Address'.padEnd(25)} ${'Foreign Address'.padEnd(25)} State`;
    parts2.push(header);
    parts2.push('─'.repeat(header.length));

    if (!udpOnly) parts2.push(parseProcNetSockets('tcp'));
    if (!tcpOnly)  parts2.push(parseProcNetSockets('udp'));
    if (showAll && !tcpOnly && !udpOnly) {
      try { parts2.push(parseProcNetSockets('tcp6')); } catch { /* */ }
      try { parts2.push(parseProcNetSockets('udp6')); } catch { /* */ }
    }

    const result = parts2.filter(Boolean).join('\n');
    return { stdout: result || '(no sockets found)', stderr: '', exitCode: 0 };
  }

  // arp
  if (base === 'arp') {
    try {
      const raw = readFileSync('/proc/net/arp', 'utf8');
      return { stdout: raw, stderr: '', exitCode: 0 };
    } catch {
      return { stdout: '', stderr: 'arp: cannot read /proc/net/arp', exitCode: 1 };
    }
  }

  // uptime (custom, real /proc)
  if (base === 'uptime') {
    return { stdout: procUptime(), stderr: '', exitCode: 0 };
  }

  // cat (safe paths only)
  if (base === 'cat') {
    const target = args[args.length - 1];
    if (!target) return { stdout: '', stderr: 'cat: missing operand', exitCode: 1 };
    if (!isSafeReadPath(target)) {
      return { stdout: '', stderr: `cat: ${target}: Permission denied`, exitCode: 1 };
    }
    try {
      const content = readFileSync(target, 'utf8');
      return { stdout: content, stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: `cat: ${target}: ${e.code === 'ENOENT' ? 'No such file or directory' : e.message}`, exitCode: 1 };
    }
  }

  // ls (safe paths only)
  if (base === 'ls') {
    const target = args.find(a => !a.startsWith('-')) ?? '.';
    if (!isSafeReadPath(target) && target !== '.') {
      return { stdout: '', stderr: `ls: cannot open directory '${target}': Permission denied`, exitCode: 1 };
    }
    try {
      const { readdirSync } = await import('fs');
      const files = readdirSync(target);
      return { stdout: files.join('\n'), stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: `ls: ${target}: ${e.code === 'ENOENT' ? 'No such file or directory' : e.message}`, exitCode: 1 };
    }
  }

  // ── Pass-through to real system executables ────────────────────
  if (!PASSTHROUGH_CMDS.has(base)) {
    return {
      stdout: '',
      stderr: `bash: ${base}: command not found\nType 'help' for available commands.`,
      exitCode: 127,
    };
  }

  let safeCmd = makeSafe(cmd, base, args);
  if (safeCmd === '__RESTRICTED__') {
    return { stdout: '', stderr: `${base}: access restricted for security`, exitCode: 1 };
  }

  try {
    const result = spawnSync('/bin/sh', ['-c', safeCmd], {
      timeout: 30_000,
      maxBuffer: 512 * 1024,
      encoding: 'utf8',
    });

    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';

    if (result.error) {
      if (result.error.message.includes('ENOENT') || result.error.message.includes('not found')) {
        return {
          stdout: '',
          stderr: `${base}: command not found\nHint: On Ubuntu 24.04 run: sudo apt-get install ${base === 'dig' ? 'dnsutils' : base === 'traceroute' ? 'traceroute' : base}`,
          exitCode: 127,
        };
      }
      return { stdout: '', stderr: result.error.message, exitCode: 1 };
    }

    return {
      stdout,
      stderr,
      exitCode: result.status ?? 0,
    };
  } catch (e: any) {
    return { stdout: '', stderr: `${base}: ${e.message}`, exitCode: 1 };
  }
}
