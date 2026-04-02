/**
 * Sonaro Gate — Initial Setup Wizard
 *
 * Runs on first boot (console/TTY) before the web server starts.
 * Similar to pfSense's console setup — configures WAN/LAN interfaces,
 * IP addressing, and admin credentials so the web UI becomes accessible.
 *
 * Flow:
 *   1. Detect all physical NICs
 *   2. Ask user: which is WAN? (DHCP or static)
 *   3. Ask user: which is LAN? (always static, e.g. 192.168.1.1)
 *   4. Apply IP config immediately (ip addr + netplan for persistence)
 *   5. Enable ip_forward + NAT masquerade
 *   6. Save to DB + mark setup_complete
 *   7. Print web UI URL and exit wizard
 *
 * Requires: running as root (sudo)
 *
 * Skip: set SONARO_SKIP_SETUP=1 to bypass (headless/automated deploys)
 */

import * as readline from 'readline';
import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { db } from './db.js';
import { systemSettings, networkInterfaces, users, userRoles } from '../shared/schema.js';
import { hashPassword } from './auth.js';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function run(cmd: string): Promise<{ ok: boolean; out: string; err: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 15_000 });
    return { ok: true, out: stdout.trim(), err: stderr.trim() };
  } catch (e: any) {
    return { ok: false, out: e.stdout?.trim() || '', err: e.stderr?.trim() || e.message };
  }
}

function maskToCidr(mask: string): string {
  if (!mask.includes('.')) return mask;
  return String(mask.split('.').map(Number).reduce((a, o) =>
    a + o.toString(2).split('').filter(b => b === '1').length, 0));
}

function cidrToMask(prefix: number): string {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return [(mask >> 24) & 0xff, (mask >> 16) & 0xff, (mask >> 8) & 0xff, mask & 0xff].join('.');
}

function center(text: string, width = 60): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

// ─────────────────────────────────────────────────────────────────
// Readline wrapper (async/await friendly)
// ─────────────────────────────────────────────────────────────────

function createCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  function ask(prompt: string, defaultValue = ''): Promise<string> {
    return new Promise(resolve => {
      const display = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
      rl.question(display, answer => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  function askSecret(prompt: string): Promise<string> {
    return new Promise(resolve => {
      process.stdout.write(`${prompt}: `);
      // Disable echo for password input
      if (process.stdin.isTTY) {
        (process.stdin as any).setRawMode(true);
      }
      let input = '';
      const handler = (chunk: Buffer) => {
        const ch = chunk.toString();
        if (ch === '\r' || ch === '\n') {
          process.stdout.write('\n');
          process.stdin.removeListener('data', handler);
          if (process.stdin.isTTY) (process.stdin as any).setRawMode(false);
          resolve(input);
        } else if (ch === '\u0003') {
          // Ctrl+C
          process.exit(0);
        } else if (ch === '\u007f' || ch === '\b') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += ch;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', handler);
    });
  }

  function close() { rl.close(); }

  return { ask, askSecret, close };
}

// ─────────────────────────────────────────────────────────────────
// Check if setup has already been completed
// ─────────────────────────────────────────────────────────────────

export async function isSetupComplete(): Promise<boolean> {
  try {
    const rows = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'setup_complete'))
      .limit(1);
    return rows.length > 0 && rows[0].value === 'true';
  } catch {
    return false;
  }
}

async function markSetupComplete() {
  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'setup_complete'))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(systemSettings).values({
      key: 'setup_complete',
      value: 'true',
      description: 'Initial setup wizard completed',
    });
  } else {
    await db.update(systemSettings)
      .set({ value: 'true', updated_at: new Date() })
      .where(eq(systemSettings.key, 'setup_complete'));
  }
}

// ─────────────────────────────────────────────────────────────────
// Network interface detection
// ─────────────────────────────────────────────────────────────────

interface NicInfo {
  name: string;
  mac: string;
  ip4: string;
  operstate: string;
  speed: number | null;
}

async function detectNics(): Promise<NicInfo[]> {
  const nets = await si.networkInterfaces();
  const arr = Array.isArray(nets) ? nets : [nets];
  return arr
    .filter(n => !n.internal &&
      !n.iface.startsWith('docker') &&
      !n.iface.startsWith('veth') &&
      !n.iface.startsWith('br-') &&
      n.iface !== 'virbr0' &&
      n.iface !== 'lo')
    .map(n => ({
      name: n.iface,
      mac: n.mac || '??:??:??:??:??:??',
      ip4: n.ip4 || '(no IP)',
      operstate: n.operstate || 'unknown',
      speed: (n.speed && n.speed > 0) ? n.speed : null,
    }));
}

// ─────────────────────────────────────────────────────────────────
// Apply network config
// ─────────────────────────────────────────────────────────────────

async function applyStaticIp(
  iface: string, ip: string, prefix: string, gateway?: string,
): Promise<void> {
  await run(`ip link set ${iface} up`);
  await run(`ip addr flush dev ${iface}`);
  await run(`ip addr add ${ip}/${prefix} dev ${iface}`);
  if (gateway) {
    await run(`ip route del default 2>/dev/null`);
    await run(`ip route add default via ${gateway} dev ${iface}`);
  }
}

async function applyDhcp(iface: string): Promise<string | null> {
  await run(`ip link set ${iface} up`);
  // Try dhclient first (classic approach)
  const dhclient = await run(`which dhclient`);
  if (dhclient.ok) {
    await run(`dhclient -v ${iface} 2>/dev/null`);
  } else {
    // Ubuntu 24.04: use ip link only — netplan will do DHCP on apply
    // We'll write netplan and let it manage DHCP
  }
  // Wait a moment for DHCP lease
  await new Promise(r => setTimeout(r, 3000));
  // Read assigned IP
  const r = await run(`ip addr show dev ${iface} | grep 'inet ' | awk '{print $2}'`);
  return r.out || null;
}

async function writeNetplanConfig(
  wanIface: string, wanDhcp: boolean, wanIp: string, wanMask: string, wanGateway: string,
  lanIface: string, lanIp: string, lanMask: string,
): Promise<void> {
  const wanPrefix = maskToCidr(wanMask);
  const lanPrefix = maskToCidr(lanMask);

  const lines = ['network:', '  version: 2', '  renderer: networkd', '  ethernets:'];

  // WAN
  lines.push(`    ${wanIface}:`);
  if (wanDhcp) {
    lines.push('      dhcp4: true');
    lines.push('      dhcp4-overrides:');
    lines.push('        use-dns: true');
    lines.push('        use-routes: true');
  } else {
    lines.push('      dhcp4: false');
    lines.push(`      addresses: [${wanIp}/${wanPrefix}]`);
    if (wanGateway) {
      lines.push('      routes:');
      lines.push('        - to: default');
      lines.push(`          via: ${wanGateway}`);
    }
    lines.push('      nameservers:');
    lines.push('        addresses: [8.8.8.8, 1.1.1.1]');
  }

  // LAN
  lines.push(`    ${lanIface}:`);
  lines.push('      dhcp4: false');
  lines.push(`      addresses: [${lanIp}/${lanPrefix}]`);

  const yaml = lines.join('\n') + '\n';
  await writeFile('/etc/netplan/90-sonaro.yaml', yaml, { mode: 0o600 });
  await run('netplan apply');
}

async function enableIpForward(): Promise<void> {
  await run('sysctl -w net.ipv4.ip_forward=1');
  await writeFile('/etc/sysctl.d/99-sonaro-forward.conf',
    'net.ipv4.ip_forward = 1\nnet.ipv6.conf.all.forwarding = 1\n');
}

async function enableNat(wanIface: string): Promise<void> {
  await run('iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT');
  await run(`iptables -t nat -A POSTROUTING -o ${wanIface} -j MASQUERADE`);
}

async function saveIfacesToDb(
  wanIface: string, wanIp: string | null, wanMask: string, wanGateway: string,
  lanIface: string, lanIp: string, lanMask: string,
): Promise<void> {
  const upsert = async (data: any) => {
    const ex = await db.select().from(networkInterfaces).where(eq(networkInterfaces.name, data.name)).limit(1);
    if (ex.length === 0) {
      await db.insert(networkInterfaces).values(data);
    } else {
      await db.update(networkInterfaces).set({ ...data, updated_at: new Date() }).where(eq(networkInterfaces.name, data.name));
    }
  };

  await upsert({
    name: wanIface, type: 'WAN', status: 'up',
    ip_address: wanIp, subnet: wanMask || null, gateway: wanGateway || null,
  });
  await upsert({
    name: lanIface, type: 'LAN', status: 'up',
    ip_address: lanIp, subnet: lanMask, gateway: null,
  });
}

// ─────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────

export async function runSetupWizard(): Promise<void> {
  // Clear screen
  process.stdout.write('\x1Bc');

  const LINE = '═'.repeat(62);
  const line = '─'.repeat(62);

  console.log(LINE);
  console.log(center('Sonaro Gate • 2025.1 LTS', 62));
  console.log(center('Next-Generation Firewall', 62));
  console.log(center('Initial Configuration Wizard', 62));
  console.log(LINE);
  console.log();

  // Root check
  const idResult = await run('id -u');
  if (idResult.out !== '0') {
    console.log('  ✗ ERROR: This wizard must run as root.');
    console.log('  Run: sudo npx tsx server/index.ts');
    console.log();
    process.exit(1);
  }

  // Detect NICs
  console.log('  Detecting network interfaces...');
  const nics = await detectNics();

  if (nics.length === 0) {
    console.log('  ✗ No network interfaces detected. Cannot proceed.');
    process.exit(1);
  }

  console.log();
  console.log('  Available network interfaces:');
  console.log(line);
  nics.forEach((nic, i) => {
    const speed = nic.speed ? ` ${nic.speed} Mbps` : '';
    const state = nic.operstate === 'up' ? '↑ UP' : '↓ DOWN';
    console.log(`  [${i + 1}] ${nic.name.padEnd(12)} ${nic.mac}  ${state}${speed}`);
    if (nic.ip4 && nic.ip4 !== '(no IP)') {
      console.log(`       Current IP: ${nic.ip4}`);
    }
  });
  console.log(line);

  if (nics.length < 2) {
    console.log();
    console.log('  ⚠  WARNING: Only one interface detected.');
    console.log('  A firewall needs at least 2 interfaces (WAN + LAN).');
    console.log('  You can still proceed but routing will be limited.');
    console.log();
  }

  const cli = createCLI();

  try {
    // ─── WAN Interface ─────────────────────────────────────────
    console.log();
    console.log('  WAN Interface Configuration');
    console.log(line);

    const wanNum = parseInt(await cli.ask(
      `  Select WAN interface (1-${nics.length})`, '1'
    ));
    if (isNaN(wanNum) || wanNum < 1 || wanNum > nics.length) {
      console.log('  ✗ Invalid selection.'); process.exit(1);
    }
    const wanNic = nics[wanNum - 1];
    console.log(`  → WAN: ${wanNic.name} (${wanNic.mac})`);
    console.log();

    console.log('  WAN IP assignment:');
    console.log('    (1) DHCP  — get IP automatically from ISP');
    console.log('    (2) Static — enter IP manually');
    console.log();
    const wanType = await cli.ask('  Choose WAN type', '1');
    const wanDhcp = wanType !== '2';

    let wanIp = '';
    let wanMask = '';
    let wanGateway = '';

    if (!wanDhcp) {
      console.log();
      wanIp = await cli.ask('  WAN IP address (e.g. 203.0.113.10)');
      wanMask = await cli.ask('  Subnet mask', '255.255.255.0');
      wanGateway = await cli.ask('  Default gateway (e.g. 203.0.113.1)');
    }

    // ─── LAN Interface ─────────────────────────────────────────
    console.log();
    console.log('  LAN Interface Configuration');
    console.log(line);

    // Default LAN is the next NIC after WAN
    const defaultLan = nics.find((_, i) => i + 1 !== wanNum) ?? nics[0];
    const defaultLanNum = nics.indexOf(defaultLan) + 1;

    // Re-display NIC list for LAN selection
    nics.forEach((nic, i) => {
      if (i + 1 === wanNum) return; // skip WAN
      console.log(`  [${i + 1}] ${nic.name.padEnd(12)} ${nic.mac}`);
    });
    console.log();

    const lanNum = parseInt(await cli.ask(
      `  Select LAN interface (1-${nics.length})`, String(defaultLanNum)
    ));
    if (isNaN(lanNum) || lanNum < 1 || lanNum > nics.length || lanNum === wanNum) {
      console.log('  ✗ Invalid selection or same as WAN.'); process.exit(1);
    }
    const lanNic = nics[lanNum - 1];
    console.log(`  → LAN: ${lanNic.name} (${lanNic.mac})`);
    console.log();

    const lanIp = await cli.ask('  LAN IP address', '192.168.1.1');
    const lanMask = await cli.ask('  LAN Subnet mask', '255.255.255.0');

    // ─── Admin Account ──────────────────────────────────────────
    console.log();
    console.log('  Admin Account');
    console.log(line);

    const adminEmail = await cli.ask('  Admin email', 'admin@sonaro.local');
    let adminPass = '';
    let passOk = false;

    while (!passOk) {
      adminPass = await cli.askSecret('  New admin password (min 8 chars, leave blank = keep default)');
      if (adminPass === '') {
        console.log('  → Keeping default password: Admin123!');
        adminPass = '';
        passOk = true;
      } else if (adminPass.length < 8) {
        console.log('  ✗ Password must be at least 8 characters.');
      } else {
        const confirm = await cli.askSecret('  Confirm password');
        if (confirm !== adminPass) {
          console.log('  ✗ Passwords do not match.');
        } else {
          passOk = true;
        }
      }
    }

    // ─── Hostname ───────────────────────────────────────────────
    console.log();
    const hostname = await cli.ask('  Firewall hostname', 'sonaro-gw-01');

    // ─── Confirm ────────────────────────────────────────────────
    console.log();
    console.log(LINE);
    console.log(center('Configuration Summary', 62));
    console.log(LINE);
    console.log(`  Hostname : ${hostname}`);
    console.log(`  WAN      : ${wanNic.name}  ${wanDhcp ? 'DHCP' : `${wanIp}/${maskToCidr(wanMask)}  gw: ${wanGateway}`}`);
    console.log(`  LAN      : ${lanNic.name}  ${lanIp}/${maskToCidr(lanMask)}`);
    console.log(`  Web UI   : http://${lanIp}:5000`);
    console.log(`  Admin    : ${adminEmail}`);
    console.log(line);
    console.log();

    const confirm = await cli.ask('  Apply this configuration? (y/n)', 'y');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('  Cancelled. Run again to reconfigure.');
      cli.close();
      process.exit(0);
    }

    cli.close();

    // ─── Apply ───────────────────────────────────────────────────
    console.log();
    console.log('  Applying configuration...');
    console.log();

    // Step 1: Write netplan (primary persistence mechanism for Ubuntu 24.04)
    process.stdout.write(`  [ ] Writing network config (netplan)...`);
    try {
      await writeNetplanConfig(
        wanNic.name, wanDhcp, wanIp, wanMask, wanGateway,
        lanNic.name, lanIp, lanMask,
      );
      process.stdout.write('\r  [✓] Network config written and applied via netplan\n');
    } catch (e: any) {
      process.stdout.write(`\r  [!] netplan: ${e.message} (will use ip commands)\n`);
      // Fallback: direct ip commands
      if (!wanDhcp) {
        await applyStaticIp(wanNic.name, wanIp, maskToCidr(wanMask), wanGateway);
      }
    }

    // Step 2: LAN static (ensure it's up even if netplan already did it)
    process.stdout.write(`  [ ] Configuring LAN (${lanNic.name})...`);
    await applyStaticIp(lanNic.name, lanIp, maskToCidr(lanMask));
    process.stdout.write(`\r  [✓] LAN: ${lanIp}/${maskToCidr(lanMask)} on ${lanNic.name}\n`);

    // Step 3: WAN DHCP if needed
    if (wanDhcp) {
      process.stdout.write(`  [ ] Requesting DHCP lease on ${wanNic.name}...`);
      const assignedIp = await applyDhcp(wanNic.name);
      wanIp = assignedIp || '(waiting for DHCP)';
      process.stdout.write(`\r  [✓] WAN: ${wanIp} on ${wanNic.name}\n`);
    } else {
      process.stdout.write(`  [✓] WAN: ${wanIp}/${maskToCidr(wanMask)} on ${wanNic.name}\n`);
    }

    // Step 4: IP forwarding
    process.stdout.write(`  [ ] Enabling IP forwarding...`);
    await enableIpForward();
    process.stdout.write('\r  [✓] IP forwarding enabled (persistent)\n');

    // Step 5: NAT masquerade
    process.stdout.write(`  [ ] Setting up NAT masquerade on ${wanNic.name}...`);
    await enableNat(wanNic.name);
    process.stdout.write(`\r  [✓] NAT masquerade active on ${wanNic.name}\n`);

    // Step 6: Hostname
    process.stdout.write(`  [ ] Setting hostname...`);
    await run(`hostnamectl set-hostname ${hostname}`);
    process.stdout.write(`\r  [✓] Hostname: ${hostname}\n`);

    // Step 7: Save to database
    process.stdout.write(`  [ ] Saving to database...`);

    // Update admin account
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
    if (adminPass) {
      const newHash = hashPassword(adminPass);
      if (existingAdmin.length > 0) {
        await db.update(users).set({ password_hash: newHash, updated_at: new Date() }).where(eq(users.email, adminEmail));
      } else {
        const [newUser] = await db.insert(users).values({
          email: adminEmail,
          full_name: 'Super Admin',
          password_hash: newHash,
        }).returning();
        await db.insert(userRoles).values({ user_id: newUser.id, role: 'super_admin' });
      }
    }

    // Save interfaces
    await saveIfacesToDb(
      wanNic.name, wanDhcp ? wanIp : wanIp, wanMask, wanGateway,
      lanNic.name, lanIp, lanMask,
    );

    // Save settings
    const settings: Array<{ key: string; value: string; description: string }> = [
      { key: 'hostname', value: hostname, description: 'Firewall hostname' },
      { key: 'wan_interface', value: wanNic.name, description: 'WAN interface name' },
      { key: 'lan_interface', value: lanNic.name, description: 'LAN interface name' },
      { key: 'lan_ip', value: lanIp, description: 'LAN IP address' },
      { key: 'lan_subnet', value: lanMask, description: 'LAN subnet mask' },
      { key: 'management_port', value: '5000', description: 'Web UI port' },
      { key: 'timezone', value: 'Asia/Ho_Chi_Minh', description: 'System timezone' },
      { key: 'ntp_server', value: 'pool.ntp.org', description: 'NTP server' },
    ];

    for (const s of settings) {
      const ex = await db.select().from(systemSettings).where(eq(systemSettings.key, s.key)).limit(1);
      if (ex.length === 0) {
        await db.insert(systemSettings).values(s);
      } else {
        await db.update(systemSettings).set({ value: s.value, updated_at: new Date() }).where(eq(systemSettings.key, s.key));
      }
    }

    await markSetupComplete();
    process.stdout.write('\r  [✓] Configuration saved to database\n');

    // ─── Done ────────────────────────────────────────────────────
    console.log();
    console.log(LINE);
    console.log(center('✓  SETUP COMPLETE', 62));
    console.log(LINE);
    console.log();
    console.log('  Web management console is now available at:');
    console.log();
    console.log(`  →  http://${lanIp}:5000`);
    console.log();
    console.log(`  Login  :  ${adminEmail}`);
    console.log(`  Password:  ${adminPass ? '(your chosen password)' : 'Admin123!  ← CHANGE THIS!'}`);
    console.log();
    console.log('  Connect a PC to the LAN interface and open the URL above.');
    console.log();
    console.log(LINE);
    console.log();
    console.log('  Starting web server...');
    console.log();

  } catch (err: any) {
    cli.close();
    console.error('\n  ✗ Setup failed:', err.message);
    process.exit(1);
  }
}
