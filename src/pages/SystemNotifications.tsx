/**
 * Sonaro Gate — System Notifications (Telegram / Discord)
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { apiRequest } from '@/lib/queryClient';
import {
  Bell, BellOff, Plus, Trash2, TestTube2, Edit, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Clock, Zap, Eye, EyeOff,
} from 'lucide-react';
type IconProps = { size?: number; className?: string; color?: string };
const SiTelegram = ({ size = 16, className = '', color }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? 'currentColor'} className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-2.034 9.58c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.877l-2.953-.924c-.642-.204-.654-.642.136-.953l11.543-4.451c.537-.194 1.006.131.978.672z"/>
  </svg>
);
const SiDiscord = ({ size = 16, className = '', color }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? 'currentColor'} className={className}>
    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.2 13.2 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
  </svg>
);
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Channel {
  id: string;
  name: string;
  type: 'telegram' | 'discord';
  enabled: boolean;
  created_at: string;
  config_preview: Record<string, string>;
}

interface Rule {
  id: string;
  channel_id: string;
  name: string;
  event_types: string[];
  trigger_mode: 'realtime' | 'scheduled';
  schedule_interval: number;
  min_severity: string;
  enabled: boolean;
  last_sent_at: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { value: 'threat_detected',  label: 'Threat Detected',         desc: 'IDS/IPS alerts from Suricata' },
  { value: 'auth_failure',     label: 'Authentication Failure',  desc: 'Failed login attempts' },
  { value: 'firewall_block',   label: 'Firewall Block',          desc: 'Traffic blocked by firewall rules' },
  { value: 'vpn_event',        label: 'VPN Event',               desc: 'VPN tunnel connect / disconnect' },
  { value: 'system_health',    label: 'System Health',           desc: 'High CPU / memory / disk usage' },
  { value: 'config_change',    label: 'Configuration Changed',   desc: 'Rule or setting changes' },
];

const SEVERITY_OPTS = [
  { value: 'low',      label: 'Low and above',      color: '#3b82f6' },
  { value: 'medium',   label: 'Medium and above',   color: '#f59e0b' },
  { value: 'high',     label: 'High and above',     color: '#ef4444' },
  { value: 'critical', label: 'Critical only',      color: '#7c3aed' },
];

const SCHEDULE_OPTS = [
  { value: 30,   label: 'Every 30 minutes' },
  { value: 60,   label: 'Every hour' },
  { value: 180,  label: 'Every 3 hours' },
  { value: 360,  label: 'Every 6 hours' },
  { value: 720,  label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' },
];

// ── Styles ───────────────────────────────────────────────────────────────────
const C = {
  surface:    '#161b22',
  surfaceHdr: '#0d1117',
  surfaceRow: '#1a2030',
  border:     '#21262d',
  borderFocus:'#3fb950',
  text:       '#e6edf3',
  textSub:    '#7d8590',
  textMuted:  '#484f58',
  green:      '#1c6e30',
  greenAcc:   '#3fb950',
  red:        '#b91c1c',
  redLight:   '#f87171',
  blue:       '#1d4ed8',
  telegramBg: '#0088cc',
  discordBg:  '#5865f2',
};

function card(style?: React.CSSProperties): React.CSSProperties {
  return {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    overflow: 'hidden', ...style,
  };
}

function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textSub, marginBottom: 6 };
}

function inputStyle(focus: boolean): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    fontSize: 12, color: C.text, background: C.surfaceHdr,
    border: `1px solid ${focus ? C.borderFocus : C.border}`,
    borderRadius: 5, outline: 'none', transition: 'border-color 0.15s',
    fontFamily: 'monospace',
  };
}

function btn(variant: 'green' | 'red' | 'outline' | 'ghost', disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'opacity 0.1s', opacity: disabled ? 0.5 : 1, border: 'none' };
  if (variant === 'green')   return { ...base, background: C.green,   color: '#fff', border: `1px solid ${C.green}` };
  if (variant === 'red')     return { ...base, background: C.red,     color: '#fff', border: `1px solid ${C.red}` };
  if (variant === 'outline') return { ...base, background: 'none',    color: C.textSub, border: `1px solid ${C.border}` };
  return { ...base, background: 'none', color: C.textSub, border: 'none', padding: '6px 10px' };
}

// ── Channel icon ─────────────────────────────────────────────────────────────
function ChannelIcon({ type }: { type: 'telegram' | 'discord' }) {
  const bg = type === 'telegram' ? C.telegramBg : C.discordBg;
  return (
    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {type === 'telegram'
        ? <SiTelegram size={16} color="#fff" />
        : <SiDiscord  size={16} color="#fff" />}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SystemNotifications() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'channels' | 'rules'>('channels');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: channels = [], isLoading: loadCh } = useQuery<Channel[]>({
    queryKey: ['/api/notifications/channels'],
  });
  const { data: rules = [], isLoading: loadRules } = useQuery<Rule[]>({
    queryKey: ['/api/notifications/rules'],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteCh = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notifications/channels/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/notifications/channels'] }); toast.success('Channel deleted.'); },
  });
  const toggleCh = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest('PUT', `/api/notifications/channels/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/notifications/channels'] }),
  });
  const testCh = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/notifications/channels/${id}/test`),
    onSuccess: () => toast.success('Test message sent successfully.'),
    onError: (err: any) => toast.error(`Test failed: ${err.message}`),
  });
  const deleteRule = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notifications/rules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/notifications/rules'] }); toast.success('Rule deleted.'); },
  });
  const toggleRule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest('PUT', `/api/notifications/rules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/notifications/rules'] }),
  });

  return (
    <Shell>
      <div style={{ padding: '24px 28px', maxWidth: 900 }}>

        {/* ── Page header ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Notifications</h2>
            <p style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
              Send security alerts to Telegram and Discord. Credentials are stored encrypted (AES-256-GCM).
            </p>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
          {(['channels', 'rules'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? C.greenAcc : C.textSub,
                borderBottom: `2px solid ${tab === t ? C.greenAcc : 'transparent'}`,
                marginBottom: -1,
                textTransform: 'capitalize',
              }}
            >
              {t === 'channels' ? `Channels (${channels.length})` : `Alert Rules (${rules.length})`}
            </button>
          ))}
        </div>

        {/* ── CHANNELS TAB ─────────────────────────────────────────── */}
        {tab === 'channels' && (
          <ChannelsTab
            channels={channels}
            loading={loadCh}
            onDelete={id => deleteCh.mutate(id)}
            onToggle={(id, e) => toggleCh.mutate({ id, enabled: e })}
            onTest={id => testCh.mutate(id)}
            testPending={testCh.isPending}
            testPendingId={testCh.variables as string}
            qc={qc}
          />
        )}

        {/* ── RULES TAB ────────────────────────────────────────────── */}
        {tab === 'rules' && (
          <RulesTab
            rules={rules}
            channels={channels}
            loading={loadRules}
            onDelete={id => deleteRule.mutate(id)}
            onToggle={(id, e) => toggleRule.mutate({ id, enabled: e })}
            qc={qc}
          />
        )}
      </div>
    </Shell>
  );
}

// ── Channels Tab ──────────────────────────────────────────────────────────────
function ChannelsTab({ channels, loading, onDelete, onToggle, onTest, testPending, testPendingId, qc }: {
  channels: Channel[]; loading: boolean;
  onDelete: (id: string) => void; onToggle: (id: string, e: boolean) => void;
  onTest: (id: string) => void; testPending: boolean; testPendingId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button data-testid="button-add-channel" onClick={() => setShowAdd(true)} style={btn('green')}>
          <Plus size={12} /> Add Channel
        </button>
      </div>

      {loading && <p style={{ fontSize: 12, color: C.textSub }}>Loading…</p>}

      {!loading && channels.length === 0 && (
        <div style={{ ...card(), padding: '32px', textAlign: 'center' }}>
          <Bell size={28} style={{ color: C.textMuted, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>No notification channels configured yet.</p>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Add a Telegram bot or Discord webhook to start receiving alerts.</p>
        </div>
      )}

      {channels.map(ch => (
        <ChannelCard
          key={ch.id} channel={ch}
          onDelete={() => onDelete(ch.id)}
          onToggle={e => onToggle(ch.id, e)}
          onTest={() => onTest(ch.id)}
          testLoading={testPending && testPendingId === ch.id}
          qc={qc}
        />
      ))}

      {showAdd && <AddChannelModal onClose={() => setShowAdd(false)} qc={qc} />}
    </div>
  );
}

// ── Channel Card ──────────────────────────────────────────────────────────────
function ChannelCard({ channel, onDelete, onToggle, onTest, testLoading, qc }: {
  channel: Channel; onDelete: () => void; onToggle: (e: boolean) => void;
  onTest: () => void; testLoading: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={card()}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, background: C.surfaceHdr, borderBottom: expanded ? `1px solid ${C.border}` : 'none' }}>
        <ChannelIcon type={channel.type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{channel.name}</p>
          <p style={{ fontSize: 11, color: C.textSub, margin: 0, textTransform: 'capitalize' }}>{channel.type}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: channel.enabled ? 'rgba(63,185,80,0.12)' : 'rgba(100,100,100,0.12)', color: channel.enabled ? C.greenAcc : C.textMuted, border: `1px solid ${channel.enabled ? 'rgba(63,185,80,0.3)' : C.border}` }}>
            {channel.enabled ? 'Active' : 'Disabled'}
          </span>
          <button data-testid={`button-test-channel-${channel.id}`} onClick={onTest} disabled={testLoading} style={btn('outline', testLoading)} title="Send test message">
            <TestTube2 size={11} /> {testLoading ? 'Sending…' : 'Test'}
          </button>
          <button onClick={() => onToggle(!channel.enabled)} style={btn('ghost')} title={channel.enabled ? 'Disable' : 'Enable'}>
            {channel.enabled ? <BellOff size={13} /> : <Bell size={13} />}
          </button>
          <button onClick={() => setExpanded(v => !v)} style={btn('ghost')}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button data-testid={`button-delete-channel-${channel.id}`} onClick={onDelete} style={btn('ghost')} title="Delete">
            <Trash2 size={13} style={{ color: C.redLight }} />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 10 }}>Credentials (masked)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(channel.config_preview).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.textSub, width: 120, flexShrink: 0, fontFamily: 'monospace' }}>{k}</span>
                <code style={{ fontSize: 12, color: C.text, background: C.surfaceHdr, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.05em', border: `1px solid ${C.border}` }}>{v}</code>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: C.textMuted, marginTop: 10 }}>
            Credentials are stored encrypted (AES-256-GCM). To update, delete and re-add this channel.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Add Channel Modal ─────────────────────────────────────────────────────────
function AddChannelModal({ onClose, qc }: { onClose: () => void; qc: ReturnType<typeof useQueryClient> }) {
  const [type, setType]   = useState<'telegram' | 'discord'>('telegram');
  const [name, setName]   = useState('');
  const [botToken, setBotToken]   = useState('');
  const [chatId, setChatId]       = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focuses, setFocuses]     = useState<Record<string, boolean>>({});
  const setFocus = (k: string, v: boolean) => setFocuses(f => ({ ...f, [k]: v }));

  const add = useMutation({
    mutationFn: (body: any) => apiRequest('POST', '/api/notifications/channels', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notifications/channels'] });
      toast.success('Channel added successfully.');
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Channel name is required.'); return; }
    const config = type === 'telegram'
      ? { bot_token: botToken.trim(), chat_id: chatId.trim() }
      : { webhook_url: webhookUrl.trim() };
    add.mutate({ name: name.trim(), type, config });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
      <div style={{ ...card(), width: '100%', maxWidth: 480, margin: '0 16px' }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surfaceHdr, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Add Notification Channel</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Type selector */}
          <div>
            <label style={labelStyle()}>Platform</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['telegram', 'discord'] as const).map(t => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  data-testid={`button-channel-type-${t}`}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                    background: type === t ? (t === 'telegram' ? 'rgba(0,136,204,0.15)' : 'rgba(88,101,242,0.15)') : C.surfaceHdr,
                    border: `1px solid ${type === t ? (t === 'telegram' ? '#0088cc' : '#5865f2') : C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {t === 'telegram' ? <SiTelegram size={14} color={type === t ? '#0088cc' : C.textMuted} /> : <SiDiscord size={14} color={type === t ? '#5865f2' : C.textMuted} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: type === t ? C.text : C.textSub, textTransform: 'capitalize' }}>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Channel name */}
          <div>
            <label style={labelStyle()}>Channel Name</label>
            <input data-testid="input-channel-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SOC Alerts Bot" style={inputStyle(focuses.name)} onFocus={() => setFocus('name', true)} onBlur={() => setFocus('name', false)} />
          </div>

          {/* Telegram fields */}
          {type === 'telegram' && (
            <>
              <div>
                <label style={labelStyle()}>Bot Token</label>
                <div style={{ position: 'relative' }}>
                  <input
                    data-testid="input-bot-token"
                    type={showToken ? 'text' : 'password'}
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                    placeholder="1234567890:AABBCCddEEFFggHH..."
                    style={{ ...inputStyle(focuses.token), paddingRight: 36 }}
                    onFocus={() => setFocus('token', true)}
                    onBlur={() => setFocus('token', false)}
                  />
                  <button type="button" onClick={() => setShowToken(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
                    {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <p style={{ fontSize: 10, color: C.textMuted, marginTop: 5 }}>Create a bot via @BotFather on Telegram and paste the token here.</p>
              </div>
              <div>
                <label style={labelStyle()}>Chat ID</label>
                <input data-testid="input-chat-id" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="-100123456789 or @channelname" style={inputStyle(focuses.chatId)} onFocus={() => setFocus('chatId', true)} onBlur={() => setFocus('chatId', false)} />
                <p style={{ fontSize: 10, color: C.textMuted, marginTop: 5 }}>Add @userinfobot to get your chat ID, or use a channel username.</p>
              </div>
            </>
          )}

          {/* Discord fields */}
          {type === 'discord' && (
            <div>
              <label style={labelStyle()}>Webhook URL</label>
              <input
                data-testid="input-webhook-url"
                type={showToken ? 'text' : 'password'}
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                style={{ ...inputStyle(focuses.webhook), paddingRight: 36 }}
                onFocus={() => setFocus('webhook', true)}
                onBlur={() => setFocus('webhook', false)}
              />
              <div style={{ position: 'relative', marginTop: -28, display: 'flex', justifyContent: 'flex-end', paddingRight: 10, pointerEvents: 'none' }}>
                <button type="button" onClick={() => setShowToken(v => !v)} tabIndex={-1} style={{ pointerEvents: 'all', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <p style={{ fontSize: 10, color: C.textMuted, marginTop: 5 }}>Server Settings → Integrations → Webhooks → New Webhook → Copy URL.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btn('outline')}>Cancel</button>
            <button data-testid="button-save-channel" type="submit" disabled={add.isPending} style={btn('green', add.isPending)}>
              <Plus size={12} /> {add.isPending ? 'Saving…' : 'Add Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────
function RulesTab({ rules, channels, loading, onDelete, onToggle, qc }: {
  rules: Rule[]; channels: Channel[]; loading: boolean;
  onDelete: (id: string) => void; onToggle: (id: string, e: boolean) => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {channels.length === 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', background: '#1c2030', border: `1px solid #334155`, borderRadius: 8 }}>
          <AlertCircle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Add a notification channel first, then create rules to define when and what to send.</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button data-testid="button-add-rule" onClick={() => setShowAdd(true)} disabled={channels.length === 0} style={btn('green', channels.length === 0)}>
          <Plus size={12} /> Add Alert Rule
        </button>
      </div>

      {loading && <p style={{ fontSize: 12, color: C.textSub }}>Loading…</p>}

      {!loading && rules.length === 0 && (
        <div style={{ ...card(), padding: '32px', textAlign: 'center' }}>
          <Zap size={28} style={{ color: C.textMuted, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>No alert rules configured yet.</p>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Create a rule to define which events trigger a notification and through which channel.</p>
        </div>
      )}

      {rules.map(rule => (
        <RuleCard
          key={rule.id} rule={rule}
          channel={channels.find(c => c.id === rule.channel_id)}
          onDelete={() => onDelete(rule.id)}
          onToggle={e => onToggle(rule.id, e)}
        />
      ))}

      {showAdd && channels.length > 0 && (
        <AddRuleModal channels={channels} onClose={() => setShowAdd(false)} qc={qc} />
      )}
    </div>
  );
}

// ── Rule Card ─────────────────────────────────────────────────────────────────
function RuleCard({ rule, channel, onDelete, onToggle }: {
  rule: Rule; channel?: Channel;
  onDelete: () => void; onToggle: (e: boolean) => void;
}) {
  const sev = SEVERITY_OPTS.find(s => s.value === rule.min_severity);
  return (
    <div style={card()}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, background: C.surfaceHdr }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{rule.name}</p>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: rule.enabled ? 'rgba(63,185,80,0.12)' : 'rgba(100,100,100,0.12)', color: rule.enabled ? C.greenAcc : C.textMuted, border: `1px solid ${rule.enabled ? 'rgba(63,185,80,0.3)' : C.border}` }}>
              {rule.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {/* Channel badge */}
            {channel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ChannelIcon type={channel.type} />
                <span style={{ fontSize: 11, color: C.textSub }}>{channel.name}</span>
              </div>
            )}
            <span style={{ fontSize: 10, color: C.textMuted }}>·</span>
            {/* Trigger mode */}
            {rule.trigger_mode === 'realtime'
              ? <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: C.textSub }}><Zap size={10} /> Real-time</span>
              : <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: C.textSub }}><Clock size={10} /> Every {rule.schedule_interval}min</span>}
            <span style={{ fontSize: 10, color: C.textMuted }}>·</span>
            {/* Severity */}
            {sev && <span style={{ fontSize: 10, color: sev.color }}>≥ {rule.min_severity}</span>}
            <span style={{ fontSize: 10, color: C.textMuted }}>·</span>
            {/* Event types */}
            <span style={{ fontSize: 10, color: C.textSub }}>{rule.event_types.map(e => EVENT_TYPES.find(t => t.value === e)?.label ?? e).join(', ')}</span>
          </div>
          {rule.last_sent_at && (
            <p style={{ fontSize: 10, color: C.textMuted, marginTop: 5 }}>
              Last sent: {new Date(rule.last_sent_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onToggle(!rule.enabled)} style={btn('ghost')} title={rule.enabled ? 'Disable' : 'Enable'}>
            {rule.enabled ? <BellOff size={13} /> : <Bell size={13} />}
          </button>
          <button data-testid={`button-delete-rule-${rule.id}`} onClick={onDelete} style={btn('ghost')}>
            <Trash2 size={13} style={{ color: C.redLight }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Rule Modal ────────────────────────────────────────────────────────────
function AddRuleModal({ channels, onClose, qc }: { channels: Channel[]; onClose: () => void; qc: ReturnType<typeof useQueryClient> }) {
  const [name, setName]                   = useState('');
  const [channelId, setChannelId]         = useState(channels[0]?.id ?? '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['threat_detected']);
  const [triggerMode, setTriggerMode]     = useState<'realtime' | 'scheduled'>('realtime');
  const [scheduleInterval, setScheduleInterval] = useState(60);
  const [minSeverity, setMinSeverity]     = useState('medium');
  const [focuses, setFocuses]             = useState<Record<string, boolean>>({});
  const setFocus = (k: string, v: boolean) => setFocuses(f => ({ ...f, [k]: v }));

  const toggleEvent = (ev: string) => {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const add = useMutation({
    mutationFn: (body: any) => apiRequest('POST', '/api/notifications/rules', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/notifications/rules'] });
      toast.success('Alert rule created.');
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Rule name is required.'); return; }
    if (!selectedEvents.length) { toast.error('Select at least one event type.'); return; }
    add.mutate({ channel_id: channelId, name: name.trim(), event_types: selectedEvents, trigger_mode: triggerMode, schedule_interval: scheduleInterval, min_severity: minSeverity });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
      <div style={{ ...card(), width: '100%', maxWidth: 540, margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surfaceHdr, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Add Alert Rule</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Rule name */}
          <div>
            <label style={labelStyle()}>Rule Name</label>
            <input data-testid="input-rule-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Critical Threat Alerts" style={inputStyle(focuses.name)} onFocus={() => setFocus('name', true)} onBlur={() => setFocus('name', false)} />
          </div>

          {/* Channel */}
          <div>
            <label style={labelStyle()}>Notification Channel</label>
            <select value={channelId} onChange={e => setChannelId(e.target.value)} style={{ ...inputStyle(false), fontFamily: 'sans-serif' }}>
              {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name} ({ch.type})</option>)}
            </select>
          </div>

          {/* Trigger mode */}
          <div>
            <label style={labelStyle()}>Trigger Mode</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setTriggerMode('realtime')} style={{ flex: 1, padding: '10px 14px', borderRadius: 6, cursor: 'pointer', background: triggerMode === 'realtime' ? 'rgba(63,185,80,0.1)' : C.surfaceHdr, border: `1px solid ${triggerMode === 'realtime' ? C.greenAcc : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Zap size={13} style={{ color: triggerMode === 'realtime' ? C.greenAcc : C.textMuted }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: triggerMode === 'realtime' ? C.text : C.textSub }}>Real-time</span>
              </button>
              <button type="button" onClick={() => setTriggerMode('scheduled')} style={{ flex: 1, padding: '10px 14px', borderRadius: 6, cursor: 'pointer', background: triggerMode === 'scheduled' ? 'rgba(63,185,80,0.1)' : C.surfaceHdr, border: `1px solid ${triggerMode === 'scheduled' ? C.greenAcc : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Clock size={13} style={{ color: triggerMode === 'scheduled' ? C.greenAcc : C.textMuted }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: triggerMode === 'scheduled' ? C.text : C.textSub }}>Scheduled Report</span>
              </button>
            </div>
          </div>

          {/* Schedule interval */}
          {triggerMode === 'scheduled' && (
            <div>
              <label style={labelStyle()}>Report Interval</label>
              <select value={scheduleInterval} onChange={e => setScheduleInterval(Number(e.target.value))} style={{ ...inputStyle(false), fontFamily: 'sans-serif' }}>
                {SCHEDULE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Event types (only for realtime) */}
          {triggerMode === 'realtime' && (
            <div>
              <label style={labelStyle()}>Events to Monitor</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EVENT_TYPES.map(ev => {
                  const active = selectedEvents.includes(ev.value);
                  return (
                    <label key={ev.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, cursor: 'pointer', background: active ? 'rgba(63,185,80,0.06)' : C.surfaceHdr, border: `1px solid ${active ? 'rgba(63,185,80,0.3)' : C.border}`, transition: 'all 0.1s' }}>
                      <input
                        data-testid={`checkbox-event-${ev.value}`}
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleEvent(ev.value)}
                        style={{ accentColor: C.greenAcc, width: 14, height: 14 }}
                      />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{ev.label}</p>
                        <p style={{ fontSize: 10, color: C.textSub, margin: 0 }}>{ev.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Min severity (only for realtime) */}
          {triggerMode === 'realtime' && (
            <div>
              <label style={labelStyle()}>Minimum Severity</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SEVERITY_OPTS.map(s => (
                  <button key={s.value} type="button" onClick={() => setMinSeverity(s.value)} style={{ flex: 1, padding: '8px 4px', borderRadius: 5, cursor: 'pointer', background: minSeverity === s.value ? `${s.color}22` : C.surfaceHdr, border: `1px solid ${minSeverity === s.value ? s.color : C.border}`, fontSize: 10, fontWeight: 600, color: minSeverity === s.value ? s.color : C.textMuted, textTransform: 'capitalize' }}>
                    {s.value}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>{SEVERITY_OPTS.find(s => s.value === minSeverity)?.label}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btn('outline')}>Cancel</button>
            <button data-testid="button-save-rule" type="submit" disabled={add.isPending} style={btn('green', add.isPending)}>
              <Plus size={12} /> {add.isPending ? 'Saving…' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
