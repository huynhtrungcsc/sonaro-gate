/**
 * host.ts — Docker-aware host command execution
 *
 * When Sonaro Gate runs inside a Docker container (privileged + network_mode:host)
 * the application needs to control host-level services (Suricata, WireGuard,
 * OpenVPN, dnsmasq) that are installed on the Ubuntu host, not inside the container.
 *
 * Detection:  /.dockerenv is created by Docker inside every container.
 * Mechanism:  nsenter(1) enters the host's mount, UTS, IPC, network and PID
 *             namespaces from a privileged container, making all subsequent
 *             commands behave as if they were run directly on the host.
 *
 * Non-Docker (native install): commands run directly — no wrapping.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { exec }       from 'child_process';
import { promisify }  from 'util';
import { spawnSync }  from 'child_process';

const execAsync = promisify(exec);

// ── Docker detection ─────────────────────────────────────────────────────────

/**
 * True when the process is running inside a Docker container.
 * Docker always creates /.dockerenv in the container root.
 */
export const IS_DOCKER: boolean = existsSync('/.dockerenv');

/**
 * Prefix that routes a command through the host's namespaces.
 * Requires: util-linux (nsenter), privileged container.
 */
const NSENTER = 'nsenter -t 1 -m -u -i -n -p --';

// ── Async command execution ──────────────────────────────────────────────────

export interface ExecResult {
  ok:     boolean;
  stdout: string;
  stderr: string;
}

/**
 * Run a shell command.
 * In Docker: executes via nsenter so it sees the host filesystem and services.
 * Native:    executes directly.
 *
 * @param cmd   Shell command string (supports pipes, redirects, etc.)
 * @param opts  Optional timeout in ms (default 30 s)
 */
export async function hostExec(
  cmd: string,
  opts: { timeout?: number } = {},
): Promise<ExecResult> {
  const timeout = opts.timeout ?? 30_000;
  const actualCmd = IS_DOCKER ? `${NSENTER} sh -c ${JSON.stringify(cmd)}` : cmd;
  try {
    const { stdout, stderr } = await execAsync(actualCmd, { timeout });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: any) {
    return {
      ok:     false,
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? err.message,
    };
  }
}

// ── Synchronous binary / service helpers ─────────────────────────────────────

/**
 * Check if a binary exists on the host.
 *
 * Docker path:  scans well-known directories under /host/proc/1/root/ which
 *               is the host's root filesystem visible from a privileged container.
 * Native path:  plain `which <cmd>`.
 */
export function hostBinaryExists(cmd: string): boolean {
  if (IS_DOCKER) {
    const locations = [
      `/host/proc/1/root/usr/bin/${cmd}`,
      `/host/proc/1/root/usr/sbin/${cmd}`,
      `/host/proc/1/root/bin/${cmd}`,
      `/host/proc/1/root/sbin/${cmd}`,
      `/host/proc/1/root/usr/local/bin/${cmd}`,
      `/host/proc/1/root/usr/local/sbin/${cmd}`,
    ];
    return locations.some(p => { try { return existsSync(p); } catch { return false; } });
  }
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

/**
 * Check if a systemd service is active on the host.
 *
 * Docker path:  scans /host/proc/{pid}/cmdline (host process list) for a
 *               process whose command line contains the service binary name.
 *               Also checks wg interfaces via /host/proc/net/dev for WireGuard.
 * Native path:  `systemctl is-active --quiet <name>`.
 */
export function hostServiceActive(serviceName: string): boolean {
  if (IS_DOCKER) {
    // Map service names to process binary names as they appear in cmdline
    const processMap: Record<string, string[]> = {
      'suricata':         ['suricata'],
      'dnsmasq':          ['dnsmasq'],
      'openvpn':          ['openvpn'],
      'openvpn@server':   ['openvpn'],
      'wg-quick':         [],          // WireGuard: check net interfaces instead
      'wg-quick@wg0':     [],
    };

    const targets = processMap[serviceName] ?? [serviceName.split('@')[0]];

    // Special case: WireGuard — check if wg0 interface exists in host net
    if (serviceName.startsWith('wg-quick')) {
      try {
        const netDev = readFileSync('/host/proc/net/dev', 'utf8');
        return netDev.split('\n').some(l => l.trim().startsWith('wg'));
      } catch { return false; }
    }

    if (targets.length === 0) return false;

    try {
      const pids = readdirSync('/host/proc').filter(d => /^\d+$/.test(d));
      for (const pid of pids) {
        try {
          const cmdline = readFileSync(`/host/proc/${pid}/cmdline`, 'utf8');
          if (targets.some(t => cmdline.includes(t))) return true;
        } catch { /* skip inaccessible pids */ }
      }
      return false;
    } catch { return false; }
  }

  const r = spawnSync('systemctl', ['is-active', '--quiet', serviceName], { encoding: 'utf8' });
  return r.status === 0;
}
