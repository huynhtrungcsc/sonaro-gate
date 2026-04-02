import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface CaptureSession {
  id: string;
  name: string;
  interface: string;
  filter: string;
  status: 'running' | 'stopped' | 'completed' | 'error';
  packets: number;
  size_bytes: number;
  pcap_file: string | null;
  started_at: string | null;
  stopped_at: string | null;
  created_at: string;
}

export function usePacketCaptures() {
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setSessions([]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const createCapture = async (name: string, iface: string, filter: string) => {
    const s: CaptureSession = {
      id: Date.now().toString(), name, interface: iface, filter,
      status: 'running', packets: 0, size_bytes: 0, pcap_file: null,
      started_at: new Date().toISOString(), stopped_at: null, created_at: new Date().toISOString(),
    };
    setSessions(prev => [s, ...prev]);
    toast.success('Capture session started');
  };

  const updateCapture = async (id: string, updates: Partial<CaptureSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    toast.success('Capture updated');
  };

  const deleteCapture = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success('Capture deleted');
  };

  const toggleStatus = async (session: CaptureSession) => {
    const newStatus = session.status === 'running' ? 'stopped' : 'running';
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: newStatus as any } : s));
    toast.success(newStatus === 'running' ? 'Capture started' : 'Capture stopped');
  };

  return { sessions, loading, fetchSessions, createCapture, updateCapture, deleteCapture, toggleStatus };
}
