import { useState } from 'react';
import { StatsBar } from '@/components/ui/stats-bar';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import {
  Users, Plus, RefreshCw, Search, Edit, Trash2, Shield, Key,
  Clock, CheckCircle, XCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/postgrest';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type AppRole = 'super_admin' | 'admin' | 'operator' | 'auditor';

interface AdminUser {
  userId: string;
  fullName: string;
  email: string;
  roles: AppRole[];
  createdAt: string;
  avatarUrl: string | null;
}

// ── Auth-aware fetch helper ──────────────────────
async function authedFetch(path: string, opts: RequestInit = {}) {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Fetch functions ──────────────────────────────
async function fetchAdminUsers(): Promise<AdminUser[]> {
  return authedFetch('/admin/users');
}

async function fetchAuditLogs(limit = 100) {
  return authedFetch(`/admin/audit-logs?limit=${limit}`);
}

// ── Style maps ──────────────────────────────────
const roleColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700 border-red-200',
  admin: 'bg-orange-100 text-orange-700 border-orange-200',
  operator: 'bg-blue-100 text-blue-700 border-blue-200',
  auditor: 'bg-gray-100 text-gray-600 border-gray-200',
};

const roleDescriptions: Record<string, string> = {
  super_admin: 'Bootstrap/recovery account — full system access, user management, security settings, license & HA. Use sparingly; create Admin accounts for daily operations.',
  admin: 'Day-to-day operations — firewall policy, VPN, routing, system settings, monitoring. Cannot manage other admins or change security-critical settings.',
  operator: 'Limited configuration — firewall rules, VPN tunnels, routing entries, and log viewing. Cannot change system settings or manage users.',
  auditor: 'Read-only — access to logs, reports and audit trails only. Ideal for compliance and external review.',
};

const actionColors: Record<string, string> = {
  login: 'bg-green-100 text-green-700 border-green-200',
  logout: 'bg-gray-100 text-gray-600 border-gray-200',
  config_change: 'bg-blue-100 text-blue-700 border-blue-200',
  policy_change: 'bg-purple-100 text-purple-700 border-purple-200',
  user_create: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  user_delete: 'bg-orange-100 text-orange-700 border-orange-200',
  failed_login: 'bg-red-100 text-red-700 border-red-200',
};

const AdminProfiles = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', confirmPassword: '', role: 'operator' as AppRole });

  const { isAdminOrSuper } = useAuth();
  const queryClient = useQueryClient();

  // ── Queries ─────────────────────────────────
  const { data: adminUsers = [], isLoading: loadingUsers } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
  });

  const { data: auditLogs = [], isLoading: loadingLogs } = useQuery<any[]>({
    queryKey: ['audit-logs-admin'],
    queryFn: () => fetchAuditLogs(100),
  });

  // ── Mutations ───────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (input: { fullName: string; email: string; password: string; role: AppRole }) => {
      return authedFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: input.email, password: input.password, full_name: input.fullName, role: input.role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateOpen(false);
      setNewUser({ fullName: '', email: '', password: '', confirmPassword: '', role: 'operator' });
      toast.success('Administrator created');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create user'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, fullName, role }: { userId: string; fullName: string; role: AppRole }) => {
      return authedFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ full_name: fullName, role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditOpen(false);
      toast.success('User updated');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return authedFetch(`/admin/users/${userId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteConfirm(null);
      setSelectedUserId(null);
      toast.success('Administrator removed');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete'),
  });

  // ── Helpers ─────────────────────────────────
  const selectedUser = adminUsers.find(u => u.userId === selectedUserId);

  const filteredUsers = adminUsers.filter(u =>
    !searchQuery ||
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.roles.some(r => r.includes(searchQuery.toLowerCase()))
  );

  const filteredLogs = auditLogs.filter((l: any) =>
    !searchQuery ||
    l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.resource_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: adminUsers.length,
    superAdmins: adminUsers.filter(u => u.roles.includes('super_admin')).length,
    admins: adminUsers.filter(u => u.roles.includes('admin')).length,
    recentLogs: auditLogs.filter((l: any) => new Date(l.created_at).getTime() > Date.now() - 86400000).length,
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs-admin'] });
    toast.success('Data refreshed');
  };

  const handleCreate = () => {
    if (!newUser.email || !newUser.password) { toast.error('Email and password are required'); return; }
    if (newUser.password !== newUser.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newUser.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    createMutation.mutate(newUser);
  };

  const handleEdit = () => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({ userId: selectedUser.userId, fullName: newUser.fullName, role: newUser.role });
  };

  const openEditModal = () => {
    if (!selectedUser) { toast.info('Select a user first'); return; }
    setNewUser({
      fullName: selectedUser.fullName,
      email: selectedUser.email,
      password: '', confirmPassword: '',
      role: selectedUser.roles[0] || 'operator',
    });
    setEditOpen(true);
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Shield size={14} />
            <span className="font-semibold">Administrators</span>
            <span className="text-[10px] text-[#888]">User & Role Management</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          {isAdminOrSuper && (
            <>
              <button className="forti-toolbar-btn primary" onClick={() => {
                setNewUser({ fullName: '', email: '', password: '', confirmPassword: '', role: 'operator' });
                setCreateOpen(true);
              }}>
                <Plus size={12} />
                <span>Create New</span>
              </button>
              <button className="forti-toolbar-btn" onClick={openEditModal}>
                <Edit size={12} />
                <span>Edit</span>
              </button>
              <button className="forti-toolbar-btn" onClick={() => {
                if (!selectedUserId) { toast.info('Select a user to delete'); return; }
                setDeleteConfirm(selectedUserId);
              }}>
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
              <div className="forti-toolbar-separator" />
            </>
          )}
          <button className="forti-toolbar-btn" onClick={handleRefresh}>
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar items={[
          { icon: Users, value: stats.total, label: 'Total', color: 'text-blue-600' },
          { icon: Shield, value: stats.superAdmins, label: 'Super Admins', color: 'text-red-600' },
          { icon: Key, value: stats.admins, label: 'Admins', color: 'text-orange-600' },
          { icon: Clock, value: stats.recentLogs, label: 'Events (24h)', color: 'text-purple-600' },
        ]} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-[#f0f0f0] border-x border-b border-[#ddd]">
            <TabsList className="bg-transparent h-auto p-0 rounded-none">
              <TabsTrigger value="users" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]">
                Admin Users
              </TabsTrigger>
              <TabsTrigger value="roles" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]">
                Role Matrix
              </TabsTrigger>
              <TabsTrigger value="audit" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]">
                Audit Logs
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">Loading...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">No administrators found</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr
                    key={u.userId}
                    onClick={() => setSelectedUserId(u.userId)}
                    className={cn("cursor-pointer", selectedUserId === u.userId && "bg-[#fff8e1]")}
                  >
                    <td className="text-center">
                      <input type="radio" name="user-select" checked={selectedUserId === u.userId}
                        onChange={() => setSelectedUserId(u.userId)} className="accent-[hsl(142,70%,35%)]" />
                    </td>
                    <td className="font-medium text-[#333]">
                      <div className="flex items-center gap-1.5">
                        {u.fullName || '—'}
                        {u.email === 'admin@sonaro.local' && (
                          <span className="text-[9px] bg-[#e8f0fe] text-[#3367d6] border border-[#b3c8f5] px-1 py-0 rounded font-normal">default</span>
                        )}
                      </div>
                    </td>
                    <td className="text-[#666]">{u.email || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1 flex-wrap">
                        {u.roles.map(role => (
                          <span key={role} className={cn("forti-tag", roleColors[role])}>
                            {role === 'super_admin' ? 'SUPER ADMIN' : role.toUpperCase().replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-[#666]">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Selected user detail */}
            {selectedUser && (
              <div className="border-x border-b border-[#ddd] bg-white">
                <div className="px-3 py-1.5 bg-[#e8e8e8] border-b border-[#ccc] text-[11px] font-semibold text-[#333] flex items-center gap-2">
                  <Shield size={12} />
                  <span>Details — {selectedUser.fullName || selectedUser.email}</span>
                </div>
                <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
                  <div>
                    <span className="text-[#888] block">Full Name</span>
                    <span className="text-[#333] font-medium">{selectedUser.fullName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#888] block">Email</span>
                    <span className="text-[#333] font-medium">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-[#888] block">Roles</span>
                    <div className="flex gap-1 flex-wrap">
                      {selectedUser.roles.map(r => (
                        <span key={r} className={cn("forti-tag", roleColors[r])}>{r.toUpperCase().replace('_', ' ')}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[#888] block">Created</span>
                    <span className="text-[#333] font-medium">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Role Matrix Tab */}
          <TabsContent value="roles" className="mt-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="text-center w-24">Super Admin</th>
                  <th className="text-center w-24">Admin</th>
                  <th className="text-center w-24">Operator</th>
                  <th className="text-center w-24">Auditor</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">Loading...</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.userId}>
                    <td className="font-medium text-[#333]">
                      <div className="flex items-center gap-2">
                        <Shield size={12} className="text-[#666]" />
                        {u.fullName || u.email || '—'}
                      </div>
                    </td>
                    {(['super_admin', 'admin', 'operator', 'auditor'] as AppRole[]).map(role => (
                      <td key={role} className="text-center">
                        {u.roles.includes(role) ? (
                          <CheckCircle size={14} className="text-green-600 mx-auto" />
                        ) : (
                          <XCircle size={14} className="text-gray-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Role Descriptions */}
            <div className="border-x border-b border-[#ddd] bg-white p-3">
              <div className="text-[11px] font-semibold text-[#333] mb-2">Role Descriptions</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(roleDescriptions).map(([role, desc]) => (
                  <div key={role} className="flex items-start gap-2 p-2 bg-[#fafafa] border border-[#eee]">
                    <span className={cn("forti-tag mt-0.5", roleColors[role])}>{role.toUpperCase().replace('_', ' ')}</span>
                    <span className="text-[#666]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="mt-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-28">Time</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">Loading...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">No audit logs found</td></tr>
                ) : filteredLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="text-[#666]">{formatTime(log.created_at)}</td>
                    <td>
                      <span className={cn("forti-tag", actionColors[log.action] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                        {(log.action || '').toUpperCase().replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-[#666]">{log.resource_type}</td>
                    <td className="text-[#666]">{typeof log.details === 'string' ? log.details : log.details ? JSON.stringify(log.details) : '—'}</td>
                    <td className="mono text-[#666]">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create User Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Create New Administrator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-[11px]">
            <div className="space-y-1">
              <Label className="text-[11px]">Full Name</Label>
              <Input className="h-7 text-[11px]" placeholder="John Doe"
                value={newUser.fullName} onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Email</Label>
              <Input className="h-7 text-[11px]" type="email" placeholder="user@company.com"
                value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Role</Label>
              <Select value={newUser.role} onValueChange={(v: AppRole) => setNewUser(p => ({ ...p, role: v }))}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-[#999]">{roleDescriptions[newUser.role]}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Password</Label>
              <Input className="h-7 text-[11px]" type="password"
                value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Confirm Password</Label>
              <Input className="h-7 text-[11px]" type="password"
                value={newUser.confirmPassword} onChange={e => setNewUser(p => ({ ...p, confirmPassword: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
              <button className="forti-toolbar-btn" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="forti-toolbar-btn primary" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Administrator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-[11px]">
            <div className="space-y-1">
              <Label className="text-[11px]">Email</Label>
              <Input className="h-7 text-[11px] bg-[#f5f5f5]" value={newUser.email} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Full Name</Label>
              <Input className="h-7 text-[11px]" value={newUser.fullName}
                onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Role</Label>
              <Select value={newUser.role} onValueChange={(v: AppRole) => setNewUser(p => ({ ...p, role: v }))}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-[#999]">{roleDescriptions[newUser.role]}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
              <button className="forti-toolbar-btn" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="forti-toolbar-btn primary" onClick={handleEdit} disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Remove Administrator</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Remove all roles from "{adminUsers.find(u => u.userId === deleteConfirm)?.fullName || adminUsers.find(u => u.userId === deleteConfirm)?.email}"? They will lose access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[11px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-[11px] bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConfirm) deleteMutation.mutate(deleteConfirm);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default AdminProfiles;
