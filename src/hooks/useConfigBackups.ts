import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/queryClient';

export interface ConfigBackup {
  id: string;
  filename: string;
  size_bytes: number;
  type: 'manual' | 'auto' | 'pre-upgrade' | 'scheduled';
  status: 'success' | 'failed' | 'in_progress';
  firmware_version: string;
  sections: string[];
  notes: string;
  created_by: string | null;
  created_at: string;
}

export function useConfigBackups() {
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading: loading } = useQuery<ConfigBackup[]>({
    queryKey: ['/api/crud/config_backups'],
    queryFn: async () => {
      const res = await fetch('/api/crud/config_backups?order=created_at.desc&limit=50', {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/crud/config_backups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crud/config_backups'] });
      toast.success('Backup record deleted');
    },
    onError: () => toast.error('Failed to delete backup'),
  });

  const recordBackup = async (data: Omit<ConfigBackup, 'id' | 'created_at' | 'created_by'>) => {
    try {
      await apiRequest('POST', '/api/crud/config_backups', data);
      queryClient.invalidateQueries({ queryKey: ['/api/crud/config_backups'] });
    } catch {
      // Non-fatal: the backup file was downloaded, only history record failed
    }
  };

  return {
    backups,
    loading,
    fetchBackups: () => queryClient.invalidateQueries({ queryKey: ['/api/crud/config_backups'] }),
    deleteBackup: (id: string) => deleteMut.mutate(id),
    recordBackup,
  };
}
