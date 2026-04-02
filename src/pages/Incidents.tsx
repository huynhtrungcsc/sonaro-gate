import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Search,
  User,
  Shield,
  Globe,
  Server
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'updated' | 'action' | 'note' | 'resolved';
  title: string;
  description: string;
  user?: string;
}

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  category: string;
  source: string;
  destination: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  relatedThreats: number;
  timeline: TimelineEvent[];
}

const initialIncidents: Incident[] = [
  {
    id: 'INC-001',
    title: 'SSH Brute Force Attack from External IP',
    severity: 'critical',
    status: 'investigating',
    category: 'Intrusion Attempt',
    source: '45.33.32.156',
    destination: 'WAN:22',
    assignee: 'admin',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 1800000),
    relatedThreats: 127,
    timeline: [
      { id: 't1', timestamp: new Date(Date.now() - 3600000), type: 'created', title: 'Incident Created', description: 'Auto-generated from threat detection: 127 blocked SSH attempts from 45.33.32.156', user: 'System' },
      { id: 't2', timestamp: new Date(Date.now() - 3500000), type: 'action', title: 'IP Blocked', description: 'Source IP added to blocklist automatically', user: 'System' },
      { id: 't3', timestamp: new Date(Date.now() - 3000000), type: 'updated', title: 'Status Changed', description: 'Changed from Open to Investigating', user: 'admin' },
      { id: 't4', timestamp: new Date(Date.now() - 1800000), type: 'note', title: 'Investigation Note', description: 'IP traced to known botnet. Checking for any successful connections in logs.', user: 'admin' },
    ],
  },
  {
    id: 'INC-002',
    title: 'C2 Communication Detected - Internal Host',
    severity: 'critical',
    status: 'open',
    category: 'Malware',
    source: '192.168.1.105',
    destination: '185.220.101.45:443',
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 7200000),
    relatedThreats: 5,
    timeline: [
      { id: 't1', timestamp: new Date(Date.now() - 7200000), type: 'created', title: 'Incident Created', description: 'Outbound connection to known C2 server blocked. Host 192.168.1.105 may be compromised.', user: 'System' },
      { id: 't2', timestamp: new Date(Date.now() - 7100000), type: 'action', title: 'Host Quarantined', description: 'Network access restricted for 192.168.1.105', user: 'System' },
    ],
  },
  {
    id: 'INC-003',
    title: 'SQL Injection Attempt on Web Application',
    severity: 'high',
    status: 'resolved',
    category: 'Web Attack',
    source: '89.248.167.131',
    destination: 'DMZ:80',
    assignee: 'security_team',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 43200000),
    resolvedAt: new Date(Date.now() - 43200000),
    relatedThreats: 3,
    timeline: [
      { id: 't1', timestamp: new Date(Date.now() - 86400000), type: 'created', title: 'Incident Created', description: 'Multiple SQL injection attempts detected targeting /api/users endpoint', user: 'System' },
      { id: 't2', timestamp: new Date(Date.now() - 85000000), type: 'updated', title: 'Assigned', description: 'Incident assigned to security_team', user: 'admin' },
      { id: 't3', timestamp: new Date(Date.now() - 80000000), type: 'note', title: 'Analysis Complete', description: 'Attack was blocked by WAF. No data exfiltration detected.', user: 'security_team' },
      { id: 't4', timestamp: new Date(Date.now() - 43200000), type: 'resolved', title: 'Incident Resolved', description: 'Source IP added to permanent blocklist. Application patched.', user: 'security_team' },
    ],
  },
  {
    id: 'INC-004',
    title: 'Unusual Outbound Data Transfer',
    severity: 'medium',
    status: 'investigating',
    category: 'Data Exfiltration',
    source: '192.168.1.55',
    destination: 'Multiple External IPs',
    assignee: 'admin',
    createdAt: new Date(Date.now() - 14400000),
    updatedAt: new Date(Date.now() - 7200000),
    relatedThreats: 0,
    timeline: [
      { id: 't1', timestamp: new Date(Date.now() - 14400000), type: 'created', title: 'Incident Created', description: 'Behavioral analysis detected unusual data transfer pattern from host 192.168.1.55', user: 'System' },
      { id: 't2', timestamp: new Date(Date.now() - 10000000), type: 'updated', title: 'Status Changed', description: 'Changed from Open to Investigating', user: 'admin' },
      { id: 't3', timestamp: new Date(Date.now() - 7200000), type: 'note', title: 'Initial Review', description: 'User uploading large files to cloud storage. Checking if authorized.', user: 'admin' },
    ],
  },
  {
    id: 'INC-005',
    title: 'Port Scan from External Network',
    severity: 'low',
    status: 'resolved',
    category: 'Reconnaissance',
    source: '91.121.160.168',
    destination: 'WAN',
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 86400000),
    resolvedAt: new Date(Date.now() - 86400000),
    relatedThreats: 1,
    timeline: [
      { id: 't1', timestamp: new Date(Date.now() - 172800000), type: 'created', title: 'Incident Created', description: 'Nmap SYN scan detected from external IP', user: 'System' },
      { id: 't2', timestamp: new Date(Date.now() - 86400000), type: 'resolved', title: 'Auto-Resolved', description: 'No follow-up attack detected. Source IP blocked for 24h.', user: 'System' },
    ],
  },
];

const Incidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');

  const statuses = ['all', 'open', 'investigating', 'resolved'];

  const filteredIncidents = incidents.filter(inc => {
    const matchesStatus = selectedStatus === 'all' || inc.status === selectedStatus;
    const matchesSearch = searchQuery === '' || 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const selectedIncident = incidents.find(i => i.id === selectedId);

  const counts = {
    open: incidents.filter(i => i.status === 'open').length,
    investigating: incidents.filter(i => i.status === 'investigating').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins}m ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertTriangle size={14} className="text-status-critical" />;
      case 'investigating': return <Clock size={14} className="text-status-medium" />;
      case 'resolved': return <CheckCircle2 size={14} className="text-status-healthy" />;
      default: return null;
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'created': return <AlertTriangle size={12} />;
      case 'action': return <Shield size={12} />;
      case 'note': return <User size={12} />;
      case 'resolved': return <CheckCircle2 size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const handleStartInvestigation = () => {
    if (!selectedIncident) return;
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        const newEvent: TimelineEvent = {
          id: `t-${Date.now()}`,
          timestamp: new Date(),
          type: 'updated',
          title: 'Investigation Started',
          description: 'Status changed from Open to Investigating',
          user: 'admin',
        };
        return {
          ...inc,
          status: 'investigating' as const,
          updatedAt: new Date(),
          timeline: [...inc.timeline, newEvent],
        };
      }
      return inc;
    }));
    toast.success('Investigation started');
  };

  const handleMarkResolved = () => {
    if (!selectedIncident) return;
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        const newEvent: TimelineEvent = {
          id: `t-${Date.now()}`,
          timestamp: new Date(),
          type: 'resolved',
          title: 'Incident Resolved',
          description: 'Incident marked as resolved',
          user: 'admin',
        };
        return {
          ...inc,
          status: 'resolved' as const,
          updatedAt: new Date(),
          resolvedAt: new Date(),
          timeline: [...inc.timeline, newEvent],
        };
      }
      return inc;
    }));
    toast.success('Incident marked as resolved');
  };

  const handleAddNote = () => {
    if (!selectedIncident || !newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    setIncidents(prev => prev.map(inc => {
      if (inc.id === selectedIncident.id) {
        const newEvent: TimelineEvent = {
          id: `t-${Date.now()}`,
          timestamp: new Date(),
          type: 'note',
          title: 'Note Added',
          description: newNote,
          user: 'admin',
        };
        return {
          ...inc,
          updatedAt: new Date(),
          timeline: [...inc.timeline, newEvent],
        };
      }
      return inc;
    }));
    setNoteModalOpen(false);
    setNewNote('');
    toast.success('Note added to incident');
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Summary Strip */}
        <div className="summary-strip">
          <div className="summary-item">
            <AlertTriangle size={16} className="text-status-critical" />
            <span className="summary-count text-status-critical">{counts.open}</span>
            <span className="summary-label">Open</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="summary-item">
            <Clock size={16} className="text-status-medium" />
            <span className="summary-count text-status-medium">{counts.investigating}</span>
            <span className="summary-label">Investigating</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="summary-item">
            <CheckCircle2 size={16} className="text-status-healthy" />
            <span className="summary-count text-status-healthy">{counts.resolved}</span>
            <span className="summary-label">Resolved</span>
          </div>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">{incidents.length} total incidents</span>
        </div>

        {/* Filters */}
        <div className="action-strip">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm bg-background border border-border rounded-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="h-6 w-px bg-border" />
          <span className="text-xs text-muted-foreground">Status:</span>
          <div className="flex items-center gap-1">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-sm transition-all duration-100 capitalize",
                  selectedStatus === status
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {status === 'all' ? 'All Status' : status}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{filteredIncidents.length} shown</span>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-4">
          {/* Incident List */}
          <div className="col-span-5">
            <div className="section">
              <div className="section-header">
                <span>Incidents</span>
              </div>
              <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    onClick={() => setSelectedId(incident.id)}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-all duration-100",
                      selectedId === incident.id
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "tag",
                          incident.severity === 'critical' ? 'tag-critical' :
                          incident.severity === 'high' ? 'tag-high' :
                          incident.severity === 'medium' ? 'tag-medium' : 'tag-low'
                        )}>
                          {incident.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">{incident.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(incident.status)}
                        <span className="text-xs capitalize">{incident.status}</span>
                      </div>
                    </div>
                    <div className="font-medium text-sm mb-1 line-clamp-1">{incident.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{incident.category}</span>
                      <span>•</span>
                      <span>{formatTime(incident.createdAt)}</span>
                      {incident.relatedThreats > 0 && (
                        <>
                          <span>•</span>
                          <span>{incident.relatedThreats} threats</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Incident Detail */}
          <div className="col-span-7">
            {selectedIncident ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="section">
                  <div className="section-body">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "tag",
                          selectedIncident.severity === 'critical' ? 'tag-critical' :
                          selectedIncident.severity === 'high' ? 'tag-high' :
                          selectedIncident.severity === 'medium' ? 'tag-medium' : 'tag-low'
                        )}>
                          {selectedIncident.severity.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">{selectedIncident.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedIncident.status !== 'resolved' && (
                          <>
                            {selectedIncident.status === 'open' && (
                              <button onClick={handleStartInvestigation} className="btn btn-primary text-xs">Start Investigation</button>
                            )}
                            {selectedIncident.status === 'investigating' && (
                              <button onClick={handleMarkResolved} className="btn btn-primary text-xs">Mark Resolved</button>
                            )}
                          </>
                        )}
                        <button onClick={() => setNoteModalOpen(true)} className="btn btn-outline text-xs">Add Note</button>
                      </div>
                    </div>
                    <h2 className="text-base font-semibold mb-3">{selectedIncident.title}</h2>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="info-item">
                        <div className="info-label">Status</div>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(selectedIncident.status)}
                          <span className="capitalize font-medium">{selectedIncident.status}</span>
                        </div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Category</div>
                        <div className="info-value">{selectedIncident.category}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Assignee</div>
                        <div className="info-value">{selectedIncident.assignee || 'Unassigned'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="section">
                  <div className="section-header">Details</div>
                  <div className="section-body">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-background rounded-sm border border-border/50">
                        <Globe size={16} className="text-muted-foreground" />
                        <div>
                          <div className="info-label">Source</div>
                          <div className="mono text-sm">{selectedIncident.source}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background rounded-sm border border-border/50">
                        <Server size={16} className="text-muted-foreground" />
                        <div>
                          <div className="info-label">Destination</div>
                          <div className="mono text-sm">{selectedIncident.destination}</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="info-item">
                        <div className="info-label">Created</div>
                        <div className="text-sm">{selectedIncident.createdAt.toLocaleString()}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Last Updated</div>
                        <div className="text-sm">{selectedIncident.updatedAt.toLocaleString()}</div>
                      </div>
                      {selectedIncident.resolvedAt && (
                        <div className="info-item">
                          <div className="info-label">Resolved</div>
                          <div className="text-sm">{selectedIncident.resolvedAt.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="section">
                  <div className="section-header">Timeline</div>
                  <div className="section-body">
                    <div className="space-y-4">
                      {selectedIncident.timeline.slice().reverse().map((event, idx) => (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center",
                              event.type === 'created' ? 'bg-status-critical/20 text-status-critical' :
                              event.type === 'resolved' ? 'bg-status-healthy/20 text-status-healthy' :
                              event.type === 'action' ? 'bg-primary/20 text-primary' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {getTimelineIcon(event.type)}
                            </div>
                            {idx < selectedIncident.timeline.length - 1 && (
                              <div className="w-px h-full bg-border mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">{event.title}</div>
                              <div className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</div>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{event.description}</div>
                            {event.user && (
                              <div className="text-xs text-muted-foreground mt-1">by {event.user}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="section">
                <div className="section-body py-16 text-center">
                  <AlertTriangle size={32} className="mx-auto text-muted-foreground/50 mb-3" />
                  <div className="text-muted-foreground">Select an incident to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Note Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea 
                placeholder="Enter your investigation notes..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddNote}>Add Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default Incidents;
