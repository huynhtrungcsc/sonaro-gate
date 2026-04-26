/**
 * Sonaro Gate System Agent
 * Collects real system metrics from the OS and stores them in the database.
 * On Ubuntu with real network cards, this reads actual interface stats,
 * CPU/memory usage, and network traffic counters.
 */

import si from 'systeminformation';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from './db.js';
import { systemMetrics, trafficStats, networkInterfaces, systemSettings } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { broadcast } from './ws.js';

const execAsync = promisify(exec);

let previousNetStats: Record<string, { rx: number; tx: number; ts: number }> = {};

/**
 * Read hardware serial number from DMI subsystem (Linux only).
 * Priority: /sys/class/dmi/id/product_serial → dmidecode → MAC-based fallback
 * Stores result in system_settings only when a real serial is found.
 */
async function captureHardwareSerial() {
  try {
    const dmiPaths = [
      '/sys/class/dmi/id/product_serial',
      '/sys/class/dmi/id/chassis_serial',
      '/sys/class/dmi/id/board_serial',
    ];

    let serial: string | null = null;

    for (const p of dmiPaths) {
      try {
        const val = fs.readFileSync(p, 'utf8').trim();
        if (val && val.toLowerCase() !== 'to be filled by o.e.m.' &&
            val.toLowerCase() !== 'none' && val.toLowerCase() !== 'n/a' &&
            val !== '0' && val.length > 2) {
          serial = val;
          break;
        }
      } catch { /* no access or not present */ }
    }

    // Try dmidecode as fallback (requires root)
    if (!serial) {
      try {
        const { stdout } = await execAsync('dmidecode -s system-serial-number 2>/dev/null');
        const val = stdout.trim();
        if (val && val.toLowerCase() !== 'to be filled by o.e.m.' &&
            val.toLowerCase() !== 'none' && val.length > 2) {
          serial = val;
        }
      } catch { /* dmidecode not available */ }
    }

    // MAC-based fallback: deterministic per machine
    if (!serial) {
      try {
        const ifaces = await si.networkInterfaces();
        const iface = (Array.isArray(ifaces) ? ifaces : [ifaces]).find(
          i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00'
        );
        if (iface?.mac) {
          serial = 'SGW-' + iface.mac.replace(/:/g, '').toUpperCase();
        }
      } catch { /* skip */ }
    }

    if (!serial) return;

    // Upsert into system_settings
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'serial_number'))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(systemSettings).values({
        key: 'serial_number',
        value: serial,
        description: 'Hardware serial number (auto-detected)',
      });
    } else if (existing[0].value === 'SONARO-GATE' || existing[0].value === '') {
      // Replace placeholder with real serial
      await db.update(systemSettings)
        .set({ value: serial, updated_at: new Date() })
        .where(eq(systemSettings.key, 'serial_number'));
    }

    console.log(`[Agent] Serial number: ${serial}`);
  } catch (err) {
    console.error('[Agent] Failed to capture hardware serial:', err);
  }
}

/**
 * Detect which interface is the WAN (has the default route).
 * Uses `ip route show default` on Linux, falls back to name-based heuristic.
 */
async function detectWanInterface(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('ip route show default 2>/dev/null');
    // e.g. "default via 10.0.0.1 dev ens3 proto dhcp ..."
    const match = stdout.match(/dev\s+(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Classify an interface as WAN / LAN / OPT based on its name and
 * whether it carries the default route. On Ubuntu VMs:
 *  - WAN  = the interface with the default route
 *  - LAN  = first other physical interface
 *  - OPT  = remaining physical interfaces
 * Wireless interfaces are always OPT.
 */
function classifyInterface(ifaceName: string, wanIface: string | null, phyIndex: number): string {
  if (ifaceName.startsWith('wlan') || ifaceName.startsWith('wlp')) return 'OPT';
  if (wanIface && ifaceName === wanIface) return 'WAN';
  // If we couldn't detect WAN via routing, fall back to:
  // first physical → WAN, second → LAN, rest → OPT
  if (!wanIface) {
    if (phyIndex === 0) return 'WAN';
    if (phyIndex === 1) return 'LAN';
    return 'OPT';
  }
  // Known WAN was detected — first non-WAN is LAN, rest are OPT
  if (phyIndex === 0) return 'LAN';
  return 'OPT';
}

async function collectSystemMetrics() {
  try {
    const [cpu, mem, disks, cpuTemp, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.cpuTemperature().catch(() => ({ main: 0 })),
      si.osInfo().catch(() => ({ hostname: os.hostname() })),
    ]);

    const primaryDisk = disks[0] ?? { size: 0, used: 0, available: 0 };
    const hostname = (osInfo as any).hostname || os.hostname();

    const metricsPayload = {
      hostname,
      uptime: Math.floor(os.uptime()),
      cpu_usage: Math.round(cpu.currentLoad * 100) / 100,
      cpu_cores: os.cpus().length,
      cpu_temperature: Math.round(((cpuTemp as any).main || 0) * 100) / 100,
      memory_total: mem.total,
      memory_used: mem.active,
      memory_free: mem.free,
      memory_cached: mem.cached || 0,
      disk_total: primaryDisk.size,
      disk_used: primaryDisk.used,
      disk_free: primaryDisk.available || primaryDisk.size - primaryDisk.used,
      load_1m: os.loadavg()[0],
      load_5m: os.loadavg()[1],
      load_15m: os.loadavg()[2],
    };

    await db.insert(systemMetrics).values({
      hostname: metricsPayload.hostname,
      uptime: metricsPayload.uptime,
      cpu_usage: String(metricsPayload.cpu_usage),
      cpu_cores: metricsPayload.cpu_cores,
      cpu_temperature: String(metricsPayload.cpu_temperature),
      memory_total: metricsPayload.memory_total,
      memory_used: metricsPayload.memory_used,
      memory_free: metricsPayload.memory_free,
      memory_cached: metricsPayload.memory_cached,
      disk_total: metricsPayload.disk_total,
      disk_used: metricsPayload.disk_used,
      disk_free: metricsPayload.disk_free,
      load_1m: String(metricsPayload.load_1m),
      load_5m: String(metricsPayload.load_5m),
      load_15m: String(metricsPayload.load_15m),
    });

    // Push live to all WebSocket clients instantly
    broadcast('metrics', metricsPayload);

    // Keep only the last 200 metric rows
    const rows = await db
      .select({ id: systemMetrics.id })
      .from(systemMetrics)
      .orderBy(systemMetrics.recorded_at);

    if (rows.length > 200) {
      const toDelete = rows.slice(0, rows.length - 200);
      for (const r of toDelete) {
        await db.delete(systemMetrics).where(eq(systemMetrics.id, r.id));
      }
    }
  } catch (err) {
    console.error('[Agent] Failed to collect system metrics:', err);
  }
}

async function collectNetworkStats() {
  try {
    const nets = await si.networkStats();
    const now = Date.now();

    for (const net of nets) {
      const iface = net.iface;
      const prev = previousNetStats[iface];
      const currRx = net.rx_bytes;
      const currTx = net.tx_bytes;

      if (prev) {
        const dt = (now - prev.ts) / 1000; // seconds
        const rx = Math.max(0, currRx - prev.rx);
        const tx = Math.max(0, currTx - prev.tx);

        if (dt > 0) {
          await db.insert(trafficStats).values({
            interface: iface,
            inbound: rx,
            outbound: tx,
            blocked: 0,
          });
        }
      }

      previousNetStats[iface] = { rx: currRx, tx: currTx, ts: now };
    }

    // Push aggregate live traffic to all WebSocket clients
    try {
      const latestStats = await db
        .select()
        .from(trafficStats)
        .orderBy(trafficStats.recorded_at)
        .limit(10);
      broadcast('traffic', latestStats);
    } catch { /* ignore */ }

    // Keep only last 1000 traffic_stats rows
    const rows = await db
      .select({ id: trafficStats.id })
      .from(trafficStats)
      .orderBy(trafficStats.recorded_at);

    if (rows.length > 1000) {
      const toDelete = rows.slice(0, rows.length - 1000);
      for (const r of toDelete) {
        await db.delete(trafficStats).where(eq(trafficStats.id, r.id));
      }
    }
  } catch (err) {
    console.error('[Agent] Failed to collect network stats:', err);
  }
}

/**
 * Detect whether an interface is using DHCP or static IP.
 * Checks `ip route show dev IFACE` for 'proto dhcp'.
 * On systemd-networkd also checks /run/systemd/netif/leases/.
 */
async function detectIpMode(ifaceName: string): Promise<'dhcp' | 'static' | 'unconfigured'> {
  try {
    // Method 1: ip route — if any route has 'proto dhcp' for this iface → DHCP
    const { stdout: routes } = await execAsync(`ip route show dev ${ifaceName} 2>/dev/null`).catch(() => ({ stdout: '' }));
    if (routes.includes('proto dhcp')) return 'dhcp';

    // Method 2: check systemd-networkd lease files
    // Interface index from ip link show
    const { stdout: link } = await execAsync(`ip link show ${ifaceName} 2>/dev/null`).catch(() => ({ stdout: '' }));
    const indexMatch = link.match(/^(\d+):/m);
    if (indexMatch) {
      const idx = indexMatch[1];
      const leaseExists = await execAsync(`test -f /run/systemd/netif/leases/${idx} && echo yes`).then(r => r.stdout.includes('yes')).catch(() => false);
      if (leaseExists) return 'dhcp';
    }

    // Method 3: check if dhclient is running for this interface
    const { stdout: ps } = await execAsync(`pgrep -a dhclient 2>/dev/null || true`).catch(() => ({ stdout: '' }));
    if (ps.includes(ifaceName)) return 'dhcp';

    // Method 4: check netplan config for this interface
    const { stdout: netplanFiles } = await execAsync(`ls /etc/netplan/*.yaml 2>/dev/null || true`).catch(() => ({ stdout: '' }));
    for (const f of netplanFiles.trim().split('\n').filter(Boolean)) {
      const { stdout: content } = await execAsync(`cat "${f}" 2>/dev/null`).catch(() => ({ stdout: '' }));
      if (content.includes(ifaceName)) {
        if (content.includes('dhcp4: true') || content.includes('dhcp4:true')) return 'dhcp';
        if (content.includes('addresses:') || content.includes('dhcp4: false')) return 'static';
      }
    }

    // Has an IP assigned → assume static (manually configured or other DHCP client)
    const { stdout: addr } = await execAsync(`ip addr show dev ${ifaceName} 2>/dev/null`).catch(() => ({ stdout: '' }));
    if (addr.includes('inet ')) return 'static';

    return 'unconfigured';
  } catch {
    return 'unconfigured';
  }
}

/**
 * Convert a CIDR prefix length (e.g. 24) to a dotted-decimal subnet mask.
 */
function prefixToMask(prefix: number): string {
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join('.');
}

/**
 * Return true if the interface name is a virtual / internal interface that
 * should be excluded from the firewall management console.
 */
function isVirtualIface(name: string): boolean {
  if (name === 'lo') return true;
  if (name.startsWith('docker')) return true;
  if (name.startsWith('veth')) return true;
  if (name.startsWith('br-')) return true;
  if (name.startsWith('virbr')) return true;
  if (name.startsWith('tun')) return true;
  if (name.startsWith('tap')) return true;
  if (name.startsWith('dummy')) return true;
  return false;
}

async function syncRealNetworkInterfaces() {
  try {
    // ── Primary source: `ip -j link show` ──────────────────────────────────
    // This is the authoritative list of ALL kernel interfaces, including
    // interfaces that are DOWN and have no IP address assigned — which
    // systeminformation skips because it filters by having an IPv4/IPv6 addr.
    const { stdout: linkRaw } = await execAsync('ip -j link show 2>/dev/null').catch(() => ({ stdout: '[]' }));
    const { stdout: addrRaw } = await execAsync('ip -j addr show 2>/dev/null').catch(() => ({ stdout: '[]' }));

    let links: any[] = [];
    let addrs: any[] = [];
    try { links = JSON.parse(linkRaw); } catch { /* ip not available (dev env) */ }
    try { addrs = JSON.parse(addrRaw); } catch { /* ip not available (dev env) */ }

    // Build lookup: ifname → addr info
    const addrMap: Record<string, any> = {};
    for (const a of addrs) addrMap[a.ifname] = a;

    // ── Supplementary: systeminformation for speed / duplex / traffic stats ─
    const [siNets, netStats, wanIface] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats(),
      detectWanInterface(),
    ]);

    const siArr = Array.isArray(siNets) ? siNets : [siNets];
    const siMap: Record<string, any> = {};
    for (const n of siArr) siMap[n.iface] = n;

    const statMap: Record<string, any> = {};
    for (const s of netStats) statMap[s.iface] = s;

    // ── If `ip` command unavailable (development), fall back to si list ─────
    const useIpCmd = links.length > 0;
    const physicalLinks = useIpCmd
      ? links.filter(l => !isVirtualIface(l.ifname) && l.link_type !== 'loopback')
      : siArr
          .filter(i => !i.internal && !isVirtualIface(i.iface))
          .map(i => ({ ifname: i.iface, operstate: i.operstate, address: i.mac, mtu: i.mtu, flags: [] }));

    // Build ordered list of non-WAN interfaces for index-based type assignment
    const nonWanLinks = physicalLinks.filter(l => l.ifname !== wanIface);

    for (const link of physicalLinks) {
      const name: string = link.ifname;
      const siInfo = siMap[name] ?? {};
      const stat   = statMap[name] ?? {};
      const addrInfo = addrMap[name];

      // ── IP address from `ip addr show` ─────────────────────────────────
      const inet = addrInfo?.addr_info?.find((a: any) => a.family === 'inet');
      const ip     = inet?.local ?? (siInfo.ip4 && siInfo.ip4.trim() ? siInfo.ip4.trim() : null);
      const subnet = inet
        ? prefixToMask(inet.prefixlen)
        : (siInfo.ip4subnet && siInfo.ip4subnet.trim() ? siInfo.ip4subnet.trim() : null);

      // ── Link state ──────────────────────────────────────────────────────
      // `ip link show` reports 'UP' / 'DOWN' / 'UNKNOWN'
      // UNKNOWN on virtual NICs that are technically active → treat as up
      const opState: string = (link.operstate ?? siInfo.operstate ?? 'unknown').toUpperCase();
      const status  = (opState === 'UP' || opState === 'UNKNOWN') ? 'up' : 'down';

      // ── Interface type (WAN / LAN / OPT) ───────────────────────────────
      const isWan = wanIface ? name === wanIface : physicalLinks.indexOf(link) === 0;
      let type: string;
      if (isWan) {
        type = 'WAN';
      } else {
        const idx = nonWanLinks.findIndex(l => l.ifname === name);
        type = idx === 0 ? 'LAN' : 'OPT';
      }

      // ── Speed / duplex from systeminformation (ethtool-based) ───────────
      const speedRaw = siInfo.speed;
      const speed    = (speedRaw && speedRaw > 0) ? `${speedRaw} Mbps` : null;
      const duplex   = siInfo.duplex && siInfo.duplex.trim() ? siInfo.duplex.trim() : 'full';

      const mac  = link.address ?? siInfo.mac ?? null;
      const mtu  = link.mtu ?? siInfo.mtu ?? 1500;

      // ── IP mode (DHCP / static / unconfigured) ──────────────────────────
      const ip_mode = await detectIpMode(name);

      const data = {
        name,
        type,
        status,
        ip_address: ip,
        subnet,
        mac,
        speed,
        duplex,
        mtu,
        ip_mode,
        rx_bytes:    stat.rx_bytes    || 0,
        tx_bytes:    stat.tx_bytes    || 0,
        rx_packets:  stat.rx_packets  || 0,
        tx_packets:  stat.tx_packets  || 0,
      };

      const existing = await db
        .select()
        .from(networkInterfaces)
        .where(eq(networkInterfaces.name, name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(networkInterfaces).values(data);
        console.log(`[Agent] Discovered: ${name} (${type}) ${ip ?? 'no IP'} [${ip_mode}] [${status}]`);
      } else {
        const existingRecord = existing[0];

        // Always refresh hardware/link stats.
        const updateData: Record<string, any> = {
          status:      data.status,
          speed:       data.speed,
          duplex:      data.duplex,
          mac:         data.mac,
          mtu:         data.mtu,
          rx_bytes:    data.rx_bytes,
          tx_bytes:    data.tx_bytes,
          rx_packets:  data.rx_packets,
          tx_packets:  data.tx_packets,
          updated_at:  new Date(),
        };

        // For DHCP interfaces: refresh ip_address/subnet from OS so the UI shows
        // the currently leased address (DHCP leases change dynamically).
        // For static/unconfigured interfaces: preserve the operator-configured values
        // — do NOT let the agent clobber them with OS state that may lag behind.
        if (existingRecord.ip_mode === 'dhcp') {
          updateData.ip_address = data.ip_address;
          updateData.subnet     = data.subnet;
        }

        // ip_mode is NEVER overwritten by the agent — it reflects operator intent,
        // not transient OS state (e.g. a stale dhclient process).

        await db
          .update(networkInterfaces)
          .set(updateData)
          .where(eq(networkInterfaces.name, name));
      }
    }
  } catch (err) {
    console.error('[Agent] Failed to sync network interfaces:', err);
  }
}

export function startAgent() {
  console.log('[Agent] Starting system data collector...');

  // One-time hardware identification
  captureHardwareSerial();

  // Initial collection
  syncRealNetworkInterfaces();
  collectSystemMetrics();
  collectNetworkStats();

  // Periodic collection
  setInterval(collectSystemMetrics, 30_000);        // every 30s
  setInterval(collectNetworkStats, 60_000);          // every 60s
  setInterval(syncRealNetworkInterfaces, 120_000);   // every 2min

  console.log('[Agent] Collector running — metrics will update every 30s');
}
