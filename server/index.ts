import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { attachWebSocket } from './ws.js';
import { db } from './db.js';
import { users, userRoles, networkInterfaces, systemSettings } from '../shared/schema.js';
import { signToken, checkPassword, requireAuth } from './auth.js';
import { createCrudRouter } from './postgrest.js';
import { startAgent } from './agent.js';
import { seedDatabase } from './seed.js';
import {
  getSuricataStatus,
  startSuricata,
  stopSuricata,
  reloadSuricata,
  updateSignatures,
  addLocalRule,
  setRuleEnabled,
  deleteRule,
  getRecentAlerts,
} from './suricata.js';
import { isSetupComplete, runSetupWizard } from './setup.js';
import {
  checkIptablesAvailable,
  getIptablesRules,
  getNftablesRules,
  getRoutingTable,
  applyFirewallRule,
  flushAndApplyAllRules,
  applyNatRules,
  enableIpForwarding,
  enableNatMasquerade,
  getIpForwardingStatus,
  applyFullConfig,
  applyInterfaceIP,
  setInterfaceState,
  applyNetplanConfig,
  getAllInterfaceDetails,
  getInterfaceDetails,
  isRoot,
} from './iptables.js';
import { eq } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '5000');

async function startWebServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // ── Health + system status ────────────────────────
  app.get('/api/health', async (_req, res) => {
    const [root, ipForward, setupDone] = await Promise.all([
      isRoot(), getIpForwardingStatus(), isSetupComplete(),
    ]);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      root,
      ipForwarding: ipForward,
      setupComplete: setupDone,
      warning: !root ? 'Not running as root — iptables/ip commands disabled' : null,
    });
  });

  // ── Auth (PostgREST /rpc/authenticate) ───────────
  app.post('/api/rpc/authenticate', async (req, res) => {
    const { p_email, p_password } = req.body;
    if (!p_email || !p_password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.email, p_email)).limit(1);
      if (!user || !checkPassword(p_password, user.password_hash)) {
        return res.status(401).json({ message: 'Invalid login credentials' });
      }
      const roles = await db.select().from(userRoles).where(eq(userRoles.user_id, user.id));
      const roleNames = roles.map(r => r.role);
      const token = signToken({ sub: user.id, email: user.email, full_name: user.full_name, roles: roleNames });
      res.json({ token, user_id: user.id, email: user.email, full_name: user.full_name, roles: roleNames });
    } catch (err: any) {
      console.error('[Auth] Login error:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─────────────────────────────────────────────────
  // Firewall / iptables
  // ─────────────────────────────────────────────────

  app.get('/api/system/iptables', requireAuth, async (_req, res) => {
    const check = await checkIptablesAvailable();
    const rules = check.hasPermission ? await getIptablesRules() : check.message;
    res.json({ ...check, rules });
  });

  app.get('/api/system/nftables', requireAuth, async (_req, res) => {
    res.json({ rules: await getNftablesRules() });
  });

  app.get('/api/system/routes', requireAuth, async (_req, res) => {
    res.json({ routes: await getRoutingTable() });
  });

  app.get('/api/system/ip-forward', requireAuth, async (_req, res) => {
    res.json({ enabled: await getIpForwardingStatus() });
  });

  app.post('/api/system/ip-forward/enable', requireAuth, async (_req, res) => {
    res.json(await enableIpForwarding());
  });

  app.post('/api/system/apply-rule', requireAuth, async (req, res) => {
    res.json(await applyFirewallRule(req.body));
  });

  app.post('/api/system/apply-all-rules', requireAuth, async (_req, res) => {
    res.json(await flushAndApplyAllRules());
  });

  app.post('/api/system/apply-nat-rules', requireAuth, async (_req, res) => {
    res.json(await applyNatRules());
  });

  app.post('/api/system/nat-masquerade', requireAuth, async (req, res) => {
    const { wanIface } = req.body;
    if (!wanIface) return res.status(400).json({ success: false, message: 'wanIface required' });
    res.json(await enableNatMasquerade(wanIface));
  });

  /**
   * Master "Apply All" — ip_forward + NAT masquerade + all NAT rules + all filter rules.
   * This is the "Commit Changes" button in the web UI.
   */
  app.post('/api/system/apply-config', requireAuth, async (_req, res) => {
    const result = await applyFullConfig();
    res.status(result.success ? 200 : 207).json(result);
  });

  // ─────────────────────────────────────────────────
  // Network interface management
  // ─────────────────────────────────────────────────

  app.get('/api/system/interfaces', requireAuth, async (_req, res) => {
    const root = await isRoot();
    const raw = await getAllInterfaceDetails();
    res.json({ root, raw });
  });

  app.get('/api/system/interfaces/:name', requireAuth, async (req, res) => {
    res.json({ raw: await getInterfaceDetails(req.params.name) });
  });

  app.post('/api/system/interfaces/:name/apply', requireAuth, async (req, res) => {
    const { name } = req.params;
    const { ip_address, subnet, gateway } = req.body;
    if (!ip_address || !subnet) {
      return res.status(400).json({ success: false, message: 'ip_address and subnet required' });
    }
    const result = await applyInterfaceIP(name, ip_address, subnet, gateway);
    try {
      const [ex] = await db.select().from(networkInterfaces).where(eq(networkInterfaces.name, name)).limit(1);
      const data = { ip_address, subnet, gateway: gateway || null, updated_at: new Date() };
      if (ex) {
        await db.update(networkInterfaces).set(data).where(eq(networkInterfaces.name, name));
      } else {
        await db.insert(networkInterfaces).values({ name, type: 'LAN', status: 'up', ...data });
      }
    } catch { /* ignore */ }
    res.json(result);
  });

  app.post('/api/system/interfaces/:name/state', requireAuth, async (req, res) => {
    const { name } = req.params;
    const { state } = req.body;
    if (state !== 'up' && state !== 'down') {
      return res.status(400).json({ success: false, message: 'state must be "up" or "down"' });
    }
    const result = await setInterfaceState(name, state as 'up' | 'down');
    try {
      await db.update(networkInterfaces).set({ status: state, updated_at: new Date() }).where(eq(networkInterfaces.name, name));
    } catch { /* ignore */ }
    res.json(result);
  });

  app.post('/api/system/netplan/apply', requireAuth, async (req, res) => {
    const { interfaces } = req.body;
    if (!Array.isArray(interfaces) || interfaces.length === 0) {
      return res.status(400).json({ success: false, message: 'interfaces array required' });
    }
    res.json(await applyNetplanConfig(interfaces));
  });

  // ─────────────────────────────────────────────────
  // IDS/IPS (Suricata) API
  // ─────────────────────────────────────────────────
  app.get('/api/system/ips/status', requireAuth, async (_req, res) => {
    res.json(await getSuricataStatus());
  });

  app.post('/api/system/ips/start', requireAuth, async (_req, res) => {
    res.json(await startSuricata());
  });

  app.post('/api/system/ips/stop', requireAuth, async (_req, res) => {
    res.json(await stopSuricata());
  });

  app.post('/api/system/ips/reload', requireAuth, async (_req, res) => {
    res.json(await reloadSuricata());
  });

  app.post('/api/system/ips/update-signatures', requireAuth, async (_req, res) => {
    res.json(await updateSignatures());
  });

  app.post('/api/system/ips/rules', requireAuth, async (req, res) => {
    const { sid, action, protocol, srcIp, srcPort, dstIp, dstPort, message, category, severity } = req.body;
    if (!sid || !message) return res.status(400).json({ ok: false, message: 'sid and message required' });
    res.json(await addLocalRule({
      sid: Number(sid),
      action: action ?? 'alert',
      protocol: protocol ?? 'tcp',
      srcIp: srcIp ?? 'any',
      srcPort: srcPort ?? 'any',
      dstIp: dstIp ?? 'any',
      dstPort: dstPort ?? 'any',
      message,
      category: category ?? 'policy-violation',
      severity: severity ?? 'medium',
    }));
  });

  app.patch('/api/system/ips/rules/:sid/enabled', requireAuth, async (req, res) => {
    const sid = parseInt(req.params.sid);
    const { enabled } = req.body;
    if (isNaN(sid)) return res.status(400).json({ ok: false, message: 'invalid sid' });
    res.json(await setRuleEnabled(sid, Boolean(enabled)));
  });

  app.delete('/api/system/ips/rules/:sid', requireAuth, async (req, res) => {
    const sid = parseInt(req.params.sid);
    if (isNaN(sid)) return res.status(400).json({ ok: false, message: 'invalid sid' });
    res.json(await deleteRule(sid));
  });

  app.get('/api/system/ips/alerts', requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ alerts: await getRecentAlerts(limit) });
  });

  // ─────────────────────────────────────────────────
  // PostgREST-compatible CRUD
  // ─────────────────────────────────────────────────
  app.use('/api', createCrudRouter());

  // ─────────────────────────────────────────────────
  // HTTP + WebSocket server
  // ─────────────────────────────────────────────────
  const httpServer = createHttpServer(app);

  // Attach our /ws WebSocket server (noServer mode — safe with Vite HMR)
  attachWebSocket(httpServer);

  // ─────────────────────────────────────────────────
  // Frontend — Vite dev or static production build
  // ─────────────────────────────────────────────────
  if (isDev) {
    const vite = await createViteServer({
      root: ROOT,
      server: {
        middlewareMode: true,
        allowedHosts: true as any,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // ─────────────────────────────────────────────────
  // Listen
  // ─────────────────────────────────────────────────
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Sonaro Gate backend running on port ${PORT}`);
    console.log(`[Server] Mode: ${isDev ? 'development' : 'production'}`);

    isRoot().then(async root => {
      const fwd = await getIpForwardingStatus();
      if (!root) {
        console.warn('[Server] ⚠  NOT running as root — network commands disabled');
        console.warn('[Server] ⚠  Production: sudo npx tsx server/index.ts');
      } else {
        console.log(`[Server] ✓  Root mode — full network control active`);
        console.log(`[Server] ✓  ip_forward = ${fwd ? '1 (routing ON)' : '0 — run /api/system/ip-forward/enable'}`);
      }
    });

    // Print access URL from DB if available
    db.select().from(systemSettings).where(eq(systemSettings.key, 'lan_ip')).limit(1)
      .then(rows => {
        const lanIp = rows[0]?.value;
        if (lanIp) {
          console.log(`[Server] ✓  Web UI: http://${lanIp}:${PORT}`);
        }
      }).catch(() => {});
  });
}

// ─────────────────────────────────────────────────────────────────
// Boot sequence
// ─────────────────────────────────────────────────────────────────

async function main() {
  // 1. Seed DB (create admin user if missing)
  await seedDatabase();

  // 2. Setup wizard logic
  const skipSetup = process.env.SONARO_SKIP_SETUP === '1';
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  const setupDone = await isSetupComplete();

  const root = await isRoot();

  if (!setupDone && !skipSetup && isTTY && root) {
    // Interactive console + root → run the full wizard
    await runSetupWizard();
  } else if (!setupDone && !skipSetup && isTTY && !root) {
    // Has TTY but not root — warn and continue (dev/Replit environment)
    console.log('[Setup] Wizard requires root — skipping (run with sudo on Ubuntu).');
    console.log('[Setup] Using defaults: admin@sonaro.local / Admin123!');
  } else if (!setupDone && !skipSetup && !isTTY) {
    // No TTY (background/CI) — skip wizard, use defaults
    console.log('[Setup] No interactive terminal — skipping wizard.');
    console.log('[Setup] Using defaults: admin@sonaro.local / Admin123!');
  } else if (setupDone) {
    console.log('[Setup] Setup already complete — starting normally.');
  } else {
    console.log('[Setup] SONARO_SKIP_SETUP=1 — skipping wizard.');
  }

  // 3. Start background agent
  startAgent();

  // 4. Start web server
  await startWebServer();
}

main().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
