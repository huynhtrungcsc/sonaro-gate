import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface ConfigBackup {
  id: string;
  filename: string;
  filepath: string;
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
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBackups = useCallback(async () => {
    setBackups([]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const deleteBackup = async (id: string) => {
    setBackups(prev => prev.filter(b => b.id !== id));
    toast.success('Backup deleted');
  };

  return { backups, loading, fetchBackups, deleteBackup };
}
