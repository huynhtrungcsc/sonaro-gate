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

async function syncRealNetworkInterfaces() {
  try {
    const [nets, netStats, wanIface] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats(),
      detectWanInterface(),
    ]);

    const ifaceArray = Array.isArray(nets) ? nets : [nets];
    const statMap: Record<string, any> = {};
    for (const s of netStats) statMap[s.iface] = s;

    // Filter out loopback and virtual/tunnel interfaces for type classification
    const physicalIfaces = ifaceArray.filter(i => {
      if (i.internal) return false; // loopback
      const name = i.iface;
      // Skip docker/bridge/tun/tap/veth virtual interfaces for classification
      if (name.startsWith('docker') || name.startsWith('veth') ||
          name.startsWith('br-') || name === 'virbr0') return false;
      return true;
    });

    // Build ordered list of non-WAN physical ifaces for index-based classification
    const nonWanPhysical = physicalIfaces.filter(i => i.iface !== wanIface);

    for (const iface of physicalIfaces) {
      const stat = statMap[iface.iface] ?? {};

      // Determine type
      const isWan = wanIface ? iface.iface === wanIface : physicalIfaces.indexOf(iface) === 0;
      let type: string;
      if (isWan) {
        type = 'WAN';
      } else {
        const idx = nonWanPhysical.indexOf(iface);
        type = idx === 0 ? 'LAN' : 'OPT';
      }

      // Fix: VMs report speed = -1 for virtual NICs, treat as null
      const speedRaw = iface.speed;
      const speed = (speedRaw && speedRaw > 0) ? `${speedRaw} Mbps` : null;

      // Fix: empty string duplex from some drivers → default 'full'
      const duplex = iface.duplex && iface.duplex.trim() ? iface.duplex.trim() : 'full';

      // Fix: ip4 can be empty string on unconfigured interfaces
      const ip = iface.ip4 && iface.ip4.trim() ? iface.ip4.trim() : null;
      const subnet = iface.ip4subnet && iface.ip4subnet.trim() ? iface.ip4subnet.trim() : null;

      const data = {
        name: iface.iface,
        type,
        status: iface.operstate === 'up' ? 'up' : 'down',
        ip_address: ip,
        subnet,
        mac: iface.mac || null,
        speed,
        duplex,
        mtu: iface.mtu || 1500,
        rx_bytes: stat.rx_bytes || 0,
        tx_bytes: stat.tx_bytes || 0,
        rx_packets: stat.rx_packets || 0,
        tx_packets: stat.tx_packets || 0,
      };

      const existing = await db
        .select()
        .from(networkInterfaces)
        .where(eq(networkInterfaces.name, iface.iface))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(networkInterfaces).values(data);
        console.log(`[Agent] Discovered interface: ${iface.iface} (${type}) ${ip ?? 'no IP'}`);
      } else {
        await db
          .update(networkInterfaces)
          .set({ ...data, updated_at: new Date() })
          .where(eq(networkInterfaces.name, iface.iface));
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
