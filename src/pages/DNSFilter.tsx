import { useState } from 'react';
import { useDNSFilterProfiles } from '@/hooks/useDbData';
import { dnsFilterProfilesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Search,
  ChevronDown,
  Globe,
  Shield,
  Ban
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface DNSFilterProfile {
  id: string;
  name: string;
  comment: string;
  domainFilter: boolean;
  fortiGuardCategory: boolean;
  safeSearch: boolean;
  youtubeRestrict: boolean;
  logAllDomains: boolean;
  enabled: boolean;
  blockedCategories: number;
  references: number;
}

const DNSFilter = () => {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useDNSFilterProfiles();
  const createMut = useMutation({ mutationFn: (d: any) => dnsFilterProfilesApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] }); setModalOpen(false); toast.success('Profile created'); }, onError: () => toast.error('Failed to create profile') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => dnsFilterProfilesApi.update(id, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] }); setModalOpen(false); toast.success('Profile updated'); }, onError: () => toast.error('Failed to update profile') });
  const deleteMut = useMutation({ mutationFn: (id: string) => dnsFilterProfilesApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] }), onError: () => toast.error('Failed to delete profile') });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<DNSFilterProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    comment: '',
    domainFilter: true,
    fortiGuardCategory: true,
    safeSearch: true,
    youtubeRestrict: false,
    logAllDomains: true,
  });

  const toggleProfile = (id: string) => {
    const profile = (profiles as any[]).find((p: any) => p.id === id);
    if (profile) updateMut.mutate({ id, d: { enabled: !profile.enabled } });
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProfiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProfiles.map(p => p.id));
    }
  };

  const openCreateModal = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      comment: '',
      domainFilter: true,
      fortiGuardCategory: true,
      safeSearch: true,
      youtubeRestrict: false,
      logAllDomains: true,
    });
    setModalOpen(true);
    setShowCreateMenu(false);
  };

  const openEditModal = () => {
    if (selectedIds.length !== 1) return;
    const profile = profiles.find(p => p.id === selectedIds[0]);
    if (!profile) return;
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      comment: profile.comment,
      domainFilter: (profile as any).domain_filter ?? (profile as any).domainFilter ?? true,
      fortiGuardCategory: (profile as any).fortiguard_category ?? (profile as any).fortiGuardCategory ?? true,
      safeSearch: (profile as any).safe_search ?? (profile as any).safeSearch ?? true,
      youtubeRestrict: (profile as any).youtube_restrict ?? (profile as any).youtubeRestrict ?? false,
      logAllDomains: (profile as any).log_all_domains ?? (profile as any).logAllDomains ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const dbData = { name: formData.name, comment: formData.comment, domain_filter: formData.domainFilter, fortiguard_category: formData.fortiGuardCategory, safe_search: formData.safeSearch, youtube_restrict: formData.youtubeRestrict, log_all_domains: formData.logAllDomains };
    if (editingProfile) {
      updateMut.mutate({ id: editingProfile.id, d: dbData });
    } else {
      createMut.mutate({ ...dbData, enabled: true, blocked_categories: formData.fortiGuardCategory ? 12 : 0, references_count: 0 });
    }
  };

  const handleDeleteConfirm = () => {
    const toDelete = (profiles as any[]).filter((p: any) => selectedIds.includes(p.id));
    const hasReferences = toDelete.some((p: any) => (p.references_count ?? p.references ?? 0) > 0);
    if (hasReferences) {
      toast.error('Cannot delete profiles that are in use');
      setDeleteDialogOpen(false);
      return;
    }
    selectedIds.forEach(id => deleteMut.mutate(id));
    setSelectedIds([]);
    setDeleteDialogOpen(false);
    toast.success(`${toDelete.length} profile(s) deleted`);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] });
    toast.success('Profiles refreshed');
  };

  const filteredProfiles = profiles.filter(profile => 
    searchQuery === '' ||
    profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.comment.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* FortiGate Toolbar */}
        <div className="forti-toolbar">
          <div className="relative">
            <button 
              className="forti-toolbar-btn primary"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
            >
              <Plus className="w-3 h-3" />
              Create New
              <ChevronDown className="w-3 h-3" />
            </button>
            {showCreateMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[180px]">
                <button 
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                  onClick={openCreateModal}
                >
                  <Globe className="w-3 h-3" />
                  DNS Filter Profile
                </button>
              </div>
            )}
          </div>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length !== 1}
            onClick={openEditModal}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length === 0}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="p-4">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input 
                    type="checkbox" 
                    className="forti-checkbox"
                    checked={selectedIds.length === filteredProfiles.length && filteredProfiles.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="w-16">Status</th>
                <th>Name</th>
                <th>Sonaro Guard</th>
                <th>Safe Search</th>
                <th>YouTube Restrict</th>
                <th>Blocked Categories</th>
                <th className="text-center">Ref.</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr 
                  key={profile.id} 
                  className={cn(!profile.enabled && "opacity-60", selectedIds.includes(profile.id) && "selected")}
                  onDoubleClick={() => { setSelectedIds([profile.id]); openEditModal(); }}
                >
                  <td>
                    <input 
                      type="checkbox" 
                      className="forti-checkbox"
                      checked={selectedIds.includes(profile.id)}
                      onChange={() => handleSelect(profile.id)}
                    />
                  </td>
                  <td>
                    <FortiToggle 
                      enabled={profile.enabled} 
                      onToggle={() => toggleProfile(profile.id)}
                      size="sm"
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-cyan-600" />
                      <div>
                        <div className="text-[11px] font-medium">{profile.name}</div>
                        <div className="text-[10px] text-[#999]">{profile.comment}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {((profile as any).fortiguard_category ?? (profile as any).fortiGuardCategory) ? (
                      <span className="forti-tag bg-green-100 text-green-700 border-green-200 flex items-center gap-1 w-fit">
                        <Shield className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#999]">Disabled</span>
                    )}
                  </td>
                  <td>
                    {((profile as any).safe_search ?? (profile as any).safeSearch) ? (
                      <span className="text-green-600 text-[11px]">✓ On</span>
                    ) : (
                      <span className="text-[#999] text-[11px]">Off</span>
                    )}
                  </td>
                  <td>
                    {((profile as any).youtube_restrict ?? (profile as any).youtubeRestrict) ? (
                      <span className="forti-tag bg-red-100 text-red-700 border-red-200 flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3" /> Strict
                      </span>
                    ) : (
                      <span className="text-[#999] text-[11px]">None</span>
                    )}
                  </td>
                  <td>
                    {(() => { const bc = (profile as any).blocked_categories ?? (profile as any).blockedCategories ?? 0; return (
                    <span className={cn("text-[11px] font-medium", bc > 20 ? "text-red-600" : bc > 10 ? "text-orange-600" : "text-blue-600")}>
                      {bc}
                    </span>
                    ); })()}
                  </td>
                  <td className="text-center">
                    {(() => { const refs = (profile as any).references_count ?? (profile as any).references ?? 0; return (
                    <span className={cn("text-[11px]", refs > 0 ? "text-blue-600" : "text-[#999]")}>
                      {refs}
                    </span>
                    ); })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filteredProfiles.length} DNS filter profiles
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {editingProfile ? 'Edit DNS Filter Profile' : 'Create DNS Filter Profile'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Profile name"
              />
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Input
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domainFilter"
                  checked={formData.domainFilter}
                  onCheckedChange={(checked) => setFormData({ ...formData, domainFilter: !!checked })}
                />
                <Label htmlFor="domainFilter" className="text-sm">Enable Domain Filter</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fortiGuardCategory"
                  checked={formData.fortiGuardCategory}
                  onCheckedChange={(checked) => setFormData({ ...formData, fortiGuardCategory: !!checked })}
                />
                <Label htmlFor="fortiGuardCategory" className="text-sm">Sonaro Guard Category Filtering</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="safeSearch"
                  checked={formData.safeSearch}
                  onCheckedChange={(checked) => setFormData({ ...formData, safeSearch: !!checked })}
                />
                <Label htmlFor="safeSearch" className="text-sm">Enforce Safe Search</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="youtubeRestrict"
                  checked={formData.youtubeRestrict}
                  onCheckedChange={(checked) => setFormData({ ...formData, youtubeRestrict: !!checked })}
                />
                <Label htmlFor="youtubeRestrict" className="text-sm">YouTube Restricted Mode</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="logAllDomains"
                  checked={formData.logAllDomains}
                  onCheckedChange={(checked) => setFormData({ ...formData, logAllDomains: !!checked })}
                />
                <Label htmlFor="logAllDomains" className="text-sm">Log All DNS Queries</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              {editingProfile ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} profile(s)? This action cannot be undone.
              Profiles that are referenced by firewall rules cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default DNSFilter;
