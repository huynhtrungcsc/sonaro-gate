import { useState } from 'react';
import { StatsBar } from '@/components/ui/stats-bar';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { Plus, Edit, Trash2, RefreshCw, Search, Users, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface UserGroup {
  id: string;
  name: string;
  type: 'firewall' | 'fsso' | 'radius' | 'local';
  members: string[];
  matchType: 'any' | 'all';
  comment: string;
  createdAt: string;
  references: number;
}

const typeColors: Record<string, string> = {
  firewall: 'bg-blue-100 text-blue-700 border-blue-200',
  fsso: 'bg-purple-100 text-purple-700 border-purple-200',
  radius: 'bg-orange-100 text-orange-700 border-orange-200',
  local: 'bg-green-100 text-green-700 border-green-200',
};

const initialGroups: UserGroup[] = [
  {
    id: 'grp-1', name: 'Administrators', type: 'local',
    members: ['admin', 'netops'], matchType: 'any',
    comment: 'Full administrative access group',
    createdAt: '2024-01-01', references: 5,
  },
  {
    id: 'grp-2', name: 'VPN_Users', type: 'firewall',
    members: ['netops', 'security_audit', 'readonly'], matchType: 'any',
    comment: 'Users allowed VPN access',
    createdAt: '2024-02-10', references: 3,
  },
  {
    id: 'grp-3', name: 'Domain_Users', type: 'fsso',
    members: ['CN=Domain Users,OU=Groups,DC=company,DC=com'], matchType: 'any',
    comment: 'Active Directory domain users via FSSO',
    createdAt: '2024-02-15', references: 8,
  },
  {
    id: 'grp-4', name: 'RADIUS_Staff', type: 'radius',
    members: ['staff-group'], matchType: 'any',
    comment: 'RADIUS authenticated staff',
    createdAt: '2024-03-01', references: 2,
  },
  {
    id: 'grp-5', name: 'Guest_Access', type: 'firewall',
    members: ['guest1', 'guest2'], matchType: 'any',
    comment: 'Limited guest internet access',
    createdAt: '2024-03-05', references: 1,
  },
  {
    id: 'grp-6', name: 'IT_Department', type: 'local',
    members: ['admin', 'netops', 'security_audit'], matchType: 'all',
    comment: 'IT department members with elevated access',
    createdAt: '2024-03-10', references: 4,
  },
];

const UserGroups = () => {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'firewall' as UserGroup['type'],
    members: '', matchType: 'any' as 'any' | 'all', comment: '',
  });

  const selectedGroup = groups.find(g => g.id === selectedId);

  const filteredGroups = groups.filter(g =>
    !searchQuery ||
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.comment.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: groups.length,
    firewall: groups.filter(g => g.type === 'firewall').length,
    fsso: groups.filter(g => g.type === 'fsso').length,
    local: groups.filter(g => g.type === 'local').length,
  };

  const handleAdd = () => {
    if (!form.name) { toast.error('Group name is required'); return; }
    if (groups.some(g => g.name === form.name)) { toast.error('Group name already exists'); return; }
    const grp: UserGroup = {
      id: `grp-${Date.now()}`, name: form.name, type: form.type,
      members: form.members.split(',').map(m => m.trim()).filter(Boolean),
      matchType: form.matchType, comment: form.comment,
      createdAt: new Date().toISOString().split('T')[0], references: 0,
    };
    setGroups(prev => [...prev, grp]);
    setModalOpen(false);
    setForm({ name: '', type: 'firewall', members: '', matchType: 'any', comment: '' });
    toast.success('Group created successfully');
  };

  const handleEdit = () => {
    if (!selectedGroup) return;
    setGroups(prev => prev.map(g =>
      g.id === selectedGroup.id ? {
        ...g, name: form.name || g.name, type: form.type,
        members: form.members.split(',').map(m => m.trim()).filter(Boolean),
        matchType: form.matchType, comment: form.comment,
      } : g
    ));
    setEditModalOpen(false);
    toast.success('Group updated successfully');
  };

  const handleDelete = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirm(null);
    toast.success('Group deleted');
  };

  const openEditModal = () => {
    if (!selectedGroup) { toast.info('Select a group first'); return; }
    setForm({
      name: selectedGroup.name, type: selectedGroup.type,
      members: selectedGroup.members.join(', '),
      matchType: selectedGroup.matchType, comment: selectedGroup.comment,
    });
    setEditModalOpen(true);
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span className="font-semibold">User Groups</span>
            <span className="text-[10px] text-[#888]">Group Definitions & Membership</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={() => {
            setForm({ name: '', type: 'firewall', members: '', matchType: 'any', comment: '' });
            setModalOpen(true);
          }}>
            <Plus size={12} />
            <span>Create New</span>
          </button>
          <button className="forti-toolbar-btn" onClick={openEditModal}>
            <Edit size={12} />
            <span>Edit</span>
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (!selectedId) { toast.info('Select a group to delete'); return; }
            setDeleteConfirm(selectedId);
          }}>
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => toast.success('Data refreshed')}>
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input type="text" placeholder="Search groups..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar items={[
          { icon: Users, value: stats.total, label: 'Total Groups', color: 'text-blue-600' },
          { icon: Shield, value: stats.firewall, label: 'Firewall', color: 'text-blue-500' },
          { iconNode: <span className="w-2 h-2 rounded-full bg-purple-500" />, value: stats.fsso, label: 'FSSO', color: 'text-purple-600' },
          { iconNode: <span className="w-2 h-2 rounded-full bg-green-500" />, value: stats.local, label: 'Local', color: 'text-green-600' },
        ]} />

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Name</th>
              <th>Type</th>
              <th>Match</th>
              <th>Members</th>
              <th className="text-center">Ref.</th>
              <th>Comment</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-[#999] py-4">No groups found</td></tr>
            ) : filteredGroups.map((grp) => (
              <tr key={grp.id} onClick={() => setSelectedId(grp.id)}
                className={cn("cursor-pointer", selectedId === grp.id && "bg-[#fff8e1]")}
              >
                <td className="text-center">
                  <input type="radio" name="grp-select" checked={selectedId === grp.id}
                    onChange={() => setSelectedId(grp.id)} className="accent-[hsl(142,70%,35%)]"
                  />
                </td>
                <td className="font-medium text-[#333]">{grp.name}</td>
                <td>
                  <span className={cn("forti-tag", typeColors[grp.type])}>
                    {grp.type.toUpperCase()}
                  </span>
                </td>
                <td className="text-[#666]">{grp.matchType === 'any' ? 'Match Any' : 'Match All'}</td>
                <td className="text-[#555]">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {grp.members.slice(0, 3).map((m, i) => (
                      <span key={i} className="px-1.5 py-0.5 text-[10px] bg-[#f0f0f0] border border-[#ddd] text-[#555]">
                        {m.length > 20 ? m.substring(0, 20) + '…' : m}
                      </span>
                    ))}
                    {grp.members.length > 3 && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-[#e8e8e8] border border-[#ddd] text-[#888]">
                        +{grp.members.length - 3} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-center text-[#666]">{grp.references}</td>
                <td className="text-[#666] max-w-[150px] truncate">{grp.comment || '—'}</td>
                <td className="text-[#666]">{grp.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Selected Group Detail */}
        {selectedGroup && (
          <div className="border-x border-b border-[#ddd] bg-white">
            <div className="px-3 py-1.5 bg-[#e8e8e8] border-b border-[#ccc] text-[11px] font-semibold text-[#333] flex items-center gap-2">
              <Shield size={12} />
              <span>Group Details — {selectedGroup.name}</span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
              <div>
                <span className="text-[#888] block">Group Name</span>
                <span className="text-[#333] font-medium">{selectedGroup.name}</span>
              </div>
              <div>
                <span className="text-[#888] block">Type</span>
                <span className={cn("forti-tag", typeColors[selectedGroup.type])}>
                  {selectedGroup.type.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[#888] block">Match Type</span>
                <span className="text-[#333] font-medium">{selectedGroup.matchType === 'any' ? 'Match Any' : 'Match All'}</span>
              </div>
              <div>
                <span className="text-[#888] block">References</span>
                <span className="text-[#333] font-medium">{selectedGroup.references} policies</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#888] block">Members ({selectedGroup.members.length})</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {selectedGroup.members.map((m, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] bg-[#f0f0f0] border border-[#ddd] text-[#555] font-mono">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[#888] block">Comment</span>
                <span className="text-[#333]">{selectedGroup.comment || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Group Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Create User Group</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[11px]">
            <div className="space-y-1">
              <Label className="text-[11px]">Group Name</Label>
              <Input className="h-7 text-[11px]" placeholder="Group_Name" value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Type</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="firewall">Firewall</SelectItem>
                  <SelectItem value="fsso">Fortinet SSO (FSSO)</SelectItem>
                  <SelectItem value="radius">RADIUS</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Match Type</Label>
              <Select value={form.matchType} onValueChange={(v: any) => setForm(p => ({ ...p, matchType: v }))}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Match Any (OR)</SelectItem>
                  <SelectItem value="all">Match All (AND)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Members (comma-separated)</Label>
              <Input className="h-7 text-[11px]" placeholder="user1, user2, user3" value={form.members}
                onChange={(e) => setForm(p => ({ ...p, members: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Comment</Label>
              <Input className="h-7 text-[11px]" placeholder="Group description" value={form.comment}
                onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
              <button className="forti-toolbar-btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="forti-toolbar-btn primary" onClick={handleAdd}>Create Group</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Edit Group — {selectedGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[11px]">
            <div className="space-y-1">
              <Label className="text-[11px]">Group Name</Label>
              <Input className="h-7 text-[11px]" value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Type</Label>
              <Select value={form.type} onValueChange={(v: any) => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="firewall">Firewall</SelectItem>
                  <SelectItem value="fsso">Fortinet SSO (FSSO)</SelectItem>
                  <SelectItem value="radius">RADIUS</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Match Type</Label>
              <Select value={form.matchType} onValueChange={(v: any) => setForm(p => ({ ...p, matchType: v }))}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Match Any (OR)</SelectItem>
                  <SelectItem value="all">Match All (AND)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Members (comma-separated)</Label>
              <Input className="h-7 text-[11px]" value={form.members}
                onChange={(e) => setForm(p => ({ ...p, members: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Comment</Label>
              <Input className="h-7 text-[11px]" value={form.comment}
                onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#eee]">
              <button className="forti-toolbar-btn" onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button className="forti-toolbar-btn primary" onClick={handleEdit}>Save Changes</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Are you sure you want to delete group "{groups.find(g => g.id === deleteConfirm)?.name}"? This action cannot be undone.
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

export default UserGroups;
