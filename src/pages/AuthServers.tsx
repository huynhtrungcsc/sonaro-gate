import { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { StatsBar } from '@/components/ui/stats-bar';
import { cn } from '@/lib/utils';
import { Plus, Edit, Trash2, RefreshCw, Search, Server, Wifi, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { systemSettingsApi } from '@/lib/api';
import { useSystemSettings } from '@/hooks/useDbData';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ServerType = 'radius' | 'ldap' | 'active-directory' | 'tacacs+';
type ServerStatus = 'active' | 'inactive' | 'error';

interface AuthServer {
  id: string;
  name: string;
  type: ServerType;
  host: string;
  port: number;
  status: ServerStatus;
  timeout: number;
  retries: number;
  baseDn?: string;
  bindDn?: string;
  cnIdentifier?: string;
  authScheme?: string;
  comment: string;
  createdAt: string;
  lastTested?: string;
}

const typeColors: Record<string, string> = {
  radius:           'bg-blue-100 text-blue-700 border-blue-200',
  ldap:             'bg-purple-100 text-purple-700 border-purple-200',
  'active-directory': 'bg-orange-100 text-orange-700 border-orange-200',
  'tacacs+':        'bg-teal-100 text-teal-700 border-teal-200',
};

const defaultPorts: Record<ServerType, number> = {
  radius: 1812, ldap: 389, 'active-directory': 636, 'tacacs+': 49,
};

const emptyForm = {
  name: '', type: 'radius' as ServerType,
  host: '', port: 1812, timeout: 5, retries: 3,
  baseDn: '', bindDn: '', cnIdentifier: '', authScheme: 'PAP',
  comment: '',
};

const AuthServers = () => {
  const queryClient = useQueryClient();
  const { data: dbSettings = [] } = useSystemSettings();
  const [servers, setServers] = useState<AuthServer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (loaded || !(dbSettings as any[]).length) return;
    const saved = (dbSettings as any[]).find((s: any) => s.key === 'auth_servers')?.value;
    if (saved) {
      try { setServers(JSON.parse(saved)); } catch {}
    }
    setLoaded(true);
  }, [dbSettings, loaded]);

  const saveServers = async (next: AuthServer[]) => {
    setServers(next);
    try {
      await systemSettingsApi.upsert('auth_servers', JSON.stringify(next));
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    } catch { toast.error('Failed to persist auth servers'); }
  };

  const selectedServer = servers.find(s => s.id === selectedId);

  const filteredServers = servers.filter(s =>
    !searchQuery ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: servers.length,
    active: servers.filter(s => s.status === 'active').length,
    radius: servers.filter(s => s.type === 'radius').length,
    ldap: servers.filter(s => s.type === 'ldap' || s.type === 'active-directory').length,
  };

  const handleAdd = async () => {
    if (!form.name || !form.host) { toast.error('Name and Host are required'); return; }
    if (servers.some(s => s.name === form.name)) { toast.error('Server name already exists'); return; }
    const srv: AuthServer = {
      id: `auth-${Date.now()}`,
      name: form.name, type: form.type, host: form.host, port: form.port,
      status: 'inactive', timeout: form.timeout, retries: form.retries,
      baseDn: form.baseDn, bindDn: form.bindDn,
      cnIdentifier: form.cnIdentifier, authScheme: form.authScheme,
      comment: form.comment, createdAt: new Date().toISOString().split('T')[0],
    };
    await saveServers([...servers, srv]);
    setModalOpen(false);
    setForm(emptyForm);
    toast.success('Authentication server saved');
  };

  const handleEdit = async () => {
    if (!selectedServer) return;
    const next = servers.map(s => s.id === selectedServer.id ? {
      ...s, name: form.name || s.name, type: form.type, host: form.host || s.host,
      port: form.port, timeout: form.timeout, retries: form.retries,
      baseDn: form.baseDn, bindDn: form.bindDn,
      cnIdentifier: form.cnIdentifier, authScheme: form.authScheme, comment: form.comment,
    } : s);
    await saveServers(next);
    setEditModalOpen(false);
    toast.success('Server updated and saved');
  };

  const handleDelete = async (id: string) => {
    const s = servers.find(s => s.id === id);
    await saveServers(servers.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirm(null);
    toast.success(`Server "${s?.name}" deleted`);
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    const srv = servers.find(s => s.id === id);
    if (!srv) return;
    try {
      const res = await fetch('/api/cli/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sonaro_token') ?? ''}` },
        body: JSON.stringify({ command: `ping -c 1 -W ${srv.timeout} ${srv.host}` }),
      });
      const data = await res.json();
      const success = data.exit_code === 0;
      const next = servers.map(s => s.id === id ? {
        ...s,
        status: success ? 'active' as const : 'error' as const,
        lastTested: new Date().toISOString(),
      } : s);
      await saveServers(next);
      if (success) toast.success(`${srv.name} (${srv.host}) is reachable`);
      else toast.error(`${srv.name} (${srv.host}) is unreachable — ${data.stderr?.slice(0, 80) || 'No response'}`);
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  const openEditModal = () => {
    if (!selectedServer) { toast.info('Select a server first'); return; }
    setForm({
      name: selectedServer.name, type: selectedServer.type,
      host: selectedServer.host, port: selectedServer.port,
      timeout: selectedServer.timeout, retries: selectedServer.retries,
      baseDn: selectedServer.baseDn || '', bindDn: selectedServer.bindDn || '',
      cnIdentifier: selectedServer.cnIdentifier || '', authScheme: selectedServer.authScheme || 'PAP',
      comment: selectedServer.comment,
    });
    setEditModalOpen(true);
  };

  const StatusIcon = ({ status }: { status: ServerStatus }) => {
    if (status === 'active') return <CheckCircle size={12} className="text-green-600" />;
    if (status === 'error') return <AlertCircle size={12} className="text-red-500" />;
    return <XCircle size={12} className="text-gray-400" />;
  };

  const ServerFormFields = () => {
    const isLdapType = form.type === 'ldap' || form.type === 'active-directory';
    return (
      <div className="space-y-3 text-[11px]">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px]">Server Name *</Label>
            <Input className="h-7 text-[11px]" placeholder="Corporate_RADIUS" value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Type</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm(p => ({ ...p, type: v, port: defaultPorts[v as ServerType] }))}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="radius">RADIUS</SelectItem>
                <SelectItem value="ldap">LDAP</SelectItem>
                <SelectItem value="active-directory">Active Directory (LDAPS)</SelectItem>
                <SelectItem value="tacacs+">TACACS+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-[11px]">Host / IP Address *</Label>
            <Input className="h-7 text-[11px]" placeholder="192.168.1.10 or dc01.company.local" value={form.host}
              onChange={(e) => setForm(p => ({ ...p, host: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Port</Label>
            <Input type="number" className="h-7 text-[11px]" value={form.port}
              onChange={(e) => setForm(p => ({ ...p, port: parseInt(e.target.value) || p.port }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px]">Timeout (sec)</Label>
            <Input type="number" className="h-7 text-[11px]" min={1} max={60} value={form.timeout}
              onChange={(e) => setForm(p => ({ ...p, timeout: parseInt(e.target.value) || 5 }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Retries</Label>
            <Input type="number" className="h-7 text-[11px]" min={1} max={10} value={form.retries}
              onChange={(e) => setForm(p => ({ ...p, retries: parseInt(e.target.value) || 3 }))} />
          </div>
        </div>
        {form.type === 'radius' && (
          <div className="space-y-1">
            <Label className="text-[11px]">Authentication Scheme</Label>
            <Select value={form.authScheme} onValueChange={(v) => setForm(p => ({ ...p, authScheme: v }))}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAP">PAP</SelectItem>
                <SelectItem value="CHAP">CHAP</SelectItem>
                <SelectItem value="MS-CHAP">MS-CHAPv1</SelectItem>
                <SelectItem value="MS-CHAPv2">MS-CHAPv2</SelectItem>
                <SelectItem value="EAP">EAP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isLdapType && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">Base DN</Label>
              <Input className="h-7 text-[11px] font-mono" placeholder="DC=company,DC=local" value={form.baseDn}
                onChange={(e) => setForm(p => ({ ...p, baseDn: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Bind DN (Service Account)</Label>
              <Input className="h-7 text-[11px] font-mono" placeholder="CN=svc_ldap,OU=Service Accounts,DC=company,DC=local" value={form.bindDn}
                onChange={(e) => setForm(p => ({ ...p, bindDn: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">CN Identifier</Label>
              <Input className="h-7 text-[11px] font-mono" placeholder={form.type === 'active-directory' ? 'sAMAccountName' : 'uid'} value={form.cnIdentifier}
                onChange={(e) => setForm(p => ({ ...p, cnIdentifier: e.target.value }))} />
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label className="text-[11px]">Comment</Label>
          <Input className="h-7 text-[11px]" placeholder="Server description" value={form.comment}
            onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))} />
        </div>
      </div>
    );
  };

  return (
    <Shell>
      <div className="space-y-0">
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Server size={14} />
            <span className="font-semibold">Authentication Servers</span>
            <span className="text-[10px] text-[#888]">RADIUS · LDAP · Active Directory · TACACS+</span>
          </div>
        </div>

        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
            <Plus size={12} /><span>Create New</span>
          </button>
          <button className="forti-toolbar-btn" onClick={openEditModal}>
            <Edit size={12} /><span>Edit</span>
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (!selectedId) { toast.info('Select a server to delete'); return; }
            setDeleteConfirm(selectedId);
          }}>
            <Trash2 size={12} /><span>Delete</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => {
            if (!selectedId) { toast.info('Select a server to test'); return; }
            handleTest(selectedId);
          }} disabled={!!testing}>
            <Wifi size={12} />
            <span>{testing ? 'Testing…' : 'Test Connectivity'}</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => { setLoaded(false); queryClient.invalidateQueries({ queryKey: ['system-settings'] }); }}>
            <RefreshCw size={12} /><span>Refresh</span>
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input type="text" placeholder="Search servers…" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <StatsBar items={[
          { icon: Server,       value: stats.total,  label: 'Total Servers' },
          { icon: CheckCircle,  value: stats.active, label: 'Active',        color: 'text-green-600' },
          { value: stats.radius, label: 'RADIUS',                            color: 'text-blue-600' },
          { value: stats.ldap,   label: 'LDAP / AD',                         color: 'text-purple-600' },
        ]} />

        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Name</th>
              <th>Type</th>
              <th>Host</th>
              <th className="w-16 text-center">Port</th>
              <th>Status</th>
              <th>Timeout</th>
              <th>Retries</th>
              <th>Last Tested</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {filteredServers.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-[#999] py-4">No authentication servers configured</td></tr>
            ) : filteredServers.map((srv) => (
              <tr key={srv.id} onClick={() => setSelectedId(srv.id)}
                className={cn('cursor-pointer', selectedId === srv.id && 'bg-[#fff8e1]')}>
                <td className="text-center">
                  <input type="radio" name="srv-select" checked={selectedId === srv.id}
                    onChange={() => setSelectedId(srv.id)} className="accent-[hsl(142,70%,35%)]" />
                </td>
                <td className="font-medium text-[#333]">{srv.name}</td>
                <td>
                  <span className={cn('forti-tag', typeColors[srv.type])}>
                    {srv.type.toUpperCase()}
                  </span>
                </td>
                <td className="font-mono text-[10px] text-[#555]">{srv.host}</td>
                <td className="text-center text-[#666]">{srv.port}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <StatusIcon status={srv.status} />
                    <span className={cn('text-[11px]',
                      srv.status === 'active' ? 'text-green-600' :
                      srv.status === 'error' ? 'text-red-500' : 'text-[#999]'
                    )}>
                      {srv.status === 'active' ? 'Active' : srv.status === 'error' ? 'Error' : 'Inactive'}
                    </span>
                  </div>
                </td>
                <td className="text-[#666]">{srv.timeout}s</td>
                <td className="text-[#666]">{srv.retries}x</td>
                <td className="text-[#888] text-[10px]">
                  {srv.lastTested ? new Date(srv.lastTested).toLocaleString() : '—'}
                </td>
                <td className="text-[#888] max-w-[140px] truncate text-[10px]">{srv.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Detail Panel */}
        {selectedServer && (
          <div className="border-x border-b border-[#ddd] bg-white">
            <div className="px-3 py-1.5 bg-[#e8e8e8] border-b border-[#ccc] text-[11px] font-semibold text-[#333] flex items-center gap-2">
              <Server size={12} />
              <span>Server Details — {selectedServer.name}</span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
              <div>
                <span className="text-[#888] block">Type</span>
                <span className={cn('forti-tag', typeColors[selectedServer.type])}>{selectedServer.type.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-[#888] block">Host</span>
                <span className="font-mono text-[#333]">{selectedServer.host}:{selectedServer.port}</span>
              </div>
              <div>
                <span className="text-[#888] block">Status</span>
                <div className="flex items-center gap-1">
                  <StatusIcon status={selectedServer.status} />
                  <span className={selectedServer.status === 'active' ? 'text-green-600 font-medium' : selectedServer.status === 'error' ? 'text-red-500' : 'text-[#999]'}>
                    {selectedServer.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[#888] block">Timeout / Retries</span>
                <span className="text-[#333]">{selectedServer.timeout}s / {selectedServer.retries}x</span>
              </div>
              {selectedServer.authScheme && (
                <div>
                  <span className="text-[#888] block">Auth Scheme</span>
                  <span className="text-[#333] font-mono">{selectedServer.authScheme}</span>
                </div>
              )}
              {selectedServer.baseDn && (
                <div className="col-span-2">
                  <span className="text-[#888] block">Base DN</span>
                  <span className="text-[#333] font-mono text-[10px]">{selectedServer.baseDn}</span>
                </div>
              )}
              {selectedServer.bindDn && (
                <div className="col-span-2">
                  <span className="text-[#888] block">Bind DN</span>
                  <span className="text-[#333] font-mono text-[10px]">{selectedServer.bindDn}</span>
                </div>
              )}
              {selectedServer.cnIdentifier && (
                <div>
                  <span className="text-[#888] block">CN Identifier</span>
                  <span className="font-mono text-[#333]">{selectedServer.cnIdentifier}</span>
                </div>
              )}
              <div>
                <span className="text-[#888] block">Last Tested</span>
                <span className="text-[#666]">
                  {selectedServer.lastTested ? new Date(selectedServer.lastTested).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="col-span-4">
                <span className="text-[#888] block">Comment</span>
                <span className="text-[#555]">{selectedServer.comment || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Add Authentication Server</DialogTitle></DialogHeader>
          <ServerFormFields />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
            <button className="forti-toolbar-btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="forti-toolbar-btn primary" onClick={handleAdd}>Create Server</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Edit Server — {selectedServer?.name}</DialogTitle></DialogHeader>
          <ServerFormFields />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
            <button className="forti-toolbar-btn" onClick={() => setEditModalOpen(false)}>Cancel</button>
            <button className="forti-toolbar-btn primary" onClick={handleEdit}>Save Changes</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Delete server "{servers.find(s => s.id === deleteConfirm)?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[11px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-7 text-[11px] bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default AuthServers;
