/**
 * Sonaro Gate — Next-Generation Firewall Management Console
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * https://github.com/huynhtrungcsc/sonaro-gate
 * SPDX-License-Identifier: MIT
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import { attachWebSocket } from './ws.js';
import { hostExec } from './host.js';
import { db } from './db.js';
import { users, userRoles, networkInterfaces, systemSettings, firewallRules, natRules, aliases, schedules, certificates, staticRoutes, vpnTunnels, configBackups, notificationChannels, notificationRules, auditLogs } from '../shared/schema.js';
import { encryptConfig, decryptConfig, dispatchNotification, testChannel, startNotificationScheduler } from './notifications.js';
import { signToken, checkPassword, requireAuth, signMfaChallenge, verifyMfaChallenge } from './auth.js';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { createCrudRouter } from './postgrest.js';
import { startAgent } from './agent.js';
import { seedDatabase } from './seed.js';
import { runMigrations } from './migrate.js';
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
import { dispatchCLI } from './cli.js';
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
import { eq, desc, inArray } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '5000');

// Mask all but first 4 and last 4 chars of a secret value
function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

async function startWebServer() {
  const app = express();

  // ── CORS ────────────────────────────────────────
  // In production TLS mode restrict to same-origin only (no cross-origin API).
  // In dev mode allow all (Vite dev server runs on the same host/port via proxy).
  const tlsCertFile = process.env.TLS_CERT_FILE;
  const tlsKeyFile  = process.env.TLS_KEY_FILE;
  const tlsEnabled  =
    !isDev &&
    !!tlsCertFile && !!tlsKeyFile &&
    fs.existsSync(tlsCertFile!) && fs.existsSync(tlsKeyFile!);

  app.use(cors(
    tlsEnabled
      ? { origin: false }            // same-origin only in production TLS
      : { origin: true }             // allow all in dev/HTTP mode
  ));

  // ── Security headers ─────────────────────────────
  app.use((_req, res, next) => {
    // Always-on headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // HTTPS-only: enforce HSTS for 1 year (incl. subdomains) — only when TLS
    if (tlsEnabled) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

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
        // Fire-and-forget auth failure notification
        dispatchNotification({
          type: 'auth_failure', severity: 'high',
          message: `Failed login attempt for ${p_email}`,
          source_ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown',
        }).catch(() => {});
        return res.status(401).json({ message: 'Invalid login credentials' });
      }
      // If MFA is enabled, issue a short-lived challenge token
      if (user.mfa_enabled && user.mfa_secret) {
        const mfaToken = signMfaChallenge(user.id);
        return res.json({ mfa_required: true, mfa_token: mfaToken });
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

  // ── MFA: verify TOTP during login (step 2) ────────
  app.post('/api/auth/mfa/verify', async (req, res) => {
    const { mfa_token, code } = req.body;
    if (!mfa_token || !code) {
      return res.status(400).json({ message: 'mfa_token and code required' });
    }
    const userId = verifyMfaChallenge(mfa_token);
    if (!userId) {
      return res.status(401).json({ message: 'Invalid or expired MFA challenge' });
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.mfa_enabled || !user.mfa_secret) {
        return res.status(401).json({ message: 'MFA not configured for this account' });
      }
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfa_secret), digits: 6, period: 30 });
      const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
      if (delta === null) {
        return res.status(401).json({ message: 'Invalid authentication code' });
      }
      const roles = await db.select().from(userRoles).where(eq(userRoles.user_id, user.id));
      const roleNames = roles.map(r => r.role);
      const token = signToken({ sub: user.id, email: user.email, full_name: user.full_name, roles: roleNames });
      res.json({ token, user_id: user.id, email: user.email, full_name: user.full_name, roles: roleNames });
    } catch (err: any) {
      console.error('[MFA] Verify error:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── MFA: get current status ────────────────────────
  app.get('/api/auth/mfa/status', requireAuth, async (req, res) => {
    const userId = (req as any).user.sub;
    try {
      const [user] = await db.select({ mfa_enabled: users.mfa_enabled }).from(users).where(eq(users.id, userId)).limit(1);
      res.json({ mfa_enabled: user?.mfa_enabled ?? false });
    } catch (err: any) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── MFA: generate setup (secret + QR code) ────────
  app.post('/api/auth/mfa/setup', requireAuth, async (req, res) => {
    const userId = (req as any).user.sub;
    const email = (req as any).user.email;
    try {
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: 'Sonaro Gate',
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      });
      const otpAuthUrl = totp.toString();
      const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
      // Store the pending secret in a temp field (reuse mfa_secret, not enabled yet)
      await db.update(users).set({ mfa_secret: secret.base32, mfa_enabled: false }).where(eq(users.id, userId));
      res.json({ secret: secret.base32, qr: qrDataUrl, otpauth_url: otpAuthUrl });
    } catch (err: any) {
      console.error('[MFA] Setup error:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── MFA: confirm setup (verify first code, enable) ──
  app.post('/api/auth/mfa/confirm', requireAuth, async (req, res) => {
    const userId = (req as any).user.sub;
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'code required' });
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.mfa_secret) {
        return res.status(400).json({ message: 'MFA setup not initiated. Call /api/auth/mfa/setup first.' });
      }
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfa_secret), digits: 6, period: 30 });
      const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
      if (delta === null) {
        return res.status(401).json({ message: 'Invalid code — check your authenticator app and try again' });
      }
      await db.update(users).set({ mfa_enabled: true, updated_at: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err: any) {
      console.error('[MFA] Confirm error:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── MFA: disable ──────────────────────────────────
  app.post('/api/auth/mfa/disable', requireAuth, async (req, res) => {
    const userId = (req as any).user.sub;
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Current password required to disable MFA' });
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!checkPassword(password, user.password_hash)) {
        return res.status(401).json({ message: 'Incorrect password' });
      }
      await db.update(users).set({ mfa_enabled: false, mfa_secret: null, updated_at: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err: any) {
      console.error('[MFA] Disable error:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ── Change password ────────────────────────────────
  app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const userId = (req as any).user.sub;
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'current_password and new_password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }
    if (new_password === current_password) {
      return res.status(400).json({ message: 'New password must be different from the current password' });
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!checkPassword(current_password, user.password_hash)) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      const { hashPassword } = await import('./auth.js');
      await db.update(users).set({ password_hash: hashPassword(new_password), updated_at: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Auth] Change password error:', err.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ─────────────────────────────────────────────────
  // Admin Users & Audit Logs
  // ─────────────────────────────────────────────────

  // GET /api/admin/users — list all users with their roles
  app.get('/api/admin/users', requireAuth, async (_req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id, email: users.email, full_name: users.full_name,
        avatar_url: users.avatar_url, created_at: users.created_at,
      }).from(users);
      const allRoles = await db.select().from(userRoles);
      const roleMap = new Map<string, string[]>();
      for (const r of allRoles) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      }
      const result = allUsers
        .filter(u => (roleMap.get(u.id) ?? []).length > 0)
        .map(u => ({
          userId: u.id,
          fullName: u.full_name,
          email: u.email,
          avatarUrl: u.avatar_url,
          roles: roleMap.get(u.id) ?? [],
          createdAt: u.created_at,
        }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/users — create new admin user
  app.post('/api/admin/users', requireAuth, async (req, res) => {
    const { email, password, full_name, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'email, password and role are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const validRoles = ['super_admin', 'admin', 'operator', 'auditor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    try {
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) return res.status(409).json({ message: 'A user with that email already exists' });
      const { hashPassword } = await import('./auth.js');
      const [newUser] = await db.insert(users).values({
        email, full_name: full_name || '', password_hash: hashPassword(password),
      }).returning({ id: users.id });
      await db.insert(userRoles).values({ user_id: newUser.id, role });
      res.status(201).json({ success: true, userId: newUser.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/admin/users/:id — update user full_name and/or role
  app.patch('/api/admin/users/:id', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    const { full_name, role } = req.body;
    const validRoles = ['super_admin', 'admin', 'operator', 'auditor'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    try {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (full_name !== undefined) {
        await db.update(users).set({ full_name, updated_at: new Date() }).where(eq(users.id, id));
      }
      if (role) {
        await db.delete(userRoles).where(eq(userRoles.user_id, id));
        await db.insert(userRoles).values({ user_id: id, role });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/admin/users/:id — remove all roles (revoke admin access)
  app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    const requesterId = (req as any).user.sub;
    if (id === requesterId) {
      return res.status(400).json({ message: 'You cannot remove your own admin access' });
    }
    try {
      await db.delete(userRoles).where(eq(userRoles.user_id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/audit-logs — recent audit log entries
  app.get('/api/admin/audit-logs', requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '100')), 500);
    try {
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.created_at)).limit(limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─────────────────────────────────────────────────
  // Notifications (Telegram / Discord)
  // ─────────────────────────────────────────────────

  // List channels (secrets masked)
  app.get('/api/notifications/channels', requireAuth, async (_req, res) => {
    try {
      const channels = await db.select().from(notificationChannels);
      const safe = channels.map(ch => ({
        id: ch.id, name: ch.name, type: ch.type,
        enabled: ch.enabled, created_at: ch.created_at,
        // Return masked config so the client can show field names but not values
        config_preview: (() => {
          try {
            const raw = JSON.parse(decryptConfig(ch.config_enc)) as Record<string, string>;
            return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, maskSecret(v)]));
          } catch { return {}; }
        })(),
      }));
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create channel
  app.post('/api/notifications/channels', requireAuth, async (req, res) => {
    const { name, type, config } = req.body;
    if (!name || !type || !config) return res.status(400).json({ message: 'name, type, config required' });
    if (!['telegram', 'discord'].includes(type)) return res.status(400).json({ message: 'type must be telegram or discord' });
    // Validate required config fields
    if (type === 'telegram' && (!config.bot_token || !config.chat_id)) {
      return res.status(400).json({ message: 'Telegram requires bot_token and chat_id' });
    }
    if (type === 'discord' && !config.webhook_url) {
      return res.status(400).json({ message: 'Discord requires webhook_url' });
    }
    if (type === 'discord' && !config.webhook_url.startsWith('https://discord.com/api/webhooks/')) {
      return res.status(400).json({ message: 'Invalid Discord webhook URL' });
    }
    try {
      const config_enc = encryptConfig(JSON.stringify(config));
      const [ch] = await db.insert(notificationChannels).values({ name, type, config_enc }).returning();
      res.json({ id: ch.id, name: ch.name, type: ch.type, enabled: ch.enabled });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update channel
  app.put('/api/notifications/channels/:id', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    const { name, enabled, config } = req.body;
    try {
      const updates: Record<string, any> = { updated_at: new Date() };
      if (name     !== undefined) updates.name    = name;
      if (enabled  !== undefined) updates.enabled = enabled;
      if (config) updates.config_enc = encryptConfig(JSON.stringify(config));
      await db.update(notificationChannels).set(updates).where(eq(notificationChannels.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete channel
  app.delete('/api/notifications/channels/:id', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    try {
      await db.delete(notificationChannels).where(eq(notificationChannels.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Test channel — send a test message
  app.post('/api/notifications/channels/:id/test', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    const result = await testChannel(id);
    if (result.ok) res.json({ success: true });
    else res.status(400).json({ message: result.error });
  });

  // List rules
  app.get('/api/notifications/rules', requireAuth, async (_req, res) => {
    try {
      const rules = await db.select().from(notificationRules);
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create rule
  app.post('/api/notifications/rules', requireAuth, async (req, res) => {
    const { channel_id, name, event_types, trigger_mode, schedule_interval, min_severity } = req.body;
    if (!channel_id || !name || !event_types?.length) {
      return res.status(400).json({ message: 'channel_id, name, event_types required' });
    }
    try {
      const [rule] = await db.insert(notificationRules).values({
        channel_id, name,
        event_types: event_types as string[],
        trigger_mode: trigger_mode ?? 'realtime',
        schedule_interval: schedule_interval ?? 60,
        min_severity: min_severity ?? 'medium',
      }).returning();
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update rule
  app.put('/api/notifications/rules/:id', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    const { name, event_types, trigger_mode, schedule_interval, min_severity, enabled } = req.body;
    try {
      const updates: Record<string, any> = { updated_at: new Date() };
      if (name              !== undefined) updates.name              = name;
      if (event_types       !== undefined) updates.event_types       = event_types;
      if (trigger_mode      !== undefined) updates.trigger_mode      = trigger_mode;
      if (schedule_interval !== undefined) updates.schedule_interval = schedule_interval;
      if (min_severity      !== undefined) updates.min_severity      = min_severity;
      if (enabled           !== undefined) updates.enabled           = enabled;
      await db.update(notificationRules).set(updates).where(eq(notificationRules.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete rule
  app.delete('/api/notifications/rules/:id', requireAuth, async (req, res) => {
    const id = req.params.id as string;
    try {
      await db.delete(notificationRules).where(eq(notificationRules.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
    res.json({ raw: await getInterfaceDetails(req.params.name as string) });
  });

  app.post('/api/system/interfaces/:name/apply', requireAuth, async (req, res) => {
    const name = req.params.name as string;
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
    const name = req.params.name as string;
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
    const sid = parseInt(req.params.sid as string);
    const { enabled } = req.body;
    if (isNaN(sid)) return res.status(400).json({ ok: false, message: 'invalid sid' });
    res.json(await setRuleEnabled(sid, Boolean(enabled)));
  });

  app.delete('/api/system/ips/rules/:sid', requireAuth, async (req, res) => {
    const sid = parseInt(req.params.sid as string);
    if (isNaN(sid)) return res.status(400).json({ ok: false, message: 'invalid sid' });
    res.json(await deleteRule(sid));
  });

  app.get('/api/system/ips/alerts', requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ alerts: await getRecentAlerts(limit) });
  });

  // ─────────────────────────────────────────────────
  // VPN — generate & apply config files to system
  // ─────────────────────────────────────────────────
  app.post('/api/vpn/apply', requireAuth, async (_req, res) => {
    try {
      const tunnelRows = await db.select().from(vpnTunnels);
      const ipsecTunnels = tunnelRows.filter((t: any) => t.type === 'ipsec');
      const wgTunnels   = tunnelRows.filter((t: any) => t.type === 'wireguard');

      const fs = await import('fs/promises');
      const path = await import('path');
      const applied: string[] = [];
      const skipped: string[] = [];

      // ── IPsec (strongSwan) ──────────────────────────────
      if (ipsecTunnels.length > 0) {
        let ipsecConf = '# Generated by Sonaro Gate — do not edit manually\n\n';
        ipsecConf += 'config setup\n  charondebug="ike 1, knl 1, cfg 0"\n\n';
        let secrets = '# /etc/ipsec.secrets — Generated by Sonaro Gate\n\n';

        for (const t of ipsecTunnels) {
          const cfg = typeof t.config_json === 'string' ? JSON.parse(t.config_json || '{}') : (t.config_json || {});
          const connName = (t.name as string).replace(/\s+/g, '_');
          ipsecConf += `conn ${connName}\n`;
          ipsecConf += `  keyexchange=${cfg.ikeVersion ?? 'ikev2'}\n`;
          ipsecConf += `  left=${cfg.local_address ?? '%defaultroute'}\n`;
          ipsecConf += `  leftsubnet=${cfg.local_subnet ?? '0.0.0.0/0'}\n`;
          ipsecConf += `  right=${cfg.remote_gateway ?? '0.0.0.0'}\n`;
          ipsecConf += `  rightsubnet=${cfg.remote_subnet ?? '0.0.0.0/0'}\n`;
          ipsecConf += `  ike=${cfg.encryption ?? 'aes256'}-${cfg.hash ?? 'sha256'}-modp2048\n`;
          ipsecConf += `  esp=${cfg.encryption ?? 'aes256'}-${cfg.hash ?? 'sha256'}\n`;
          ipsecConf += `  auto=${t.status === 'connected' ? 'start' : 'add'}\n\n`;
          if (cfg.psk) {
            secrets += `: PSK "${cfg.psk}"\n`;
          }
        }

        try {
          await fs.writeFile('/etc/ipsec.conf', ipsecConf, 'utf8');
          await fs.writeFile('/etc/ipsec.secrets', secrets, 'utf8');
          await hostExec('ipsec reload', { timeout: 5000 }); // ok if daemon not running
          applied.push('ipsec');
        } catch {
          skipped.push('ipsec (no write permission — run as root)');
        }
      }

      // ── WireGuard ───────────────────────────────────────
      for (const t of wgTunnels) {
        const cfg = typeof t.config_json === 'string' ? JSON.parse(t.config_json || '{}') : (t.config_json || {});
        const iface = cfg.interface ?? 'wg0';
        let wgConf = '# Generated by Sonaro Gate — do not edit manually\n\n';
        wgConf += '[Interface]\n';
        wgConf += `PrivateKey = ${cfg.privateKey ?? ''}\n`;
        wgConf += `Address = ${cfg.address ?? '10.0.0.1/24'}\n`;
        wgConf += `ListenPort = ${cfg.listenPort ?? 51820}\n\n`;
        wgConf += '[Peer]\n';
        wgConf += `PublicKey = ${cfg.peerPublicKey ?? ''}\n`;
        wgConf += `AllowedIPs = ${cfg.allowedIPs ?? '0.0.0.0/0'}\n`;
        if (cfg.endpoint) wgConf += `Endpoint = ${cfg.endpoint}\n`;

        const wgPath = path.join('/etc/wireguard', `${iface}.conf`);
        try {
          await fs.mkdir('/etc/wireguard', { recursive: true });
          await fs.writeFile(wgPath, wgConf, { encoding: 'utf8', mode: 0o600 });
          // Live-reload config into running wg interface (no-op if interface doesn't exist yet)
          await hostExec(`wg syncconf ${iface} <(wg-quick strip ${iface})`, { timeout: 5000 });
          applied.push(`wireguard:${iface}`);
        } catch {
          skipped.push(`wireguard:${iface} (no write permission — run as root)`);
        }
      }

      const msg = applied.length > 0
        ? `Applied: ${applied.join(', ')}${skipped.length ? `. Skipped: ${skipped.join(', ')}` : ''}`
        : `No changes applied${skipped.length ? `. Skipped: ${skipped.join(', ')}` : ''}`;

      res.json({ ok: true, message: msg, applied, skipped });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: `VPN apply failed: ${e.message}` });
    }
  });

  // ─────────────────────────────────────────────────
  // CLI Execution — real Linux commands
  // ─────────────────────────────────────────────────
  app.post('/api/cli/exec', requireAuth, async (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ stdout: '', stderr: 'Missing command', exitCode: 1 });
    }
    try {
      const result = await dispatchCLI(command.trim());
      res.json(result);
    } catch (e: any) {
      res.json({ stdout: '', stderr: `Internal error: ${e.message}`, exitCode: 1 });
    }
  });

  // ─────────────────────────────────────────────────
  // Backup Export / Import
  // ─────────────────────────────────────────────────

  app.get('/api/backup/export', requireAuth, async (req, res) => {
    try {
      const sections = (req.query.sections as string || 'firewall_rules,nat_rules,aliases,schedules,certificates,static_routes,vpn_tunnels').split(',');
      const hostname = (await db.select().from(systemSettings).where(
        eq(systemSettings.key, 'hostname')
      ).limit(1))[0]?.value || 'SONARO-GATE';

      const data: Record<string, any> = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        hostname,
        type: 'sonaro_gate_backup',
      };

      if (sections.includes('firewall_rules')) {
        data.firewall_rules = await db.select().from(firewallRules);
      }
      if (sections.includes('nat_rules')) {
        data.nat_rules = await db.select().from(natRules);
      }
      if (sections.includes('aliases')) {
        data.aliases = await db.select().from(aliases);
      }
      if (sections.includes('schedules')) {
        data.schedules = await db.select().from(schedules);
      }
      if (sections.includes('certificates')) {
        data.certificates = await db.select().from(certificates);
      }
      if (sections.includes('static_routes')) {
        data.static_routes = await db.select().from(staticRoutes);
      }
      if (sections.includes('vpn_tunnels')) {
        data.vpn_tunnels = await db.select().from(vpnTunnels);
      }

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Export failed', message: String(err) });
    }
  });

  app.post('/api/backup/import', requireAuth, async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.version) {
        return res.status(400).json({ error: 'Invalid backup file' });
      }

      const results: Record<string, number> = {};

      if (data.firewall_rules?.length) {
        for (const rule of data.firewall_rules) {
          const { id, created_at, updated_at, ...rest } = rule;
          await db.insert(firewallRules).values(rest).onConflictDoNothing();
        }
        results.firewall_rules = data.firewall_rules.length;
      }
      if (data.nat_rules?.length) {
        for (const rule of data.nat_rules) {
          const { id, created_at, updated_at, ...rest } = rule;
          await db.insert(natRules).values(rest).onConflictDoNothing();
        }
        results.nat_rules = data.nat_rules.length;
      }
      if (data.aliases?.length) {
        for (const alias of data.aliases) {
          const { id, created_at, updated_at, ...rest } = alias;
          await db.insert(aliases).values(rest).onConflictDoNothing();
        }
        results.aliases = data.aliases.length;
      }
      if (data.schedules?.length) {
        for (const sched of data.schedules) {
          const { id, created_at, updated_at, ...rest } = sched;
          await db.insert(schedules).values(rest).onConflictDoNothing();
        }
        results.schedules = data.schedules.length;
      }
      if (data.certificates?.length) {
        for (const cert of data.certificates) {
          const { id, created_at, updated_at, ...rest } = cert;
          await db.insert(certificates).values(rest).onConflictDoNothing();
        }
        results.certificates = data.certificates.length;
      }
      if (data.static_routes?.length) {
        for (const route of data.static_routes) {
          const { id, created_at, updated_at, ...rest } = route;
          await db.insert(staticRoutes).values(rest).onConflictDoNothing();
        }
        results.static_routes = data.static_routes.length;
      }
      if (data.vpn_tunnels?.length) {
        for (const tunnel of data.vpn_tunnels) {
          const { id, created_at, updated_at, ...rest } = tunnel;
          await db.insert(vpnTunnels).values(rest).onConflictDoNothing();
        }
        results.vpn_tunnels = data.vpn_tunnels.length;
      }

      // Record import in backup history
      const totalItems = Object.values(results).reduce((a, b) => a + b, 0);
      await db.insert(configBackups).values({
        filename: `imported-${new Date().toISOString().split('T')[0]}.json`,
        size_bytes: JSON.stringify(data).length,
        type: 'manual',
        status: 'success',
        firmware_version: data.version || '2.0',
        sections: Object.keys(results),
        notes: `Imported from backup (v${data.version || 'unknown'}) — ${totalItems} objects`,
      });

      res.json({ ok: true, imported: results });
    } catch (err) {
      res.status(500).json({ error: 'Import failed', message: String(err) });
    }
  });

  // ─────────────────────────────────────────────────
  // PostgREST-compatible CRUD
  // ─────────────────────────────────────────────────
  app.use('/api', createCrudRouter());

  // ─────────────────────────────────────────────────
  // HTTP / HTTPS + WebSocket server
  // ─────────────────────────────────────────────────

  // tlsEnabled / tlsCertFile / tlsKeyFile are already set in the CORS section above.
  // This section creates the appropriate server instance.

  let httpsServer: ReturnType<typeof createHttpsServer> | null = null;
  const httpServer = createHttpServer(app);

  if (tlsEnabled) {
    // Load cert + key — if either fails, fall back gracefully to HTTP
    const tlsCreds = (() => {
      try {
        return { cert: fs.readFileSync(tlsCertFile!), key: fs.readFileSync(tlsKeyFile!) };
      } catch (err: any) {
        console.error('[TLS] Cannot read certificate files:', err.message);
        console.error('[TLS] Check TLS_CERT_FILE / TLS_KEY_FILE in .env — falling back to HTTP');
        return null;
      }
    })();

    if (tlsCreds) {
      const tlsOptions = {
        cert: tlsCreds.cert,
        key:  tlsCreds.key,
        // Enforce TLS 1.2+ — disables SSL 3.0/TLS 1.0/1.1 explicitly (Node 20
        // defaults to TLSv1.2 but we state it explicitly for all Node builds)
        minVersion: 'TLSv1.2' as const,
        // Strong ECDHE/DHE + AES-GCM/CHACHA20 ciphers only (no RC4, 3DES, CBC-SHA)
        // TLS 1.3 suites are always available and negotiated preferentially by Node.js
        ciphers: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_AES_128_GCM_SHA256',
          'TLS_CHACHA20_POLY1305_SHA256',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA256',
          'DHE-RSA-AES256-GCM-SHA384',
          'DHE-RSA-AES128-GCM-SHA256',
        ].join(':'),
        honorCipherOrder: true,
      };
      httpsServer = createHttpsServer(tlsOptions, app);
      attachWebSocket(httpsServer);
      httpsServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[TLS] Port ${PORT} already in use — is another instance running?`);
        } else {
          console.error('[TLS] HTTPS server error:', err.message);
        }
        process.exit(1);
      });
      console.log('[TLS] Certificates loaded — HTTPS server ready (TLS 1.2+, strong ciphers)');
    }
  }

  if (!httpsServer) {
    // Plain HTTP — dev mode or TLS cert load failure
    attachWebSocket(httpServer);
    if (!isDev) {
      console.warn('[TLS] TLS_CERT_FILE / TLS_KEY_FILE not configured — running plain HTTP');
    }
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port already in use — is another instance running?`);
    } else {
      console.error('[Server] HTTP server error:', err.message);
    }
    process.exit(1);
  });

  // ─────────────────────────────────────────────────
  // Frontend — Vite dev or static production build
  // ─────────────────────────────────────────────────
  if (isDev) {
    // Dynamic import so 'vite' (a devDependency) is never required at startup
    // in the production container where it is not installed (npm ci --omit=dev).
    // A static top-level import would crash production on module load, before
    // any NODE_ENV check is reached.
    const { createServer: createViteServer } = await import('vite');
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
    // Express 5 + path-to-regexp v8: bare '*' is invalid — must use '/{*path}'
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // ─────────────────────────────────────────────────
  // Listen
  // ─────────────────────────────────────────────────
  // Use HTTPS server only if it was successfully created (cert files readable)
  const activeServer = httpsServer ?? httpServer;
  const protocol     = httpsServer ? 'https' : 'http';

  activeServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Sonaro Gate backend running on port ${PORT} (${protocol.toUpperCase()})`);
    console.log(`[Server] Mode: ${isDev ? 'development' : 'production'}`);
    if (httpsServer) {
      console.log(`[Server] ✓  TLS enabled — data encrypted in transit (TLS 1.2+)`);
      console.log(`[Server] ✓  Self-signed cert — browser will warn until local CA is trusted`);
    }

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
          console.log(`[Server] ✓  Web UI: ${protocol}://${lanIp}:${PORT}`);
        }
      }).catch(() => {});
  });

  // In TLS mode also spin up a plain-HTTP redirect server on port 80
  // so that http://ip/ automatically redirects to https://ip:443/
  if (httpsServer && PORT === 443) {
    const httpRedirect = createHttpServer((_req, res) => {
      const host = (_req.headers.host ?? '').replace(/:.*$/, '');
      res.writeHead(301, {
        'Location': `https://${host}/`,
        'X-Content-Type-Options': 'nosniff',
      });
      res.end();
    });
    httpRedirect.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn('[Server] ⚠  Port 80 already in use — HTTP→HTTPS redirect skipped');
      } else {
        console.warn('[Server] ⚠  HTTP redirect server error:', err.message);
      }
      // Non-fatal: HTTPS on 443 still works, users can navigate directly to https://
    });
    httpRedirect.listen(80, '0.0.0.0', () => {
      console.log('[Server] ✓  HTTP→HTTPS redirect active on port 80');
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// Boot sequence
// ─────────────────────────────────────────────────────────────────

async function main() {
  // 0. Apply DB schema migrations (idempotent — safe on every startup).
  //    Tables are created here before seedDatabase() queries them.
  await runMigrations();

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
  startNotificationScheduler();

  // 4. Start web server
  await startWebServer();
}

main().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
