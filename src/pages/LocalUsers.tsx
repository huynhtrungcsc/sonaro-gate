import { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { StatsBar } from '@/components/ui/stats-bar';
import { cn } from '@/lib/utils';
import { Plus, Edit, Trash2, RefreshCw, Search, User, Shield, Key, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { systemSettingsApi } from '@/lib/api';
import { useSystemSettings } from '@/hooks/useDbData';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LocalUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'operator' | 'readonly' | 'vpn-user';
  status: 'active' | 'disabled';
  groups: string[];
  mfaEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  comment: string;
}

const roleColors: Record<string, string> = {
  admin:    'bg-red-100 text-red-700 border-red-200',
  operator: 'bg-blue-100 text-blue-700 border-blue-200',
  readonly: 'bg-gray-100 text-gray-700 border-gray-200',
  'vpn-user': 'bg-purple-100 text-purple-700 border-purple-200',
};

const emptyForm = {
  username: '', email: '', fullName: '', role: 'readonly' as LocalUser['role'],
  status: 'active' as LocalUser['status'], groups: '', mfaEnabled: false, comment: '',
};

const LocalUsers = () => {
  const queryClient = useQueryClient();
  const { data: dbSettings = [] } = useSystemSettings();
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (loaded || !(dbSettings as any[]).length) return;
    const saved = (dbSettings as any[]).find((s: any) => s.key === 'local_users')?.value;
    if (saved) {
      try { setUsers(JSON.parse(saved)); } catch {}
    }
    setLoaded(true);
  }, [dbSettings, loaded]);

  const saveUsers = async (next: LocalUser[]) => {
    setUsers(next);
    try {
      await systemSettingsApi.upsert('local_users', JSON.stringify(next));
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    } catch { toast.error('Failed to persist users'); }
  };

  const selectedUser = users.find(u => u.id === selectedId);

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admin: users.filter(u => u.role === 'admin').length,
    mfa: users.filter(u => u.mfaEnabled).length,
  };

  const handleAdd = async () => {
    if (!form.username) { toast.error('Username is required'); return; }
    if (users.some(u => u.username === form.username)) { toast.error('Username already exists'); return; }
    const user: LocalUser = {
      id: `usr-${Date.now()}`,
      username: form.username, email: form.email, fullName: form.fullName,
      role: form.role, status: form.status,
      groups: form.groups.split(',').map(g => g.trim()).filter(Boolean),
      mfaEnabled: form.mfaEnabled, comment: form.comment,
      createdAt: new Date().toISOString().split('T')[0],
    };
    await saveUsers([...users, user]);
    setModalOpen(false);
    setForm(emptyForm);
    toast.success('User created and saved');
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    const next = users.map(u => u.id === selectedUser.id ? {
      ...u, username: form.username || u.username, email: form.email, fullName: form.fullName,
      role: form.role, status: form.status,
      groups: form.groups.split(',').map(g => g.trim()).filter(Boolean),
      mfaEnabled: form.mfaEnabled, comment: form.comment,
    } : u);
    await saveUsers(next);
    setEditModalOpen(false);
    toast.success('User updated and saved');
  };

  const handleToggleStatus = async (id: string) => {
    const next = users.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'disabled' as const : 'active' as const } : u);
    await saveUsers(next);
    const u = next.find(u => u.id === id);
    toast.success(`User ${u?.username} ${u?.status === 'active' ? 'enabled' : 'disabled'}`);
  };

  const handleDelete = async (id: string) => {
    const u = users.find(u => u.id === id);
    await saveUsers(users.filter(u => u.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirm(null);
    toast.success(`User "${u?.username}" deleted`);
  };

  const openEditModal = () => {
    if (!selectedUser) { toast.info('Select a user first'); return; }
    setForm({
      username: selectedUser.username, email: selectedUser.email,
      fullName: selectedUser.fullName, role: selectedUser.role,
      status: selectedUser.status, groups: selectedUser.groups.join(', '),
      mfaEnabled: selectedUser.mfaEnabled, comment: selectedUser.comment,
    });
    setEditModalOpen(true);
  };

  const formatLastLogin = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const UserFormFields = () => (
    <div className="space-y-3 text-[11px]">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Username *</Label>
          <Input className="h-7 text-[11px]" placeholder="john.doe" value={form.username}
            onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Email</Label>
          <Input className="h-7 text-[11px]" type="email" placeholder="user@company.com" value={form.email}
            onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Full Name</Label>
        <Input className="h-7 text-[11px]" placeholder="John Doe" value={form.fullName}
          onChange={(e) => setForm(p => ({ ...p, fullName: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Role</Label>
          <Select value={form.role} onValueChange={(v: any) => setForm(p => ({ ...p, role: v }))}>
            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="operator">Operator</SelectItem>
              <SelectItem value="readonly">Read Only</SelectItem>
              <SelectItem value="vpn-user">VPN User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Status</Label>
          <Select value={form.status} onValueChange={(v: any) => setForm(p => ({ ...p, status: v }))}>
            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Groups (comma-separated)</Label>
        <Input className="h-7 text-[11px]" placeholder="Administrators, VPN_Users" value={form.groups}
          onChange={(e) => setForm(p => ({ ...p, groups: e.target.value }))} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="mfa-check" checked={form.mfaEnabled}
          onChange={(e) => setForm(p => ({ ...p, mfaEnabled: e.target.checked }))}
          className="accent-[hsl(142,70%,35%)]" />
        <Label htmlFor="mfa-check" className="text-[11px] cursor-pointer">Enable Multi-Factor Authentication (MFA)</Label>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Comment</Label>
        <Input className="h-7 text-[11px]" placeholder="User description or notes" value={form.comment}
          onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <Shell>
      <div className="space-y-0">
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <User size={14} />
            <span className="font-semibold">Local Users</span>
            <span className="text-[10px] text-[#888]">Local User Accounts</span>
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
            if (!selectedId) { toast.info('Select a user to delete'); return; }
            setDeleteConfirm(selectedId);
          }}>
            <Trash2 size={12} /><span>Delete</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => {
            if (!selectedId) { toast.info('Select a user first'); return; }
            handleToggleStatus(selectedId);
          }}>
            <Key size={12} /><span>Toggle Status</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => { setLoaded(false); queryClient.invalidateQueries({ queryKey: ['system-settings'] }); }}>
            <RefreshCw size={12} /><span>Refresh</span>
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input type="text" placeholder="Search users…" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <StatsBar items={[
          { icon: User,         value: stats.total,  label: 'Total Users' },
          { icon: CheckCircle,  value: stats.active, label: 'Active',      color: 'text-green-600' },
          { icon: Shield,       value: stats.admin,  label: 'Admins',      color: 'text-red-600' },
          { icon: Key,          value: stats.mfa,    label: 'MFA Enabled', color: 'text-blue-600' },
        ]} />

        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>MFA</th>
              <th>Groups</th>
              <th>Last Login</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-[#999] py-4">No users found</td></tr>
            ) : filteredUsers.map((user) => (
              <tr key={user.id} onClick={() => setSelectedId(user.id)}
                className={cn('cursor-pointer', selectedId === user.id && 'bg-[#fff8e1]')}>
                <td className="text-center">
                  <input type="radio" name="user-select" checked={selectedId === user.id}
                    onChange={() => setSelectedId(user.id)} className="accent-[hsl(142,70%,35%)]" />
                </td>
                <td className="font-medium font-mono text-[#333]">{user.username}</td>
                <td className="text-[#555]">{user.fullName}</td>
                <td className="text-[#666] text-[10px]">{user.email}</td>
                <td>
                  <span className={cn('forti-tag', roleColors[user.role])}>
                    {user.role.toUpperCase()}
                  </span>
                </td>
                <td>
                  {user.status === 'active'
                    ? <span className="flex items-center gap-1 text-green-600 text-[11px]"><CheckCircle size={11} />Active</span>
                    : <span className="flex items-center gap-1 text-red-500 text-[11px]"><XCircle size={11} />Disabled</span>
                  }
                </td>
                <td className="text-center">
                  {user.mfaEnabled
                    ? <span className="text-green-600 text-[10px] font-medium">ON</span>
                    : <span className="text-[#bbb] text-[10px]">—</span>
                  }
                </td>
                <td className="text-[#555]">
                  <div className="flex flex-wrap gap-0.5 max-w-[160px]">
                    {user.groups.slice(0, 2).map((g, i) => (
                      <span key={i} className="px-1 py-0.5 text-[9px] bg-[#f0f0f0] border border-[#ddd] text-[#555]">{g}</span>
                    ))}
                    {user.groups.length > 2 && <span className="text-[9px] text-[#888]">+{user.groups.length - 2}</span>}
                  </div>
                </td>
                <td className="text-[#888] text-[10px]">{formatLastLogin(user.lastLogin)}</td>
                <td className="text-[#888] max-w-[120px] truncate text-[10px]">{user.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Detail Panel */}
        {selectedUser && (
          <div className="border-x border-b border-[#ddd] bg-white">
            <div className="px-3 py-1.5 bg-[#e8e8e8] border-b border-[#ccc] text-[11px] font-semibold text-[#333] flex items-center gap-2">
              <User size={12} />
              <span>User Details — {selectedUser.username}</span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
              <div>
                <span className="text-[#888] block">Username</span>
                <span className="font-mono font-medium text-[#333]">{selectedUser.username}</span>
              </div>
              <div>
                <span className="text-[#888] block">Role</span>
                <span className={cn('forti-tag', roleColors[selectedUser.role])}>{selectedUser.role.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-[#888] block">Status</span>
                <span className={selectedUser.status === 'active' ? 'text-green-600 font-medium' : 'text-red-500'}>
                  {selectedUser.status === 'active' ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div>
                <span className="text-[#888] block">MFA</span>
                <span className={selectedUser.mfaEnabled ? 'text-green-600 font-medium' : 'text-[#999]'}>
                  {selectedUser.mfaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div>
                <span className="text-[#888] block">Full Name</span>
                <span className="text-[#333]">{selectedUser.fullName || '—'}</span>
              </div>
              <div>
                <span className="text-[#888] block">Email</span>
                <span className="text-[#333]">{selectedUser.email || '—'}</span>
              </div>
              <div>
                <span className="text-[#888] block">Last Login</span>
                <span className="text-[#666]">{formatLastLogin(selectedUser.lastLogin)}</span>
              </div>
              <div>
                <span className="text-[#888] block">Created</span>
                <span className="text-[#666]">{selectedUser.createdAt}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#888] block">Groups</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {selectedUser.groups.length ? selectedUser.groups.map((g, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] bg-[#f0f0f0] border border-[#ddd] text-[#555]">{g}</span>
                  )) : <span className="text-[#999]">No groups</span>}
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[#888] block">Comment</span>
                <span className="text-[#555]">{selectedUser.comment || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Create Local User</DialogTitle></DialogHeader>
          <UserFormFields />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
            <button className="forti-toolbar-btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="forti-toolbar-btn primary" onClick={handleAdd}>Create User</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Edit User — {selectedUser?.username}</DialogTitle></DialogHeader>
          <UserFormFields />
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
              Delete user "{users.find(u => u.id === deleteConfirm)?.username}"? This cannot be undone.
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

export default LocalUsers;
