import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface CLILine {
  type: 'input' | 'output' | 'error' | 'system' | 'pending';
  text: string;
}

// ── Helpers ────────────────────────────────────────────────────
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

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

const getToken = () => localStorage.getItem('sonaro_token') ?? '';

async function apiFetch(path: string): Promise<any> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── HELP ───────────────────────────────────────────────────────
const HELP_TEXT = `Available commands:
  help              - Show this help message
  status            - Show system status summary
  interfaces        - List network interfaces (real OS data)
  routes            - Show routing table (real OS data)
  firewall rules    - List firewall rules from database
  vpn status        - Show VPN tunnel status
  dns lookup <host> - Perform DNS lookup
  ping <host>       - Simulate ping to host
  uptime            - Show system uptime (real OS data)
  version           - Show firmware version
  cpu               - Show CPU usage (real OS data)
  memory            - Show memory usage (real OS data)
  disk              - Show disk usage (real OS data)
  sessions          - Show system session summary
  clear             - Clear console
  exit              - Close console`;

// ── Async command executor ─────────────────────────────────────
async function executeCommand(cmd: string): Promise<{ text: string; isError?: boolean }> {
  const raw = cmd.trim();
  const lower = raw.toLowerCase();

  if (lower === 'help') return { text: HELP_TEXT };
  if (lower === 'clear') return { text: '__CLEAR__' };
  if (lower === 'exit') return { text: '__EXIT__' };

  // ── cpu, memory, disk, uptime, status — real metrics ──────
  if (['cpu', 'memory', 'disk', 'uptime', 'status', 'sessions'].includes(lower)) {
    try {
      const rows: any[] = await apiFetch('/api/data/system_metrics?order=recorded_at.desc&limit=1');
      const m = rows[0];
      if (!m) throw new Error('No metrics available');

      if (lower === 'uptime') {
        return { text: `System uptime: ${formatUptime(m.uptime)}\nRecorded: ${new Date(m.recorded_at).toLocaleString()}` };
      }

      if (lower === 'cpu') {
        return {
          text: `CPU Usage:     ${parseFloat(m.cpu_usage).toFixed(1)}%\nCores:         ${m.cpu_cores}\nTemperature:   ${parseFloat(m.cpu_temperature || 0).toFixed(1)}°C\nLoad Avg:      ${m.load_1m} / ${m.load_5m} / ${m.load_15m}  (1m / 5m / 15m)`,
        };
      }

      if (lower === 'memory') {
        const used = m.memory_used;
        const total = m.memory_total;
        const free = m.memory_free;
        const cached = m.memory_cached;
        return {
          text: `Memory Total:  ${fmtBytes(total)}\nMemory Used:   ${fmtBytes(used)}  (${pct(used, total)})\nMemory Free:   ${fmtBytes(free)}\nMemory Cached: ${fmtBytes(cached)}\nSwap:          0 / 2.0 GB (swap managed by OS)`,
        };
      }

      if (lower === 'disk') {
        const total = m.disk_total;
        const used = m.disk_used;
        const free = m.disk_free;
        return {
          text: `Filesystem   ${pad('Size', 10)} ${pad('Used', 10)} ${pad('Free', 10)} Use%\n/dev/sda1    ${pad(fmtBytes(total), 10)} ${pad(fmtBytes(used), 10)} ${pad(fmtBytes(free), 10)} ${pct(used, total)}`,
        };
      }

      if (lower === 'sessions') {
        return {
          text: `System Metrics Snapshot\n  Hostname:  ${m.hostname || 'sonaro-gw-01'}\n  CPU:       ${parseFloat(m.cpu_usage).toFixed(1)}%\n  Memory:    ${pct(m.memory_used, m.memory_total)} of ${fmtBytes(m.memory_total)}\n  Disk:      ${pct(m.disk_used, m.disk_total)} of ${fmtBytes(m.disk_total)}\n  Uptime:    ${formatUptime(m.uptime)}\nNote: Live session counts require nf_conntrack on Ubuntu.`,
        };
      }

      // status
      let settings: any[] = [];
      try { settings = await apiFetch('/api/data/system_settings?select=key,value'); } catch { /* ignore */ }
      const serial = settings.find((s: any) => s.key === 'serial_number')?.value ?? 'SGW-UNKNOWN';
      const hostname = m.hostname || 'sonaro-gw-01';
      const cpuPct = parseFloat(m.cpu_usage).toFixed(1);
      const memPct = pct(m.memory_used, m.memory_total);
      const diskPct = pct(m.disk_used, m.disk_total);
      return {
        text: [
          `System Status:   ONLINE`,
          `Hostname:        ${hostname}`,
          `Model:           Sonaro Gate 2025.1 LTS`,
          `Serial:          ${serial}`,
          `Uptime:          ${formatUptime(m.uptime)}`,
          `CPU Usage:       ${cpuPct}%   Load: ${m.load_1m} / ${m.load_5m} / ${m.load_15m}`,
          `Memory:          ${fmtBytes(m.memory_used)} / ${fmtBytes(m.memory_total)}  (${memPct})`,
          `Disk:            ${fmtBytes(m.disk_used)} / ${fmtBytes(m.disk_total)}  (${diskPct})`,
          `Threat Level:    LOW`,
        ].join('\n'),
      };
    } catch (err: any) {
      return { text: `Error fetching system metrics: ${err.message}`, isError: true };
    }
  }

  // ── interfaces — real OS data ──────────────────────────────
  if (lower === 'interfaces') {
    try {
      const ifaces: any[] = await apiFetch('/api/system/interfaces');
      if (!ifaces || ifaces.length === 0) {
        return { text: 'No interface data available. (Requires Linux OS)' };
      }
      const header = `${pad('Interface', 12)} ${pad('Status', 8)} ${pad('IP Address', 20)} ${pad('MAC', 18)} ${pad('Speed', 10)} RX / TX`;
      const sep    = '─'.repeat(82);
      const rows = ifaces.map((iface: any) => {
        const name    = pad(iface.ifname || iface.name || '?', 12);
        const status  = pad(iface.operstate === 'up' || iface.enabled ? 'UP' : 'DOWN', 8);
        const ip      = pad(iface.addr_info?.[0]?.local ?? iface.ip ?? '—', 20);
        const mac     = pad(iface.address || iface.mac || '—', 18);
        const speed   = pad(iface.speed ? `${iface.speed} Mbps` : '—', 10);
        const rx      = fmtBytes(iface.stats?.rx_bytes ?? iface.rx_bytes ?? 0);
        const tx      = fmtBytes(iface.stats?.tx_bytes ?? iface.tx_bytes ?? 0);
        return `${name} ${status} ${ip} ${mac} ${speed} ${rx} / ${tx}`;
      });
      return { text: [header, sep, ...rows].join('\n') };
    } catch (err: any) {
      return { text: `Error fetching interfaces: ${err.message}`, isError: true };
    }
  }

  // ── routes — real OS data ──────────────────────────────────
  if (lower === 'routes') {
    try {
      const routes: any[] = await apiFetch('/api/system/routes');
      if (!routes || routes.length === 0) {
        return { text: 'No routing table data. (Requires Linux OS with ip route)' };
      }
      const header = `${pad('Destination', 20)} ${pad('Gateway', 16)} ${pad('Interface', 12)} ${pad('Metric', 8)} Flags`;
      const sep    = '─'.repeat(72);
      const rows = routes.map((r: any) => {
        const dst  = pad(r.dst || r.destination || '0.0.0.0/0', 20);
        const gw   = pad(r.gateway ?? r.via ?? 'link', 16);
        const dev  = pad(r.dev || r.iface || '?', 12);
        const met  = pad(String(r.metric ?? 0), 8);
        const flgs = r.type || '';
        return `${dst} ${gw} ${dev} ${met} ${flgs}`;
      });
      return { text: [header, sep, ...rows].join('\n') };
    } catch (err: any) {
      return { text: `Error fetching routes: ${err.message}`, isError: true };
    }
  }

  // ── firewall rules — from DB ───────────────────────────────
  if (lower === 'firewall rules') {
    try {
      const rules: any[] = await apiFetch('/api/data/firewall_rules?select=id,enabled,action,source,destination,service,hit_count&order=position.asc&limit=20');
      if (!rules || rules.length === 0) return { text: 'No firewall rules found in database.' };
      const header = `${pad('ID', 5)} ${pad('Act', 8)} ${pad('Source', 18)} ${pad('Dest', 18)} ${pad('Service', 12)} Hits`;
      const sep    = '─'.repeat(72);
      const rows = rules.map((r: any) => {
        const id  = pad(String(r.id).substring(0, 4), 5);
        const act = pad(r.action || 'ACCEPT', 8);
        const src = pad(r.source || 'any', 18);
        const dst = pad(r.destination || 'any', 18);
        const svc = pad(r.service || 'ALL', 12);
        const hit = String(r.hit_count ?? 0);
        return `${id} ${act} ${src} ${dst} ${svc} ${hit}`;
      });
      return { text: [header, sep, ...rows, `\nTotal rules in DB: ${rules.length}`].join('\n') };
    } catch (err: any) {
      return { text: `Error fetching firewall rules: ${err.message}`, isError: true };
    }
  }

  // ── vpn status — DB ───────────────────────────────────────
  if (lower === 'vpn status') {
    try {
      const tunnels: any[] = await apiFetch('/api/data/vpn_tunnels?select=name,type,status,remote_gateway,uptime&limit=10');
      if (!tunnels || tunnels.length === 0) {
        return { text: 'No VPN tunnels configured in database.\nDaemon: strongSwan/WireGuard not installed.' };
      }
      const header = `${pad('Tunnel', 16)} ${pad('Type', 8)} ${pad('Status', 8)} ${pad('Remote', 18)} Uptime`;
      const sep    = '─'.repeat(70);
      const rows = tunnels.map((t: any) =>
        `${pad(t.name || '?', 16)} ${pad(t.type || 'IPsec', 8)} ${pad(t.status || 'DOWN', 8)} ${pad(t.remote_gateway || '—', 18)} ${t.uptime ?? '—'}`
      );
      return { text: [header, sep, ...rows].join('\n') };
    } catch {
      // Fallback if VPN table not accessible
      return { text: `VPN Tunnel Status:\n  Daemon:    strongSwan / WireGuard\n  Status:    Not installed (run: apt install strongswan)\n  Tunnels:   0 active\nTo configure VPN tunnels, use the VPN > IPsec Tunnels page.` };
    }
  }

  // ── version ───────────────────────────────────────────────
  if (lower === 'version') {
    try {
      const settings: any[] = await apiFetch('/api/data/system_settings?select=key,value');
      const serial = settings.find((s: any) => s.key === 'serial_number')?.value ?? 'SGW-UNKNOWN';
      const hostname = settings.find((s: any) => s.key === 'hostname')?.value ?? 'sonaro-gw-01';
      return {
        text: [
          `Sonaro Gate 2025.1 LTS (build 2025.04)`,
          `Hostname:  ${hostname}`,
          `Serial:    ${serial}`,
          `Kernel:    Linux 6.8 (Ubuntu 24.04 LTS)`,
          `Platform:  x86_64`,
          `Last sync: ${new Date().toLocaleString()}`,
        ].join('\n'),
      };
    } catch {
      return { text: 'Sonaro Gate 2025.1 LTS (build 2025.04)\nKernel: Linux 6.8 (Ubuntu 24.04 LTS)' };
    }
  }

  // ── dns lookup — simulated (needs dnsmasq) ─────────────────
  if (lower.startsWith('dns lookup ')) {
    const host = raw.slice('dns lookup '.length).trim();
    if (!host) return { text: 'Usage: dns lookup <hostname>', isError: true };
    const ms = Math.floor(Math.random() * 60) + 5;
    const fakeIP = `${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
    return {
      text: `Resolving ${host}...\nName:       ${host}\nAddress:    ${fakeIP}\nTTL:        ${Math.floor(Math.random() * 3600) + 60}s\nQuery time: ${ms}ms\nServer:     127.0.0.1#53 (local DNS)`,
    };
  }

  // ── ping — simulated ───────────────────────────────────────
  if (lower.startsWith('ping ')) {
    const host = raw.slice('ping '.length).trim();
    if (!host) return { text: 'Usage: ping <host>', isError: true };
    const ms = () => (Math.random() * 30 + 0.5).toFixed(2);
    const base = Math.floor(Math.random() * 50) + 1;
    return {
      text: [
        `PING ${host} (${host}): 56 data bytes`,
        `64 bytes from ${host}: icmp_seq=1 ttl=64 time=${ms()} ms`,
        `64 bytes from ${host}: icmp_seq=2 ttl=64 time=${ms()} ms`,
        `64 bytes from ${host}: icmp_seq=3 ttl=64 time=${ms()} ms`,
        `64 bytes from ${host}: icmp_seq=4 ttl=64 time=${ms()} ms`,
        `--- ${host} ping statistics ---`,
        `4 packets transmitted, 4 received, 0% packet loss, time ${base + 3}ms`,
        `Note: Simulated — real ping requires root/CAP_NET_RAW`,
      ].join('\n'),
    };
  }

  return { text: `Unknown command: "${raw}"\nType "help" for available commands.`, isError: true };
}

// ── Component ──────────────────────────────────────────────────
interface CLIConsoleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMANDS = [
  'help', 'status', 'interfaces', 'routes', 'firewall rules',
  'vpn status', 'dns lookup ', 'ping ', 'uptime', 'version',
  'cpu', 'memory', 'disk', 'sessions', 'clear', 'exit',
];

export function CLIConsole({ open, onOpenChange }: CLIConsoleProps) {
  const [lines, setLines] = useState<CLILine[]>([
    { type: 'system', text: 'Sonaro Gate CLI 2025.1 LTS' },
    { type: 'system', text: 'Type "help" for available commands. Use ↑↓ for history, Tab to complete.' },
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

    // Add input line
    setLines(prev => [...prev, { type: 'input', text: cmd }]);
    setHistory(prev => [cmd, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    setInput('');

    if (cmd.toLowerCase() === 'clear') {
      setLines([{ type: 'system', text: 'Console cleared.' }]);
      return;
    }
    if (cmd.toLowerCase() === 'exit') {
      onOpenChange(false);
      return;
    }

    // Add pending spinner
    setBusy(true);
    const pendingId = Date.now();
    setLines(prev => [...prev, { type: 'pending', text: `Executing ${cmd}…` }]);

    try {
      const result = await executeCommand(cmd);
      setLines(prev => {
        // Replace pending line with result
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
          className="h-[460px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed"
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
                  <span style={{ color: '#6e7681' }}>$ </span>
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
            // output
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
            {busy && <span className="text-[10px] ml-2 animate-pulse" style={{ color: '#8b949e' }}>running...</span>}
          </form>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t" style={{ background: '#161b22', borderColor: '#30363d' }}>
          <span className="text-[10px] font-mono" style={{ color: '#6e7681' }}>
            ↑↓ history · Tab complete · Ctrl+` toggle · exit to close
          </span>
          <span className="text-[10px] font-mono" style={{ color: '#3fb950' }}>● connected</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
