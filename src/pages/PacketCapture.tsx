import { Shell } from '@/components/layout/Shell';
import { Play, Square, Download, Trash2, RefreshCw, Filter, HardDrive, Plus, Edit2, Search, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePacketCaptures } from '@/hooks/usePacketCaptures';
import { formatFileSize as formatSize, formatDuration } from '@/lib/formatters';

const PacketCapture = () => {
  const { sessions, loading, fetchSessions, createCapture, updateCapture, deleteCapture, toggleStatus } = usePacketCaptures();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', interface: 'wan1', filter: '' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-700 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const handleCreate = () => {
    setEditingSession(null);
    setFormData({ name: '', interface: 'wan1', filter: '' });
    setModalOpen(true);
  };

  const handleEdit = (session: any) => {
    setEditingSession(session);
    setFormData({ name: session.name, interface: session.interface, filter: session.filter });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) { toast.error('Please enter a capture name'); return; }
    if (editingSession) {
      updateCapture(editingSession.id, { name: formData.name, interface: formData.interface, filter: formData.filter });
    } else {
      createCapture(formData.name, formData.interface, formData.filter);
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteSessionId) { deleteCapture(deleteSessionId); setDeleteSessionId(null); }
  };

  const filteredSessions = sessions.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.interface.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.filter.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={handleCreate}>
            <Plus className="w-3 h-3" /> New Capture
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (selectedSessions.length === 1) {
              const session = sessions.find(s => s.id === selectedSessions[0]);
              if (session) handleEdit(session);
            }
          }}>
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (selectedSessions.length === 1) setDeleteSessionId(selectedSessions[0]);
          }}>
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => { fetchSessions(); toast.success('Refreshed'); }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input type="text" placeholder="Search captures..." className="w-40" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Quick Capture Form */}
        <div className="border-b border-[#ccc] bg-[#f9f9f9] p-4">
          <div className="text-[11px] font-semibold text-[#333] mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[hsl(142,70%,35%)]" /> Quick Start Capture
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="forti-label">Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Capture name..." className="forti-input w-full" />
            </div>
            <div>
              <label className="forti-label">Interface</label>
              <select value={formData.interface} onChange={(e) => setFormData({ ...formData, interface: e.target.value })} className="forti-select w-full">
                <option value="any">Any</option>
                <option value="wan1">wan1</option>
                <option value="wan2">wan2</option>
                <option value="internal">internal</option>
                <option value="dmz">dmz</option>
              </select>
            </div>
            <div>
              <label className="forti-label">Filter (BPF)</label>
              <input type="text" value={formData.filter} onChange={(e) => setFormData({ ...formData, filter: e.target.value })} placeholder="e.g., host 10.0.0.1 and port 80" className="forti-input w-full font-mono" />
            </div>
            <div className="flex items-end">
              <button className="forti-toolbar-btn primary w-full justify-center" onClick={handleSave}>
                <Play className="w-3 h-3" /> Start Capture
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-[#666]">
            <span className="flex items-center gap-1"><Filter className="w-3 h-3" /> Common filters:</span>
            <button className="text-blue-600 hover:underline" onClick={() => setFormData({ ...formData, filter: 'host 8.8.8.8' })}>host 8.8.8.8</button>
            <button className="text-blue-600 hover:underline" onClick={() => setFormData({ ...formData, filter: 'port 53' })}>port 53 (DNS)</button>
            <button className="text-blue-600 hover:underline" onClick={() => setFormData({ ...formData, filter: 'tcp port 443' })}>tcp port 443</button>
            <button className="text-blue-600 hover:underline" onClick={() => setFormData({ ...formData, filter: 'icmp' })}>icmp</button>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-[11px] text-[#666]">Loading captures...</div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input type="checkbox" className="forti-checkbox" checked={selectedSessions.length === filteredSessions.length && filteredSessions.length > 0} onChange={(e) => setSelectedSessions(e.target.checked ? filteredSessions.map(s => s.id) : [])} />
                    </th>
                    <th>Name</th>
                    <th>Interface</th>
                    <th>Filter</th>
                    <th>Status</th>
                    <th>Packets</th>
                    <th>Size</th>
                    <th>Duration</th>
                    <th className="w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-[#f5f5f5]">
                      <td>
                        <input type="checkbox" className="forti-checkbox" checked={selectedSessions.includes(session.id)} onChange={(e) => {
                          if (e.target.checked) setSelectedSessions([...selectedSessions, session.id]);
                          else setSelectedSessions(selectedSessions.filter(id => id !== session.id));
                        }} />
                      </td>
                      <td className="text-[11px] font-medium">{session.name}</td>
                      <td><span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">{session.interface}</span></td>
                      <td className="mono text-[10px] text-[#666] max-w-[150px] truncate">{session.filter || '-'}</td>
                      <td><span className={cn("forti-tag", getStatusBadge(session.status))}>{session.status.toUpperCase()}</span></td>
                      <td className="text-[11px]">{session.packets.toLocaleString()}</td>
                      <td className="text-[11px]">{formatSize(session.size_bytes)}</td>
                      <td className="mono text-[10px]">{formatDuration(session.started_at, session.stopped_at)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className={cn("p-1 rounded", session.status === 'running' ? "text-red-600 hover:bg-red-100" : "text-green-600 hover:bg-green-100")} title={session.status === 'running' ? 'Stop' : 'Start'} onClick={() => toggleStatus(session)}>
                            {session.status === 'running' ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          </button>
                          <button className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Download PCAP" onClick={() => toast.success(`Downloading ${session.name}.pcap`)}>
                            <Download className="w-3 h-3" />
                          </button>
                          <button className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="Edit" onClick={() => handleEdit(session)}>
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button className="p-1 text-red-600 hover:bg-red-100 rounded" title="Delete" onClick={() => setDeleteSessionId(session.id)}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSessions.length === 0 && (
                <div className="text-center py-8 text-[11px] text-[#666]">No capture sessions found</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Capture Session' : 'New Capture Session'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="forti-label">Capture Name *</label>
              <input type="text" className="forti-input w-full" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., WAN Traffic Debug" />
            </div>
            <div>
              <label className="forti-label">Interface</label>
              <select className="forti-select w-full" value={formData.interface} onChange={(e) => setFormData({ ...formData, interface: e.target.value })}>
                <option value="any">Any</option>
                <option value="wan1">wan1</option>
                <option value="wan2">wan2</option>
                <option value="internal">internal</option>
                <option value="dmz">dmz</option>
                <option value="ssl.root">ssl.root</option>
              </select>
            </div>
            <div>
              <label className="forti-label">BPF Filter</label>
              <input type="text" className="forti-input w-full font-mono" value={formData.filter} onChange={(e) => setFormData({ ...formData, filter: e.target.value })} placeholder="e.g., host 10.0.0.1 and port 80" />
              <div className="text-[10px] text-[#666] mt-1">Examples: host 192.168.1.1, port 443, tcp and port 80, icmp</div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>{editingSession ? 'Save Changes' : 'Start Capture'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Capture Session</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? The captured data will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default PacketCapture;
