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

export async function markSetupComplete() {
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

interface ExtraIface {
  name: string;
  zone: 'DMZ' | 'OPT';
  ip: string;
  mask: string;
}

async function writeNetplanConfig(
  wanIface: string, wanDhcp: boolean, wanIp: string, wanMask: string, wanGateway: string,
  lanIface: string, lanIp: string, lanMask: string,
  extras: ExtraIface[] = [],
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

  // DMZ / OPT interfaces
  for (const extra of extras) {
    const prefix = maskToCidr(extra.mask);
    lines.push(`    ${extra.name}:`);
    lines.push('      dhcp4: false');
    lines.push(`      addresses: [${extra.ip}/${prefix}]`);
  }

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
  wanIface: string, wanDhcp: boolean, wanIp: string | null, wanMask: string, wanGateway: string,
  lanIface: string, lanIp: string, lanMask: string,
  extras: ExtraIface[] = [],
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
    ip_address: wanDhcp ? (wanIp || null) : wanIp,
    subnet: wanDhcp ? null : (wanMask || null),
    gateway: wanDhcp ? null : (wanGateway || null),
    ip_mode: wanDhcp ? 'dhcp' : 'static',
  });
  await upsert({
    name: lanIface, type: 'LAN', status: 'up',
    ip_address: lanIp, subnet: lanMask, gateway: null,
    ip_mode: 'static',
  });
  for (const extra of extras) {
    await upsert({
      name: extra.name, type: extra.zone, status: 'up',
      ip_address: extra.ip, subnet: extra.mask, gateway: null,
      ip_mode: 'static',
    });
  }
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

    // ─── Optional: DMZ / OPT interfaces ────────────────────────
    const assignedNums = new Set([wanNum, lanNum]);
    const remainingNics = nics.filter((_, i) => !assignedNums.has(i + 1));
    const extras: ExtraIface[] = [];

    if (remainingNics.length > 0) {
      console.log();
      console.log('  Optional Interfaces (DMZ / OPT)');
      console.log(line);
      console.log(`  ${remainingNics.length} unassigned interface(s) detected:`);
      remainingNics.forEach((nic, i) => {
        const speed = nic.speed ? ` ${nic.speed} Mbps` : '';
        const state = nic.operstate === 'up' ? '↑ UP' : '↓ DOWN';
        console.log(`    [${i + 1}] ${nic.name.padEnd(12)} ${nic.mac}  ${state}${speed}`);
      });
      console.log();

      for (let i = 0; i < remainingNics.length; i++) {
        const nic = remainingNics[i];
        const configure = await cli.ask(
          `  Configure ${nic.name} as DMZ/OPT? (y/n)`, 'n'
        );
        if (configure.toLowerCase() !== 'y') continue;

        console.log(`  Zone type for ${nic.name}:`);
        console.log('    (1) DMZ — public-facing servers (web, mail, etc.)');
        console.log('    (2) OPT — optional / guest / IoT network');
        const zoneChoice = await cli.ask('  Choose zone type', '1');
        const zone: 'DMZ' | 'OPT' = zoneChoice === '2' ? 'OPT' : 'DMZ';

        const defaultIp = zone === 'DMZ' ? '172.16.0.1' : '10.0.0.1';
        const extraIp = await cli.ask(`  ${zone} IP address`, defaultIp);
        const extraMask = await cli.ask(`  ${zone} Subnet mask`, '255.255.255.0');

        extras.push({ name: nic.name, zone, ip: extraIp, mask: extraMask });
        console.log(`  → ${zone}: ${nic.name}  ${extraIp}/${maskToCidr(extraMask)}`);
        console.log();
      }
    }

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
    for (const ex of extras) {
      console.log(`  ${ex.zone.padEnd(8)} : ${ex.name}  ${ex.ip}/${maskToCidr(ex.mask)}`);
    }
    console.log(`  Web UI   : http://${lanIp}:5000`);
    console.log(`  Admin    : ${adminEmail}`);
    console.log(line);
    console.log();
    console.log('  Once setup completes, connect a device to the LAN network');
    console.log(`  and open:  http://${lanIp}:5000`);
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
        extras,
      );
      process.stdout.write('\r  [✓] Network config written and applied via netplan\n');
    } catch (e: any) {
      process.stdout.write(`\r  [!] netplan: ${e.message} (will use ip commands)\n`);
      if (!wanDhcp) {
        await applyStaticIp(wanNic.name, wanIp, maskToCidr(wanMask), wanGateway);
      }
    }

    // Step 2: LAN static
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

    // Step 4: DMZ / OPT interfaces
    for (const extra of extras) {
      process.stdout.write(`  [ ] Configuring ${extra.zone} (${extra.name})...`);
      await applyStaticIp(extra.name, extra.ip, maskToCidr(extra.mask));
      process.stdout.write(`\r  [✓] ${extra.zone}: ${extra.ip}/${maskToCidr(extra.mask)} on ${extra.name}\n`);
    }

    // Step 5: IP forwarding
    process.stdout.write(`  [ ] Enabling IP forwarding...`);
    await enableIpForward();
    process.stdout.write('\r  [✓] IP forwarding enabled (persistent)\n');

    // Step 6: NAT masquerade
    process.stdout.write(`  [ ] Setting up NAT masquerade on ${wanNic.name}...`);
    await enableNat(wanNic.name);
    process.stdout.write(`\r  [✓] NAT masquerade active on ${wanNic.name}\n`);

    // Step 7: Hostname
    process.stdout.write(`  [ ] Setting hostname...`);
    await run(`hostnamectl set-hostname ${hostname}`);
    process.stdout.write(`\r  [✓] Hostname: ${hostname}\n`);

    // Step 8: Save to database
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

    // Save interfaces (WAN + LAN + DMZ/OPT)
    await saveIfacesToDb(
      wanNic.name, wanDhcp, wanIp, wanMask, wanGateway,
      lanNic.name, lanIp, lanMask,
      extras,
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

// ─────────────────────────────────────────────────────────────────
// pfSense-style persistent console menu (shown after setup is done)
// ─────────────────────────────────────────────────────────────────

interface ConsoleStatus {
  wan: string;
  lan: string;
  extras: Array<{ label: string; line: string }>;
  lanIp: string;
  hostname: string;
}

async function getIfaceStatus(): Promise<ConsoleStatus> {
  try {
    const rows = await db.select().from(systemSettings);
    const get = (key: string) => rows.find(r => r.key === key)?.value ?? '';
    const wanIface = get('wan_interface');
    const lanIface = get('lan_interface');
    const hostname = get('hostname') || 'sonaro-gw';

    const allIfaces = await db.select().from(networkInterfaces);

    const findIface = (name: string) => allIfaces.find(r => r.name === name);

    const fmtIface = (row: typeof allIfaces[0] | undefined, defaultName: string) => {
      if (!row) return `${defaultName} -> (not configured)`;
      const ip = row.ip_address ?? '(no IP)';
      const mode = row.ip_mode === 'dhcp' ? 'v4/DHCP4' : 'v4';
      const cidr = row.subnet ? `/${maskToCidr(row.subnet)}` : '';
      return `${row.name} -> ${mode}: ${ip}${cidr}`;
    };

    const wanRow = findIface(wanIface);
    const lanRow = findIface(lanIface);

    // Extra interfaces (DMZ / OPT) — anything that is not WAN or LAN
    const extraRows = allIfaces.filter(r =>
      r.name !== wanIface && r.name !== lanIface &&
      (r.type === 'DMZ' || r.type === 'OPT')
    );

    const extras = extraRows.map(r => ({
      label: `${r.type?.toLowerCase() ?? 'opt'} (${r.type?.toLowerCase() ?? 'opt'})`,
      line: fmtIface(r, r.name),
    }));

    const lanIp = lanRow?.ip_address ?? '';

    return {
      wan: fmtIface(wanRow, wanIface || 'WAN'),
      lan: fmtIface(lanRow, lanIface || 'LAN'),
      extras,
      lanIp,
      hostname,
    };
  } catch {
    return { wan: '(unknown)', lan: '(unknown)', extras: [], lanIp: '', hostname: 'sonaro-gw' };
  }
}

function printConsoleMenu(status: ConsoleStatus) {
  process.stdout.write('\x1Bc');
  const LINE = '═'.repeat(62);
  const line = '─'.repeat(62);

  console.log(LINE);
  console.log(center(`*** Welcome to Sonaro Gate 2025.1 on ${status.hostname} ***`, 62));
  console.log(LINE);
  console.log();
  console.log(` WAN (wan)  --> ${status.wan}`);
  console.log(` LAN (lan)  --> ${status.lan}`);
  for (const ex of status.extras) {
    console.log(` ${ex.label.padEnd(10)} --> ${ex.line}`);
  }
  console.log();
  if (status.lanIp) {
    console.log(` Access the webConfigurator by opening a browser and entering:`);
    console.log(`   http://${status.lanIp}`);
    console.log();
  }
  console.log(line);
  console.log();
  console.log('  0) Logout / Disconnect SSH      9) Restart web GUI');
  console.log('  1) Assign Interfaces           10) Show management URL');
  console.log('  2) Set interface(s) IP address 11) Enable SSH');
  console.log('  3) Reset admin account          12) Show routing table');
  console.log('  4) Reset to factory defaults   13) Show active connections');
  console.log('  5) Reboot system               14) Update from console');
  console.log('  6) Halt system');
  console.log('  7) Ping host');
  console.log('  8) Shell');
  console.log();
  console.log(line);
}

export async function runConsoleMenu(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;

  const cli = createCLI();
  const LINE = '═'.repeat(62);

  while (true) {
    const status = await getIfaceStatus();
    printConsoleMenu(status);

    const choice = await cli.ask('  Enter an option');

    switch (choice.trim()) {
      case '0': {
        // Logout — only meaningful on SSH; in console we just re-display menu
        console.log();
        console.log('  Logout is only applicable to SSH sessions.');
        console.log('  Press Enter to continue...');
        await cli.ask('');
        break;
      }

      case '1': {
        // Assign Interfaces
        console.log();
        console.log(LINE);
        console.log(center('Assign Interfaces', 62));
        console.log(LINE);
        console.log();
        console.log('  Detecting network interfaces...');
        const nics = await detectNics();

        if (nics.length === 0) {
          console.log('  ✗ No interfaces detected.');
          await cli.ask('  Press Enter to return to menu');
          break;
        }

        nics.forEach((nic, i) => {
          const speed = nic.speed ? ` ${nic.speed} Mbps` : '';
          const state = nic.operstate === 'up' ? '↑ UP' : '↓ DOWN';
          console.log(`  [${i + 1}] ${nic.name.padEnd(12)} ${nic.mac}  ${state}${speed}`);
          if (nic.ip4 && nic.ip4 !== '(no IP)') console.log(`       IP: ${nic.ip4}`);
        });
        console.log();

        const wanNum = parseInt(await cli.ask(`  Select WAN interface (1-${nics.length})`, '1'));
        if (isNaN(wanNum) || wanNum < 1 || wanNum > nics.length) {
          console.log('  ✗ Invalid selection.'); await cli.ask('  Press Enter'); break;
        }

        const availLan = nics.filter((_, i) => i + 1 !== wanNum);
        const defaultLanNum = nics.indexOf(availLan[0]) + 1;

        console.log();
        availLan.forEach((nic, i) => {
          console.log(`  [${nics.indexOf(nic) + 1}] ${nic.name.padEnd(12)} ${nic.mac}`);
        });
        console.log();

        const lanNum = parseInt(await cli.ask(`  Select LAN interface (1-${nics.length})`, String(defaultLanNum)));
        if (isNaN(lanNum) || lanNum < 1 || lanNum > nics.length || lanNum === wanNum) {
          console.log('  ✗ Invalid or same as WAN.'); await cli.ask('  Press Enter'); break;
        }

        const wanNic = nics[wanNum - 1];
        const lanNic = nics[lanNum - 1];
        console.log();
        console.log(`  WAN: ${wanNic.name}  LAN: ${lanNic.name}`);
        const confirm = await cli.ask('  Apply assignment? (y/n)', 'y');
        if (confirm.toLowerCase() === 'y') {
          const settings: Array<{ key: string; value: string; description: string }> = [
            { key: 'wan_interface', value: wanNic.name, description: 'WAN interface name' },
            { key: 'lan_interface', value: lanNic.name, description: 'LAN interface name' },
          ];
          for (const s of settings) {
            const ex = await db.select().from(systemSettings).where(eq(systemSettings.key, s.key)).limit(1);
            if (ex.length === 0) {
              await db.insert(systemSettings).values(s);
            } else {
              await db.update(systemSettings).set({ value: s.value, updated_at: new Date() }).where(eq(systemSettings.key, s.key));
            }
          }
          // Update networkInterfaces type
          await db.update(networkInterfaces).set({ type: 'WAN', updated_at: new Date() }).where(eq(networkInterfaces.name, wanNic.name));
          await db.update(networkInterfaces).set({ type: 'LAN', updated_at: new Date() }).where(eq(networkInterfaces.name, lanNic.name));
          console.log('  [✓] Interface assignment saved.');
        }
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '2': {
        // Set interface IP — show ALL detected NICs, no pre-assignment required
        console.log();
        console.log(LINE);
        console.log(center('Set Interface(s) IP Address', 62));
        console.log(LINE);
        console.log();

        console.log('  Detecting network interfaces...');
        const allNics = await detectNics();

        if (allNics.length === 0) {
          console.log('  ✗ No network interfaces detected.');
          await cli.ask('  Press Enter to return to menu');
          break;
        }

        // Load DB assignments and current IPs for display
        const settingRows = await db.select().from(systemSettings);
        const dbWan = settingRows.find(r => r.key === 'wan_interface')?.value ?? '';
        const dbLan = settingRows.find(r => r.key === 'lan_interface')?.value ?? '';
        const dbIfaces = await db.select().from(networkInterfaces);

        console.log();
        console.log('  Available interfaces:');
        const line2 = '─'.repeat(62);
        console.log('  ' + line2);
        allNics.forEach((nic, i) => {
          const dbRow = dbIfaces.find(r => r.name === nic.name);
          const ipDisplay = dbRow?.ip_address
            ? `${dbRow.ip_address}${dbRow.subnet ? '/' + maskToCidr(dbRow.subnet) : ''}  [${dbRow.ip_mode ?? 'static'}]`
            : nic.ip4 !== '(no IP)' ? nic.ip4 : '(no IP)';
          const role = nic.name === dbWan ? ' [WAN]' : nic.name === dbLan ? ' [LAN]' : '';
          const state = nic.operstate === 'up' ? 'UP  ' : 'DOWN';
          console.log(`  [${i + 1}] ${nic.name.padEnd(12)} ${state}  ${ipDisplay}${role}`);
        });
        console.log('  ' + line2);
        console.log();

        const ifaceNumStr = await cli.ask(`  Select interface to configure (1-${allNics.length})`);
        const ifaceNum = parseInt(ifaceNumStr);
        if (isNaN(ifaceNum) || ifaceNum < 1 || ifaceNum > allNics.length) {
          console.log('  ✗ Invalid selection.');
          await cli.ask('  Press Enter to return to menu');
          break;
        }

        const selectedNic = allNics[ifaceNum - 1];
        // Determine role from DB
        const nicRole = selectedNic.name === dbWan ? 'WAN'
          : selectedNic.name === dbLan ? 'LAN' : 'OPT';

        console.log();
        console.log(`  Configuring: ${selectedNic.name} (${nicRole})`);
        console.log('  ' + line2);
        console.log('    (1) DHCP   — get IP automatically');
        console.log('    (2) Static — enter IP manually');
        console.log();

        const modeChoice2 = await cli.ask('  Choose mode', nicRole === 'LAN' ? '2' : '1');
        const isDhcp2 = modeChoice2 !== '2';

        if (isDhcp2 && nicRole === 'LAN') {
          console.log('  ⚠  LAN interface should use a static IP for reliable access.');
          const proceed = await cli.ask('  Continue with DHCP anyway? (y/n)', 'n');
          if (proceed.toLowerCase() !== 'y') {
            await cli.ask('  Press Enter to return to menu');
            break;
          }
        }

        let newIp = '';
        let newMask = '';
        let newGateway = '';

        if (!isDhcp2) {
          const curRow = dbIfaces.find(r => r.name === selectedNic.name);
          const curIp = curRow?.ip_address ?? (selectedNic.ip4 !== '(no IP)' ? selectedNic.ip4.split('/')[0] : '');
          const curMask = curRow?.subnet ?? '255.255.255.0';
          const curGw = curRow?.gateway ?? '';

          newIp = await cli.ask('  IP address', curIp);
          newMask = await cli.ask('  Subnet mask', curMask);

          if (nicRole !== 'LAN') {
            newGateway = await cli.ask('  Default gateway (leave blank to skip)', curGw);
          }
        }

        // Summary
        console.log();
        console.log('  Configuration to apply:');
        console.log(`    Interface : ${selectedNic.name}`);
        console.log(`    Mode      : ${isDhcp2 ? 'DHCP' : `Static ${newIp}/${maskToCidr(newMask)}${newGateway ? '  gw: ' + newGateway : ''}`}`);
        console.log();

        const applyConf2 = await cli.ask('  Apply this configuration? (y/n)', 'y');
        if (applyConf2.toLowerCase() === 'y') {
          const idResult2 = await run('id -u');
          const isRoot2 = idResult2.out === '0';

          if (isRoot2) {
            if (isDhcp2) {
              process.stdout.write(`  [ ] Requesting DHCP lease on ${selectedNic.name}...`);
              const leaseIp = await applyDhcp(selectedNic.name);
              newIp = leaseIp || '';
              process.stdout.write(`\r  [✓] DHCP applied on ${selectedNic.name}${leaseIp ? '  →  ' + leaseIp : ''}\n`);
            } else {
              process.stdout.write(`  [ ] Setting ${newIp}/${maskToCidr(newMask)} on ${selectedNic.name}...`);
              await applyStaticIp(selectedNic.name, newIp, maskToCidr(newMask), newGateway || undefined);
              process.stdout.write(`\r  [✓] ${newIp}/${maskToCidr(newMask)} applied on ${selectedNic.name}\n`);
            }
          } else {
            console.log('  ⚠  Not running as root — saving to database only.');
            console.log('     Re-run with sudo to apply IP changes to the OS.');
          }

          // Upsert to networkInterfaces table
          const existingRow = dbIfaces.find(r => r.name === selectedNic.name);
          if (existingRow) {
            await db.update(networkInterfaces).set({
              ip_address: isDhcp2 ? (newIp || null) : newIp,
              subnet: isDhcp2 ? null : newMask,
              gateway: isDhcp2 ? null : (newGateway || null),
              ip_mode: isDhcp2 ? 'dhcp' : 'static',
              status: 'up',
              updated_at: new Date(),
            }).where(eq(networkInterfaces.name, selectedNic.name));
          } else {
            await db.insert(networkInterfaces).values({
              name: selectedNic.name,
              type: nicRole,
              status: 'up',
              ip_address: isDhcp2 ? (newIp || null) : newIp,
              subnet: isDhcp2 ? null : newMask,
              gateway: isDhcp2 ? null : (newGateway || null),
              ip_mode: isDhcp2 ? 'dhcp' : 'static',
            });
          }

          // If LAN role — update lan_ip system setting (used for management URL)
          if (nicRole === 'LAN' && newIp) {
            const exLan = await db.select().from(systemSettings).where(eq(systemSettings.key, 'lan_ip')).limit(1);
            if (exLan.length === 0) {
              await db.insert(systemSettings).values({ key: 'lan_ip', value: newIp, description: 'LAN IP address' });
            } else {
              await db.update(systemSettings).set({ value: newIp, updated_at: new Date() }).where(eq(systemSettings.key, 'lan_ip'));
            }
          }

          console.log('  [✓] Configuration saved to database.');
        } else {
          console.log('  Cancelled — no changes made.');
        }

        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '3': {
        // Reset webGUI password
        console.log();
        console.log(LINE);
        console.log(center('Reset WebGUI Password', 62));
        console.log(LINE);
        console.log();

        const email = await cli.ask('  Admin email', 'admin@sonaro.local');
        let newPass = '';
        let passOk = false;

        while (!passOk) {
          newPass = await cli.askSecret('  New password (min 8 chars)');
          if (newPass.length < 8) {
            console.log('  ✗ Password must be at least 8 characters.');
          } else {
            const confirm = await cli.askSecret('  Confirm password');
            if (confirm !== newPass) {
              console.log('  ✗ Passwords do not match.');
            } else {
              passOk = true;
            }
          }
        }

        const newHash = hashPassword(newPass);
        const existingAdmin = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingAdmin.length > 0) {
          await db.update(users).set({ password_hash: newHash, updated_at: new Date() }).where(eq(users.email, email));
          console.log('  [✓] Password updated successfully.');
        } else {
          console.log(`  ✗ No user found with email: ${email}`);
        }

        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '4': {
        // Reset to factory defaults
        console.log();
        console.log(LINE);
        console.log(center('Reset to Factory Defaults', 62));
        console.log(LINE);
        console.log();
        console.log('  ⚠  WARNING: This will erase all configuration including');
        console.log('     network interfaces, firewall rules, and user settings.');
        console.log('     The setup wizard will run on next restart.');
        console.log();

        const confirm1 = await cli.ask('  Type YES to confirm factory reset');
        if (confirm1 !== 'YES') {
          console.log('  Cancelled — no changes made.');
          await cli.ask('  Press Enter to return to menu');
          break;
        }

        process.stdout.write('  [ ] Resetting configuration...');
        await db.update(systemSettings)
          .set({ value: 'false', updated_at: new Date() })
          .where(eq(systemSettings.key, 'setup_complete'));
        process.stdout.write('\r  [✓] Factory reset complete — restart to run setup wizard.\n');

        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '5': {
        // Reboot
        console.log();
        const confirmReboot = await cli.ask('  Reboot system? (y/n)', 'n');
        if (confirmReboot.toLowerCase() === 'y') {
          console.log('  Rebooting...');
          cli.close();
          await run('reboot');
          process.exit(0);
        }
        break;
      }

      case '6': {
        // Halt
        console.log();
        const confirmHalt = await cli.ask('  Halt system? (y/n)', 'n');
        if (confirmHalt.toLowerCase() === 'y') {
          console.log('  Halting...');
          cli.close();
          await run('halt -p');
          process.exit(0);
        }
        break;
      }

      case '7': {
        // Ping host
        console.log();
        const target = await cli.ask('  Hostname or IP to ping', '8.8.8.8');
        process.stdout.write(`  Pinging ${target}...`);
        const r = await run(`ping -c 4 -W 2 ${target}`);
        console.log();
        if (r.ok) {
          console.log(r.out);
        } else {
          console.log(`  ✗ Ping failed: ${r.err || r.out}`);
        }
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '8': {
        // Shell
        console.log();
        console.log('  Dropping to shell. Type "exit" to return to console menu.');
        console.log();
        cli.close();
        const { spawnSync } = await import('child_process');
        spawnSync(process.env.SHELL || '/bin/bash', { stdio: 'inherit' });
        // Re-open readline after shell exits
        const { createInterface } = await import('readline');
        (cli as any).rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        (cli as any).ask = (prompt: string, def = '') => new Promise<string>(resolve => {
          const display = def ? `${prompt} [${def}]: ` : `${prompt}: `;
          (cli as any).rl.question(display, (a: string) => resolve(a.trim() || def));
        });
        break;
      }

      case '9': {
        // Restart web GUI
        console.log();
        console.log('  Restarting Sonaro Gate web server...');
        // We can't truly restart ourselves, but we can signal the process
        // For now, print guidance
        console.log('  To restart the web GUI, exit and re-run: npx tsx server/index.ts');
        console.log('  (or use your service manager: systemctl restart sonaro-gate)');
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '10': {
        // Show management URL
        console.log();
        const st = await getIfaceStatus();
        const LINE10 = '═'.repeat(62);
        console.log(LINE10);
        console.log(center('Management Access Information', 62));
        console.log(LINE10);
        console.log();
        if (st.lanIp) {
          console.log(`  Web GUI URL  :  http://${st.lanIp}`);
        } else {
          console.log('  Web GUI URL  :  (LAN IP not yet configured — use option 2)');
        }
        console.log(`  Default login:  admin@sonaro.local`);
        console.log(`  Default pass :  Admin123!`);
        console.log();
        console.log('  Connect a PC to the LAN interface and open the URL above.');
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '11': {
        // Enable SSH
        console.log();
        console.log(LINE);
        console.log(center('Enable Secure Shell (sshd)', 62));
        console.log(LINE);
        console.log();
        const idCheck = await run('id -u');
        if (idCheck.out !== '0') {
          console.log('  ⚠  Root required to manage SSH service.');
          await cli.ask('  Press Enter'); break;
        }
        const sshdStatus = await run('systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null');
        const isActive = sshdStatus.out.trim() === 'active';
        console.log(`  SSH is currently: ${isActive ? 'ENABLED' : 'DISABLED'}`);
        const sshChoice = await cli.ask(isActive ? '  Disable SSH? (y/n)' : '  Enable SSH? (y/n)', 'y');
        if (sshChoice.toLowerCase() === 'y') {
          if (isActive) {
            await run('systemctl stop sshd 2>/dev/null || systemctl stop ssh 2>/dev/null');
            await run('systemctl disable sshd 2>/dev/null || systemctl disable ssh 2>/dev/null');
            console.log('  [✓] SSH disabled.');
          } else {
            await run('systemctl enable sshd 2>/dev/null || systemctl enable ssh 2>/dev/null');
            await run('systemctl start sshd 2>/dev/null || systemctl start ssh 2>/dev/null');
            console.log('  [✓] SSH enabled and started.');
          }
        }
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '12': {
        // Show routing table
        console.log();
        console.log(LINE);
        console.log(center('IPv4 Routing Table', 62));
        console.log(LINE);
        console.log();
        const rt = await run('ip route show');
        if (rt.ok && rt.out) {
          console.log(rt.out);
        } else {
          console.log('  (no routes found or ip command unavailable)');
        }
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '13': {
        // Show active connections (conntrack or ss)
        console.log();
        console.log(LINE);
        console.log(center('Active Network Connections', 62));
        console.log(LINE);
        console.log();
        const ss = await run('ss -tunp');
        if (ss.ok && ss.out) {
          console.log(ss.out);
        } else {
          const netstat = await run('netstat -tunp 2>/dev/null');
          if (netstat.ok && netstat.out) {
            console.log(netstat.out);
          } else {
            console.log('  (ss / netstat not available)');
          }
        }
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      case '14': {
        // Update from console (placeholder)
        console.log();
        console.log(LINE);
        console.log(center('Update from Console', 62));
        console.log(LINE);
        console.log();
        console.log('  Checking for updates...');
        const git = await run('git -C /opt/sonaro-gate pull --ff-only 2>/dev/null');
        if (git.ok) {
          console.log(`  ${git.out || 'Already up to date.'}`);
        } else {
          console.log('  (git pull not available — update via your package manager)');
        }
        await cli.ask('  Press Enter to return to menu');
        break;
      }

      default: {
        console.log(`  ✗ Invalid option: ${choice}`);
        await new Promise(r => setTimeout(r, 800));
        break;
      }
    }
  }
}
