import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface CLILine {
  type: 'input' | 'output' | 'error' | 'system' | 'pending';
  text: string;
}

// ── Helpers ────────────────────────────────────────────────────
function fmtBytes(bytes: number, dp = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(dp)} ${units[i]}`;
}
function pct(used: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((used / total) * 100)}%`;
}
function pad(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600),
        m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

const getToken = () => localStorage.getItem('sonaro_token') ?? '';

async function apiFetch(path: string): Promise<any> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function cliExec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const res = await fetch('/api/cli/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`CLI API error: HTTP ${res.status}`);
  return res.json();
}

// ── HELP ───────────────────────────────────────────────────────
const HELP_TEXT = `Sonaro Gate CLI — Available Commands

SYSTEM DIAGNOSTICS
  status              System status summary (live metrics)
  cpu                 CPU usage and load averages
  memory              Memory usage breakdown
  disk / df [-h]      Disk space usage
  uptime              System uptime and load
  version             Firmware and OS version
  uname [-a]          Kernel and architecture info
  hostname            Show system hostname
  date                Current date and time
  id                  Current user and groups
  ps [aux]            Running processes
  top [-bn1]          CPU/memory process table (one snapshot)

NETWORK DIAGNOSTICS
  ping <host>         Test connectivity (TCP probe, real DNS)
  ip addr             Network interfaces and IP addresses
  ip route            Routing table
  ip neigh            ARP/neighbor table
  ss [-tulpn]         Active sockets and listening ports
  netstat [-tulpn]    Same as ss
  arp                 ARP table
  ifconfig            Interface addresses
  route               Routing table

DNS & NAME RESOLUTION
  dig <host> [type]   DNS lookup (A/AAAA/MX/TXT/NS/CNAME/SOA)
  nslookup <host>     Name server lookup
  host <host>         DNS query

FIREWALL (requires root on Ubuntu)
  iptables [-L -n -v] List iptables rules
  ip6tables           IPv6 firewall rules
  iptables-save       Dump all rules in save format

SYSTEM SERVICES (Ubuntu 24.04 with systemd)
  systemctl [cmd]     Service management (status, list-units…)
  journalctl [-n 50]  System journal (last 50 lines by default)

NETWORK TOOLS (install on Ubuntu if missing)
  traceroute <host>   Trace packet route  (apt install traceroute)
  mtr <host>          My traceroute        (apt install mtr)
  nmap <target>       Network scan         (apt install nmap)
  curl -sI <url>      HTTP header probe

FIREWALL DATABASE (live DB query, always available)
  firewall rules      List rules from database
  vpn status          VPN tunnel status from database

UTILITIES
  cat /proc/…         Read /proc entries
  cat /etc/hosts      View /etc/hosts
  cat /etc/resolv.conf DNS resolver config
  clear               Clear console
  exit / quit         Close console`;

// ── DB-backed commands (always work regardless of OS) ──────────
async function executeDbCommand(raw: string): Promise<{ text: string; isError?: boolean } | null> {
  const lower = raw.trim().toLowerCase();

  // ── status / cpu / memory / disk / uptime / sessions ───────
  if (['cpu', 'memory', 'disk', 'uptime', 'status', 'sessions'].includes(lower)) {
    const rows: any[] = await apiFetch('/api/data/system_metrics?order=recorded_at.desc&limit=1');
    const m = rows[0];
    if (!m) throw new Error('No metrics available yet — agent may still be collecting');

    if (lower === 'uptime') {
      return { text: `System uptime: ${formatUptime(m.uptime)}\nRecorded: ${new Date(m.recorded_at).toLocaleString()}` };
    }
    if (lower === 'cpu') {
      return {
        text: `CPU Usage:     ${parseFloat(m.cpu_usage).toFixed(1)}%\nCores:         ${m.cpu_cores}\nTemperature:   ${parseFloat(m.cpu_temperature || 0).toFixed(1)}°C\nLoad Avg:      ${m.load_1m} / ${m.load_5m} / ${m.load_15m}  (1m / 5m / 15m)`,
      };
    }
    if (lower === 'memory') {
      return {
        text: `Memory Total:  ${fmtBytes(m.memory_total)}\nMemory Used:   ${fmtBytes(m.memory_used)}  (${pct(m.memory_used, m.memory_total)})\nMemory Free:   ${fmtBytes(m.memory_free)}\nMemory Cached: ${fmtBytes(m.memory_cached)}`,
      };
    }
    if (lower === 'disk') {
      return {
        text: `Filesystem   ${pad('Size', 10)} ${pad('Used', 10)} ${pad('Free', 10)} Use%\n/dev/sda1    ${pad(fmtBytes(m.disk_total), 10)} ${pad(fmtBytes(m.disk_used), 10)} ${pad(fmtBytes(m.disk_free), 10)} ${pct(m.disk_used, m.disk_total)}`,
      };
    }
    if (lower === 'sessions') {
      return {
        text: `System Metrics Snapshot\n  Hostname:  ${m.hostname || 'sonaro-gw-01'}\n  CPU:       ${parseFloat(m.cpu_usage).toFixed(1)}%\n  Memory:    ${pct(m.memory_used, m.memory_total)} of ${fmtBytes(m.memory_total)}\n  Disk:      ${pct(m.disk_used, m.disk_total)} of ${fmtBytes(m.disk_total)}\n  Uptime:    ${formatUptime(m.uptime)}`,
      };
    }

    // status
    let settings: any[] = [];
    try { settings = await apiFetch('/api/data/system_settings?select=key,value'); } catch { /* ignore */ }
    const serial = settings.find((s: any) => s.key === 'serial_number')?.value ?? 'SGW-UNKNOWN';
    return {
      text: [
        `System Status:   ONLINE`,
        `Hostname:        ${m.hostname || 'sonaro-gw-01'}`,
        `Model:           Sonaro Gate 2025.1 LTS`,
        `Serial:          ${serial}`,
        `Uptime:          ${formatUptime(m.uptime)}`,
        `CPU Usage:       ${parseFloat(m.cpu_usage).toFixed(1)}%   Load: ${m.load_1m} / ${m.load_5m} / ${m.load_15m}`,
        `Memory:          ${fmtBytes(m.memory_used)} / ${fmtBytes(m.memory_total)}  (${pct(m.memory_used, m.memory_total)})`,
        `Disk:            ${fmtBytes(m.disk_used)} / ${fmtBytes(m.disk_total)}  (${pct(m.disk_used, m.disk_total)})`,
        `Threat Level:    LOW`,
      ].join('\n'),
    };
  }

  // ── interfaces (from OS via backend) ────────────────────────
  if (lower === 'interfaces') {
    const ifaces: any[] = await apiFetch('/api/system/interfaces');
    if (!ifaces || ifaces.length === 0) return { text: 'No interface data (requires Linux OS)' };
    const header = `${pad('Interface', 12)} ${pad('Status', 8)} ${pad('IP Address', 20)} ${pad('MAC', 18)} RX / TX`;
    const sep = '─'.repeat(76);
    const rows = ifaces.map((iface: any) => {
      const name   = pad(iface.ifname || iface.name || '?', 12);
      const status = pad(iface.operstate === 'up' || iface.enabled ? 'UP' : 'DOWN', 8);
      const ip     = pad(iface.addr_info?.[0]?.local ?? iface.ip ?? '—', 20);
      const mac    = pad(iface.address || iface.mac || '—', 18);
      const rx     = fmtBytes(iface.stats?.rx_bytes ?? iface.rx_bytes ?? 0);
      const tx     = fmtBytes(iface.stats?.tx_bytes ?? iface.tx_bytes ?? 0);
      return `${name} ${status} ${ip} ${mac} ${rx} / ${tx}`;
    });
    return { text: [header, sep, ...rows].join('\n') };
  }

  // ── routes ───────────────────────────────────────────────────
  if (lower === 'routes') {
    const routes: any[] = await apiFetch('/api/system/routes');
    if (!routes || routes.length === 0) return { text: 'No routing data (requires Linux OS with ip route)' };
    const header = `${pad('Destination', 20)} ${pad('Gateway', 16)} ${pad('Interface', 12)} ${pad('Metric', 8)} Flags`;
    const sep = '─'.repeat(72);
    const rows = routes.map((r: any) => {
      return `${pad(r.dst || r.destination || '0.0.0.0/0', 20)} ${pad(r.gateway ?? r.via ?? 'link', 16)} ${pad(r.dev || r.iface || '?', 12)} ${pad(String(r.metric ?? 0), 8)} ${r.type || ''}`;
    });
    return { text: [header, sep, ...rows].join('\n') };
  }

  // ── firewall rules ───────────────────────────────────────────
  if (lower === 'firewall rules') {
    const rules: any[] = await apiFetch('/api/data/firewall_rules?select=id,enabled,action,source,destination,service,hit_count&order=position.asc&limit=30');
    if (!rules || rules.length === 0) return { text: 'No firewall rules found in database.' };
    const header = `${pad('ID', 5)} ${pad('Act', 8)} ${pad('Src', 18)} ${pad('Dst', 18)} ${pad('Service', 12)} Hits`;
    const sep = '─'.repeat(72);
    const rows = rules.map((r: any) =>
      `${pad(String(r.id).substring(0, 4), 5)} ${pad(r.action || 'ACCEPT', 8)} ${pad(r.source || 'any', 18)} ${pad(r.destination || 'any', 18)} ${pad(r.service || 'ALL', 12)} ${r.hit_count ?? 0}`
    );
    return { text: [header, sep, ...rows, `\nTotal: ${rules.length} rules`].join('\n') };
  }

  // ── vpn status ───────────────────────────────────────────────
  if (lower === 'vpn status') {
    try {
      const tunnels: any[] = await apiFetch('/api/data/vpn_tunnels?select=name,type,status,remote_gateway,uptime&limit=10');
      if (!tunnels || tunnels.length === 0) return { text: 'No VPN tunnels configured.\nDaemon: strongSwan/WireGuard — install with: apt install strongswan' };
      const header = `${pad('Tunnel', 16)} ${pad('Type', 8)} ${pad('Status', 8)} ${pad('Remote', 18)} Uptime`;
      const sep = '─'.repeat(70);
      const rows = tunnels.map((t: any) =>
        `${pad(t.name || '?', 16)} ${pad(t.type || 'IPsec', 8)} ${pad(t.status || 'DOWN', 8)} ${pad(t.remote_gateway || '—', 18)} ${t.uptime ?? '—'}`
      );
      return { text: [header, sep, ...rows].join('\n') };
    } catch {
      return { text: 'VPN: strongSwan/WireGuard not installed.\nInstall: apt install strongswan wireguard' };
    }
  }

  // ── version ──────────────────────────────────────────────────
  if (lower === 'version') {
    let settings: any[] = [];
    try { settings = await apiFetch('/api/data/system_settings?select=key,value'); } catch { /* ignore */ }
    const serial = settings.find((s: any) => s.key === 'serial_number')?.value ?? 'SGW-UNKNOWN';
    const hostname = settings.find((s: any) => s.key === 'hostname')?.value ?? 'sonaro-gw-01';
    return {
      text: [
        `Sonaro Gate 2025.1 LTS (build 2025.04)`,
        `Hostname:  ${hostname}`,
        `Serial:    ${serial}`,
        `Kernel:    Linux 6.8 (Ubuntu 24.04 LTS)`,
        `Platform:  x86_64`,
        `iptables:  ${typeof window !== 'undefined' ? 'check with: iptables -V' : 'n/a'}`,
        `Suricata:  check with: systemctl status suricata`,
      ].join('\n'),
    };
  }

  return null; // not a DB command
}

// ── Main command dispatcher ─────────────────────────────────────
async function executeCommand(cmd: string): Promise<{ text: string; isError?: boolean }> {
  const raw = cmd.trim();
  const lower = raw.toLowerCase();

  if (lower === 'help' || lower === '?') return { text: HELP_TEXT };
  if (lower === 'clear') return { text: '__CLEAR__' };
  if (lower === 'exit' || lower === 'quit') return { text: '__EXIT__' };

  // Try DB-backed commands first
  try {
    const dbResult = await executeDbCommand(raw);
    if (dbResult !== null) return dbResult;
  } catch (err: any) {
    return { text: `Error: ${err.message}`, isError: true };
  }

  // Forward all other commands to the real Linux backend
  try {
    const { stdout, stderr, exitCode } = await cliExec(raw);
    const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
    return {
      text: combined || `(no output — exit code ${exitCode})`,
      isError: exitCode !== 0 && !stdout,
    };
  } catch (err: any) {
    return { text: `Error communicating with server: ${err.message}`, isError: true };
  }
}

// ── Tab-completion list ────────────────────────────────────────
const COMMANDS = [
  'help', 'status', 'cpu', 'memory', 'disk', 'uptime', 'version', 'sessions',
  'interfaces', 'routes', 'firewall rules', 'vpn status',
  'ping ', 'ip addr', 'ip route', 'ip neigh', 'ifconfig', 'arp',
  'ss -tulpn', 'netstat -tulpn',
  'dig ', 'nslookup ', 'host ',
  'iptables -L -n -v', 'ip6tables -L -n -v',
  'df -h', 'free -h', 'top -bn1', 'ps aux',
  'uname -a', 'hostname', 'date', 'id', 'uptime',
  'systemctl status ', 'journalctl -n 50',
  'traceroute ', 'mtr ', 'nmap ',
  'curl -sI ', 'cat /proc/net/dev', 'cat /etc/resolv.conf', 'cat /etc/hosts',
  'cat /proc/meminfo', 'cat /proc/cpuinfo', 'cat /etc/os-release',
  'clear', 'exit',
];

// ── Component ──────────────────────────────────────────────────
interface CLIConsoleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CLIConsole({ open, onOpenChange }: CLIConsoleProps) {
  const [lines, setLines] = useState<CLILine[]>([
    { type: 'system', text: 'Sonaro Gate CLI 2025.1 LTS — Real Linux Command Interface' },
    { type: 'system', text: 'Type "help" for available commands. ↑↓ history · Tab complete · exit to close.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd || busy) return;

    setLines(prev => [...prev, { type: 'input', text: cmd }]);
    setHistory(prev => [cmd, ...prev].slice(0, 100));
    setHistoryIndex(-1);
    setInput('');

    if (cmd.toLowerCase() === 'clear') {
      setLines([{ type: 'system', text: 'Console cleared.' }]);
      return;
    }
    if (cmd.toLowerCase() === 'exit' || cmd.toLowerCase() === 'quit') {
      onOpenChange(false);
      return;
    }

    setBusy(true);
    setLines(prev => [...prev, { type: 'pending', text: `Executing…` }]);

    try {
      const result = await executeCommand(cmd);
      setLines(prev => {
        const withoutPending = prev.filter(l => l.type !== 'pending');
        return [...withoutPending, { type: result.isError ? 'error' : 'output', text: result.text }];
      });
    } catch (err: any) {
      setLines(prev => {
        const withoutPending = prev.filter(l => l.type !== 'pending');
        return [...withoutPending, { type: 'error', text: `Error: ${err.message}` }];
      });
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, busy, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(historyIndex + 1, history.length - 1);
      if (newIdx >= 0 && history[newIdx]) { setHistoryIndex(newIdx); setInput(history[newIdx]); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) { const newIdx = historyIndex - 1; setHistoryIndex(newIdx); setInput(history[newIdx]); }
      else { setHistoryIndex(-1); setInput(''); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const lower = input.toLowerCase();
      const match = COMMANDS.find(c => c.startsWith(lower) && c !== lower);
      if (match) setInput(match);
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      setBusy(false);
      setLines(prev => prev.filter(l => l.type !== 'pending'));
      setInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 gap-0 overflow-hidden"
        style={{ background: '#0d1117', border: '1px solid #30363d' }}
        aria-describedby={undefined}
      >
        <VisuallyHidden><DialogTitle>Sonaro Gate CLI Console</DialogTitle></VisuallyHidden>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: '#161b22', borderColor: '#30363d' }}>
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-[11px] font-mono ml-3" style={{ color: '#8b949e' }}>
            sonaro-cli — admin@sonaro-gw-01
          </span>
          <div className="flex-1" />
          <span className="text-[10px] font-mono" style={{ color: '#3d444d' }}>Ctrl+` to toggle</span>
        </div>

        {/* Terminal body */}
        <div
          ref={scrollRef}
          className="h-[480px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed"
          style={{ background: '#0d1117', color: '#c9d1d9' }}
          onClick={() => inputRef.current?.focus()}
        >
          {lines.map((line, i) => {
            if (line.type === 'input') {
              return (
                <div key={i} className="flex items-start gap-0 mt-1">
                  <span style={{ color: '#3fb950' }}>admin@sonaro</span>
                  <span style={{ color: '#6e7681' }}>:</span>
                  <span style={{ color: '#79c0ff' }}>~</span>
                  <span style={{ color: '#6e7681' }}>$&nbsp;</span>
                  <span style={{ color: '#e6edf3' }}>{line.text}</span>
                </div>
              );
            }
            if (line.type === 'pending') {
              return (
                <div key={i} className="flex items-center gap-2 mt-0.5" style={{ color: '#8b949e' }}>
                  <span className="inline-block animate-spin">⟳</span>
                  <span>{line.text}</span>
                </div>
              );
            }
            if (line.type === 'error') {
              return (
                <div key={i} className="whitespace-pre-wrap mt-0.5" style={{ color: '#f85149' }}>
                  {line.text}
                </div>
              );
            }
            if (line.type === 'system') {
              return (
                <div key={i} className="whitespace-pre-wrap" style={{ color: '#58a6ff' }}>
                  {line.text}
                </div>
              );
            }
            return (
              <div key={i} className="whitespace-pre-wrap mt-0.5" style={{ color: '#c9d1d9' }}>
                {line.text}
              </div>
            );
          })}

          {/* Input row */}
          <form onSubmit={handleSubmit} className="flex items-center mt-1">
            <span style={{ color: '#3fb950', whiteSpace: 'nowrap' }}>admin@sonaro</span>
            <span style={{ color: '#6e7681' }}>:</span>
            <span style={{ color: '#79c0ff' }}>~</span>
            <span style={{ color: '#6e7681' }}>$&nbsp;</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              className="flex-1 bg-transparent outline-none border-none font-mono text-[12px]"
              style={{ color: '#e6edf3', caretColor: '#3fb950' }}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
            />
            {busy && (
              <span
                className="text-[10px] ml-2 cursor-pointer animate-pulse"
                style={{ color: '#8b949e' }}
                title="Ctrl+C to cancel"
              >
                running… (Ctrl+C)
              </span>
            )}
          </form>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t" style={{ background: '#161b22', borderColor: '#30363d' }}>
          <span className="text-[10px] font-mono" style={{ color: '#6e7681' }}>
            ↑↓ history · Tab complete · Ctrl+C cancel · exit to close
          </span>
          <span className="text-[10px] font-mono" style={{ color: '#3fb950' }}>● connected</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
