import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';

const threatDetail = {
  id: 'threat-1',
  severity: 'critical',
  status: 'blocked',
  signature: 'ET SCAN SSH Brute Force Attempt',
  category: 'Intrusion Attempt',
  description: 'Multiple SSH login attempts detected from malicious IP address.',
  timestamp: new Date(Date.now() - 120000),
  source: {
    ip: '45.33.32.156',
    port: 54321,
    country: 'CN',
    asn: 'AS4134 CHINANET',
    reputation: 'Malicious',
    feeds: ['AbuseIPDB', 'Spamhaus', 'ET'],
  },
  destination: {
    ip: '203.113.152.45',
    port: 22,
    interface: 'WAN',
    service: 'SSH',
  },
  session: {
    id: 'sess-a1b2c3d4',
    protocol: 'TCP',
    bytesIn: 4521,
    bytesOut: 892,
    packetsIn: 45,
    packetsOut: 12,
    duration: 8.5,
    state: 'CLOSED',
  },
  confidence: 'High',
  reason: 'Pattern matches SSH brute force with 23 auth attempts in 8 seconds',
  indicators: [
    'Multiple failed auth (23 in 8s)',
    'IP in 3 threat intel feeds',
    'Similar attacks from same ASN',
  ],
  timeline: [
    { time: '14:32:15.123', event: 'TCP SYN', detail: '45.33.32.156:54321 → WAN:22' },
    { time: '14:32:15.125', event: 'TCP SYN-ACK', detail: 'Response sent' },
    { time: '14:32:15.250', event: 'Auth attempt', detail: 'User: root' },
    { time: '14:32:15.380', event: 'Auth attempt', detail: 'User: admin' },
    { time: '14:32:16.100', event: 'IDS Alert', detail: 'Signature matched' },
    { time: '14:32:16.102', event: 'Blocked', detail: 'Rule: IDS-AUTO-001' },
  ],
  rawLog: `Jan 17 14:32:16 sonaro suricata[1234]: [1:2001219:20] ET SCAN SSH Brute Force
{TCP} 45.33.32.156:54321 -> 203.113.152.45:22`,
};

const ThreatDetail = () => {
  const { id } = useParams();
  const [tab, setTab] = useState<'overview' | 'session' | 'evidence' | 'timeline' | 'raw'>('overview');
  const t = null;

  const tabs = ['overview', 'session', 'evidence', 'timeline', 'raw'];

  if (!t) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No threat data available. Switch to MOCK mode to see demo data.
        </div>
      </Shell>
    );
  }


  return (
    <Shell>
      <div className="space-y-3">
        {/* Breadcrumb */}
        <div className="text-[11px] text-muted-foreground">
          <Link to="/threats" className="hover:text-foreground">Threats</Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">{t.signature}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("tag", t.severity === 'critical' ? 'tag-critical' : 'tag-high')}>
              {t.severity.toUpperCase()}
            </span>
            <span className="text-status-healthy text-[10px]">{t.status.toUpperCase()}</span>
            <span className="text-xs font-medium">{t.signature}</span>
          </div>
          <button className="btn btn-outline flex items-center gap-1">
            <Download size={12} />
            Export
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-px border-b border-border">
          {tabs.map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb as any)}
              className={cn(
                "px-3 py-1.5 text-[11px] capitalize border-b-2 -mb-px transition-colors",
                tab === tb ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tb}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'overview' && (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8 space-y-3">
              {/* Description */}
              <div className="section">
                <div className="section-body text-xs">{t.description}</div>
              </div>

              {/* Source / Dest */}
              <div className="grid grid-cols-2 gap-3">
                <div className="section">
                  <div className="section-header">
                    <span>Source</span>
                    <span className="tag tag-critical">{t.source.reputation}</span>
                  </div>
                  <div className="section-body space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP</span>
                      <span className="font-mono">{t.source.ip}:{t.source.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Country</span>
                      <span>{t.source.country}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ASN</span>
                      <span className="text-[11px]">{t.source.asn}</span>
                    </div>
                    <div className="divider my-2" />
                    <div className="text-[10px] text-muted-foreground">Intel: {t.source.feeds.join(', ')}</div>
                  </div>
                </div>

                <div className="section">
                  <div className="section-header">Destination</div>
                  <div className="section-body space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP</span>
                      <span className="font-mono">{t.destination.ip}:{t.destination.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interface</span>
                      <span>{t.destination.interface}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span>{t.destination.service}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis */}
            <div className="col-span-4">
              <div className="section">
                <div className="section-header">Analysis</div>
                <div className="section-body space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span>{t.confidence}</span>
                  </div>
                  <div className="divider" />
                  <div className="text-muted-foreground text-[11px]">{t.reason}</div>
                  <div className="divider" />
                  <div className="text-[10px] text-muted-foreground uppercase">Indicators</div>
                  <ul className="space-y-1">
                    {t.indicators.map((ind, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1">
                        <span className="text-muted-foreground">•</span>
                        <span>{ind}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'session' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="section">
              <div className="section-header">Session</div>
              <div className="section-body space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono">{t.session.id}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Protocol</span><span>{t.session.protocol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">State</span><span>{t.session.state}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{t.session.duration}s</span></div>
              </div>
            </div>
            <div className="section">
              <div className="section-header">Traffic</div>
              <div className="section-body text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">Inbound</div>
                    <div>Bytes: {t.session.bytesIn}</div>
                    <div>Packets: {t.session.packetsIn}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">Outbound</div>
                    <div>Bytes: {t.session.bytesOut}</div>
                    <div>Packets: {t.session.packetsOut}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'evidence' && (
          <div className="section">
            <div className="section-header">Attack Evidence</div>
            <div className="section-body">
              <div className="bg-status-critical/5 border-l-2 border-status-critical px-3 py-2 mb-3">
                <div className="text-xs font-medium text-status-critical">Brute Force Pattern</div>
                <div className="text-[11px] text-muted-foreground">23 auth attempts in 8 seconds</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Username</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {['root', 'admin', 'ubuntu', 'user', 'test'].map((u, i) => (
                    <tr key={i}>
                      <td className="font-mono">14:32:15.{250 + i * 130}</td>
                      <td className="font-mono">{u}</td>
                      <td><span className="tag tag-critical">FAIL</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="section">
            <div className="section-header">Timeline</div>
            <div className="section-body">
              {t.timeline.map((ev, i) => (
                <div key={i} className="flex gap-3 py-1.5 border-b border-border last:border-0">
                  <span className="font-mono text-[10px] text-muted-foreground w-24 shrink-0">{ev.time}</span>
                  <span className="text-xs font-medium w-24 shrink-0">{ev.event}</span>
                  <span className="text-[11px] text-muted-foreground">{ev.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'raw' && (
          <div className="section">
            <div className="section-header">
              <span>Raw Log</span>
              <button className="btn btn-ghost text-[10px]">Download PCAP</button>
            </div>
            <div className="section-body">
              <pre className="font-mono text-[10px] bg-background p-2 overflow-x-auto whitespace-pre-wrap">
                {t.rawLog}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default ThreatDetail;
