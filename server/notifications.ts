/**
 * Sonaro Gate — Notification Dispatcher (Telegram + Discord)
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * SPDX-License-Identifier: MIT
 *
 * Security: channel credentials (bot tokens, webhook URLs) are stored
 * AES-256-GCM encrypted. The key is derived from JWT_SECRET at startup.
 * Plaintext secrets never leave the server process.
 */

import crypto from 'crypto';
import { db } from './db.js';
import { notificationChannels, notificationRules } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

// ── Encryption ────────────────────────────────────────────────────────────────
// Key = SHA-256(JWT_SECRET) → 32 bytes for AES-256-GCM
const RAW_KEY = process.env.JWT_SECRET || 'sonaro-gate-secret-change-in-production';
const ENC_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();

export function encryptConfig(plain: string): string {
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptConfig(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted config format');
  const [ivHex, tagHex, ctHex] = parts;
  const iv  = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ct  = Buffer.from(ctHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString('utf8') + decipher.final('utf8');
}

// ── Severity levels ───────────────────────────────────────────────────────────
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'] as const;
type Severity = typeof SEVERITY_ORDER[number];

function severityIndex(s: string): number {
  return SEVERITY_ORDER.indexOf(s as Severity);
}

// ── Telegram sender ───────────────────────────────────────────────────────────
async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

// ── Discord sender ────────────────────────────────────────────────────────────
async function sendDiscord(webhookUrl: string, content: string, embeds?: object[]): Promise<void> {
  const body: any = { content };
  if (embeds?.length) body.embeds = embeds;
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
}

// ── Severity → color ──────────────────────────────────────────────────────────
function discordColor(severity: string): number {
  const map: Record<string, number> = {
    low:      0x3b82f6, // blue
    medium:   0xf59e0b, // amber
    high:     0xef4444, // red
    critical: 0x7c3aed, // purple
  };
  return map[severity] ?? 0x6b7280;
}

function severityEmoji(severity: string): string {
  const map: Record<string, string> = {
    low: '🔵', medium: '🟡', high: '🔴', critical: '🟣',
  };
  return map[severity] ?? '⚪';
}

// ── Event labels ──────────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  threat_detected:  'Threat Detected',
  auth_failure:     'Authentication Failure',
  vpn_event:        'VPN Event',
  system_health:    'System Health Alert',
  firewall_block:   'Firewall Block',
  config_change:    'Configuration Changed',
  scheduled_report: 'Scheduled Report',
};

// ── Format message ────────────────────────────────────────────────────────────
interface NotifEvent {
  type: string;
  severity: string;
  message: string;
  detail?: string;
  source_ip?: string;
}

function formatTelegramMessage(event: NotifEvent): string {
  const emoji = severityEmoji(event.severity);
  const label = EVENT_LABELS[event.type] ?? event.type;
  const time  = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  let msg = `${emoji} <b>Sonaro Gate — ${label}</b>\n`;
  msg += `Severity: <b>${event.severity.toUpperCase()}</b>\n`;
  msg += `${event.message}\n`;
  if (event.detail)    msg += `Detail: ${event.detail}\n`;
  if (event.source_ip) msg += `Source IP: <code>${event.source_ip}</code>\n`;
  msg += `Time: ${time}`;
  return msg;
}

function formatDiscordEmbed(event: NotifEvent): object {
  const label = EVENT_LABELS[event.type] ?? event.type;
  const fields: object[] = [
    { name: 'Severity', value: event.severity.toUpperCase(), inline: true },
    { name: 'Event Type', value: label, inline: true },
  ];
  if (event.source_ip) fields.push({ name: 'Source IP', value: `\`${event.source_ip}\``, inline: true });
  if (event.detail)    fields.push({ name: 'Detail', value: event.detail, inline: false });
  return {
    title: `${severityEmoji(event.severity)} ${label}`,
    description: event.message,
    color: discordColor(event.severity),
    fields,
    footer: { text: 'Sonaro Gate Security Console' },
    timestamp: new Date().toISOString(),
  };
}

// ── Dispatch to one channel ───────────────────────────────────────────────────
async function dispatchToChannel(channelId: string, event: NotifEvent): Promise<void> {
  const [ch] = await db.select().from(notificationChannels)
    .where(and(eq(notificationChannels.id, channelId), eq(notificationChannels.enabled, true)))
    .limit(1);
  if (!ch) return;

  const config = JSON.parse(decryptConfig(ch.config_enc)) as Record<string, string>;

  if (ch.type === 'telegram') {
    const text = formatTelegramMessage(event);
    await sendTelegram(config.bot_token, config.chat_id, text);
  } else if (ch.type === 'discord') {
    const embed = formatDiscordEmbed(event);
    await sendDiscord(config.webhook_url, '', [embed]);
  }
}

// ── Public dispatch ───────────────────────────────────────────────────────────
export async function dispatchNotification(event: NotifEvent): Promise<void> {
  try {
    const rules = await db.select().from(notificationRules)
      .where(and(
        eq(notificationRules.enabled, true),
        eq(notificationRules.trigger_mode, 'realtime'),
      ));

    for (const rule of rules) {
      // Check event type filter
      if (!rule.event_types.includes(event.type)) continue;
      // Check minimum severity
      const minSev = rule.min_severity ?? 'low';
      if (severityIndex(event.severity) < severityIndex(minSev)) continue;
      try {
        await dispatchToChannel(rule.channel_id, event);
      } catch (err: any) {
        console.error(`[Notif] Failed to dispatch to channel ${rule.channel_id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[Notif] Dispatch error:', err.message);
  }
}

// ── Test notification ─────────────────────────────────────────────────────────
export async function testChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await dispatchToChannel(channelId, {
      type:     'threat_detected',
      severity: 'medium',
      message:  'This is a test notification from Sonaro Gate. Your channel is configured correctly.',
      detail:   'Test triggered manually from the Notifications settings page.',
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ── Scheduled report builder ──────────────────────────────────────────────────
async function buildScheduledReport(): Promise<NotifEvent> {
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60 * 1000); // last hour
  const period = since.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  return {
    type:     'scheduled_report',
    severity: 'low',
    message:  `📊 Sonaro Gate — Scheduled Status Report`,
    detail:   `Report period: since ${period}\nSystem is operational. Check the console for detailed metrics.`,
  };
}

// ── Scheduler ────────────────────────────────────────────────────────────────
// Checks every 60 seconds if any scheduled rule is due
export function startNotificationScheduler(): void {
  setInterval(async () => {
    try {
      const rules = await db.select().from(notificationRules)
        .where(and(
          eq(notificationRules.enabled, true),
          eq(notificationRules.trigger_mode, 'scheduled'),
        ));

      const now = new Date();
      for (const rule of rules) {
        const intervalMs = (rule.schedule_interval ?? 60) * 60 * 1000;
        const lastSent   = rule.last_sent_at ? new Date(rule.last_sent_at).getTime() : 0;
        if (now.getTime() - lastSent < intervalMs) continue;

        try {
          const event = await buildScheduledReport();
          await dispatchToChannel(rule.channel_id, event);
          await db.update(notificationRules)
            .set({ last_sent_at: now })
            .where(eq(notificationRules.id, rule.id));
        } catch (err: any) {
          console.error(`[Notif] Scheduled send failed for rule ${rule.id}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error('[Notif] Scheduler error:', err.message);
    }
  }, 60_000);
}
