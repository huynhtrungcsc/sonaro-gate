import { useState } from 'react';
import { useCertificates } from '@/hooks/useDbData';
import { certificatesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { StatsBar } from '@/components/ui/stats-bar';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Shield, 
  Plus, 
  Edit2, 
  Trash2, 
  Search,
  RefreshCw,
  ChevronDown,
  Download,
  Upload,
  Key,
  FileText,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Certificate {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'ca';
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  status: 'valid' | 'expired' | 'expiring' | 'revoked';
  keyType: string;
  keySize: number;
  inUse: boolean;
  usedBy: string[];
}

const mockCertificates: Certificate[] = [
  {
    id: 'cert-1',
    name: 'Sonaro_Local_CA',
    type: 'ca',
    subject: 'CN=Sonaro Local CA, O=Sonaro Security, C=VN',
    issuer: 'CN=Sonaro Local CA, O=Sonaro Security, C=VN',
    serialNumber: '01:23:45:67:89:AB:CD:EF',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2034-01-01'),
    status: 'valid',
    keyType: 'RSA',
    keySize: 4096,
    inUse: true,
    usedBy: ['SSL Inspection'],
  },
  {
    id: 'cert-2',
    name: 'WebUI_Certificate',
    type: 'local',
    subject: 'CN=fw.local.lan, O=Sonaro Security',
    issuer: 'CN=Sonaro Local CA, O=Sonaro Security, C=VN',
    serialNumber: '11:22:33:44:55:66:77:88',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2025-01-01'),
    status: 'valid',
    keyType: 'RSA',
    keySize: 2048,
    inUse: true,
    usedBy: ['WebUI HTTPS'],
  },
  {
    id: 'cert-3',
    name: 'VPN_Server_Cert',
    type: 'local',
    subject: 'CN=vpn.company.com',
    issuer: 'CN=DigiCert Global CA G2',
    serialNumber: 'AA:BB:CC:DD:EE:FF:00:11',
    validFrom: new Date('2024-06-01'),
    validTo: new Date('2025-06-01'),
    status: 'valid',
    keyType: 'ECDSA',
    keySize: 256,
    inUse: true,
    usedBy: ['VPN Portal'],
  },
  {
    id: 'cert-4',
    name: 'Old_Certificate',
    type: 'local',
    subject: 'CN=old.server.com',
    issuer: 'CN=Old CA',
    serialNumber: '99:88:77:66:55:44:33:22',
    validFrom: new Date('2022-01-01'),
    validTo: new Date('2024-01-01'),
    status: 'expired',
    keyType: 'RSA',
    keySize: 2048,
    inUse: false,
    usedBy: [],
  },
  {
    id: 'cert-5',
    name: 'Expiring_Soon',
    type: 'local',
    subject: 'CN=expiring.server.com',
    issuer: 'CN=Sonaro Local CA',
    serialNumber: '12:34:56:78:90:AB:CD:EF',
    validFrom: new Date('2024-01-01'),
    validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
    status: 'expiring',
    keyType: 'RSA',
    keySize: 2048,
    inUse: false,
    usedBy: [],
  },
];

const CertificateManagement = () => {
  const queryClient = useQueryClient();
  const { data: certificates = [] } = useCertificates();
  const deleteMut = useMutation({ mutationFn: (id: string) => certificatesApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificates'] }), onError: () => toast.error('Failed to delete certificate') });
  const [activeTab, setActiveTab] = useState<'local' | 'ca' | 'remote' | 'csr'>('local');
  const [search, setSearch] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'generate' | 'import' | 'csr'>('generate');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  // CSR Form Data
  const [csrData, setCsrData] = useState({
    commonName: '',
    organization: '',
    organizationUnit: '',
    city: '',
    state: '',
    country: 'VN',
    keyType: 'RSA',
    keySize: '2048',
  });

  const filteredCerts = certificates.filter(c => {
    const matchesTab = activeTab === 'csr' ? false :
      activeTab === 'local' ? c.type === 'local' :
      activeTab === 'ca' ? c.type === 'ca' :
      c.type === 'remote';
    const matchesSearch = search === '' || 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const toDate = (v: any): Date => v instanceof Date ? v : new Date(v);
  const formatDate = (date: any) => toDate(date).toLocaleDateString('vi-VN');
  const getDaysUntilExpiry = (date: any) => {
    const diff = toDate(date).getTime() - Date.now();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  };

  const handleGenerateCSR = () => {
    if (!csrData.commonName) {
      toast.error('Common Name is required');
      return;
    }
    toast.success('CSR generated successfully');
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id);
    toast.success('Certificate deleted');
  };

  const handleExportCert = (cert: Certificate) => {
    const pemContent = [
      '-----BEGIN CERTIFICATE-----',
      btoa(`Subject: ${cert.subject}\nIssuer: ${cert.issuer}\nSerial: ${(cert as any).serial_number ?? (cert as any).serialNumber ?? ''}\nValid From: ${toDate((cert as any).valid_from ?? (cert as any).validFrom).toISOString()}\nValid To: ${toDate((cert as any).valid_to ?? (cert as any).validTo).toISOString()}\nKey: ${(cert as any).key_type ?? (cert as any).keyType ?? ''} ${(cert as any).key_size ?? (cert as any).keySize ?? ''}\nStatus: ${cert.status}`)
        .match(/.{1,64}/g)?.join('\n') || '',
      '-----END CERTIFICATE-----',
    ].join('\n');
    const blob = new Blob([pemContent], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cert.name}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cert.name}`);
  };

  const handleExportAll = () => {
    const certs = filteredCerts;
    if (certs.length === 0) {
      toast.error('No certificates to export');
      return;
    }
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'certificates',
      count: certs.length,
      data: certs.map(c => ({
        ...c,
        valid_from: toDate((c as any).valid_from ?? (c as any).validFrom).toISOString(),
        valid_to: toDate((c as any).valid_to ?? (c as any).validTo).toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${certs.length} certificates`);
  };

  const stats = {
    total: certificates.length,
    valid: certificates.filter(c => c.status === 'valid').length,
    expiring: certificates.filter(c => c.status === 'expiring').length,
    expired: certificates.filter(c => c.status === 'expired').length,
  };

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
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[200px]">
                <button 
                  onClick={() => { setModalType('generate'); setModalOpen(true); setShowCreateMenu(false); }}
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                >
                  <Key className="w-3 h-3" />
                  Generate Certificate
                </button>
                <button 
                  onClick={() => { setModalType('csr'); setModalOpen(true); setShowCreateMenu(false); }}
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                >
                  <FileText className="w-3 h-3" />
                  Generate CSR
                </button>
                <button 
                  onClick={() => { setModalType('import'); setModalOpen(true); setShowCreateMenu(false); }}
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                >
                  <Upload className="w-3 h-3" />
                  Import Certificate
                </button>
              </div>
            )}
          </div>
          <button className="forti-toolbar-btn" onClick={handleExportAll}>
            <Download className="w-3 h-3" />
            Export
          </button>
          <button className="forti-toolbar-btn" onClick={() => toast.info('Select a certificate to delete from the table')}>
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => { queryClient.invalidateQueries({ queryKey: ['certificates'] }); toast.success('Certificates refreshed'); }}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {/* Stats Strip */}
        <StatsBar items={[
          { icon: Shield, value: stats.total, label: 'Total Certificates', color: 'text-[hsl(142,70%,35%)]' },
          { icon: CheckCircle2, value: stats.valid, label: 'Valid', color: 'text-green-600' },
          { icon: Clock, value: stats.expiring, label: 'Expiring Soon', color: 'text-orange-600' },
          { icon: AlertTriangle, value: stats.expired, label: 'Expired', color: 'text-red-600' },
        ]} />

        {/* Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'local', label: 'Local Certificates', icon: Key },
            { id: 'ca', label: 'CA Certificates', icon: Shield },
            { id: 'remote', label: 'Remote Certificates', icon: Lock },
            { id: 'csr', label: 'CSR', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
                activeTab === tab.id 
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" 
                  : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Certificates Table */}
        {activeTab !== 'csr' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="forti-checkbox" />
                  </th>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Issuer</th>
                  <th>Valid From</th>
                  <th>Valid To</th>
                  <th>Key</th>
                  <th>Status</th>
                  <th>In Use</th>
                  <th className="w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCerts.map((cert) => (
                  <tr key={cert.id}>
                    <td>
                      <input type="checkbox" className="forti-checkbox" />
                    </td>
                    <td className="text-[11px] font-medium">{cert.name}</td>
                    <td className="text-[10px] text-[#666] max-w-[200px] truncate" title={cert.subject}>
                      {cert.subject}
                    </td>
                    <td className="text-[10px] text-[#666] max-w-[150px] truncate" title={cert.issuer}>
                      {cert.issuer.split(',')[0]}
                    </td>
                    <td className="text-[10px]">{formatDate((cert as any).valid_from ?? (cert as any).validFrom)}</td>
                    <td className="text-[10px]">
                      {(() => { const vt = (cert as any).valid_to ?? (cert as any).validTo; return (
                      <span className={cn(
                        cert.status === 'expired' && "text-red-600",
                        cert.status === 'expiring' && "text-orange-600"
                      )}>
                        {formatDate(vt)}
                        {cert.status === 'expiring' && (
                          <span className="ml-1 text-[9px]">({getDaysUntilExpiry(vt)}d)</span>
                        )}
                      </span>
                      ); })()}
                    </td>
                    <td className="text-[10px] text-[#666]">{(cert as any).key_type ?? (cert as any).keyType} {(cert as any).key_size ?? (cert as any).keySize}</td>
                    <td>
                      <span className={cn(
                        "forti-tag",
                        cert.status === 'valid' ? "bg-green-100 text-green-700 border-green-200" :
                        cert.status === 'expiring' ? "bg-orange-100 text-orange-700 border-orange-200" :
                        cert.status === 'expired' ? "bg-red-100 text-red-700 border-red-200" :
                        "bg-gray-100 text-gray-600 border-gray-200"
                      )}>
                        {cert.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {(() => { const inUse = (cert as any).in_use ?? (cert as any).inUse; const usedBy = (cert as any).used_by ?? (cert as any).usedBy ?? []; return inUse ? (
                        <span className="text-[10px] text-green-600" title={usedBy.join(', ')}>
                          Yes ({usedBy.length})
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#999]">No</span>
                      ); })()}
                    </td>
                    <td>
                      {(() => { const inUse = (cert as any).in_use ?? (cert as any).inUse; return (
                      <div className="flex items-center gap-1">
                        <button className="p-1 rounded hover:bg-[#e8e8e8] transition-colors" onClick={() => handleExportCert(cert)}>
                          <Download size={12} className="text-[#666]" />
                        </button>
                        <button
                          onClick={() => handleDelete(cert.id)}
                          className="p-1 rounded hover:bg-red-100 transition-colors"
                          disabled={inUse}
                        >
                          <Trash2 size={12} className={inUse ? "text-[#ccc]" : "text-red-500"} />
                        </button>
                      </div>
                      ); })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[11px] text-[#666] mt-2 px-1">
              {filteredCerts.length} certificates
            </div>
          </div>
        )}

        {/* CSR Tab */}
        {activeTab === 'csr' && (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="section">
                <div className="section-header">
                  <span>Generate Certificate Signing Request</span>
                </div>
                <div className="section-body space-y-4">
                  <div>
                    <label className="forti-label">Common Name (CN) *</label>
                    <input
                      type="text"
                      value={csrData.commonName}
                      onChange={(e) => setCsrData({ ...csrData, commonName: e.target.value })}
                      className="forti-input w-full"
                      placeholder="www.example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Organization (O)</label>
                      <input
                        type="text"
                        value={csrData.organization}
                        onChange={(e) => setCsrData({ ...csrData, organization: e.target.value })}
                        className="forti-input w-full"
                        placeholder="Company Name"
                      />
                    </div>
                    <div>
                      <label className="forti-label">Organizational Unit (OU)</label>
                      <input
                        type="text"
                        value={csrData.organizationUnit}
                        onChange={(e) => setCsrData({ ...csrData, organizationUnit: e.target.value })}
                        className="forti-input w-full"
                        placeholder="IT Department"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="forti-label">City/Locality</label>
                      <input
                        type="text"
                        value={csrData.city}
                        onChange={(e) => setCsrData({ ...csrData, city: e.target.value })}
                        className="forti-input w-full"
                        placeholder="Ho Chi Minh"
                      />
                    </div>
                    <div>
                      <label className="forti-label">State/Province</label>
                      <input
                        type="text"
                        value={csrData.state}
                        onChange={(e) => setCsrData({ ...csrData, state: e.target.value })}
                        className="forti-input w-full"
                        placeholder="HCM"
                      />
                    </div>
                    <div>
                      <label className="forti-label">Country</label>
                      <select 
                        value={csrData.country}
                        onChange={(e) => setCsrData({ ...csrData, country: e.target.value })}
                        className="forti-select w-full"
                      >
                        <option value="VN">Vietnam (VN)</option>
                        <option value="US">United States (US)</option>
                        <option value="SG">Singapore (SG)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Key Type</label>
                      <select 
                        value={csrData.keyType}
                        onChange={(e) => setCsrData({ ...csrData, keyType: e.target.value })}
                        className="forti-select w-full"
                      >
                        <option value="RSA">RSA</option>
                        <option value="ECDSA">ECDSA</option>
                      </select>
                    </div>
                    <div>
                      <label className="forti-label">Key Size</label>
                      <select 
                        value={csrData.keySize}
                        onChange={(e) => setCsrData({ ...csrData, keySize: e.target.value })}
                        className="forti-select w-full"
                      >
                        {csrData.keyType === 'RSA' ? (
                          <>
                            <option value="2048">2048 bits</option>
                            <option value="3072">3072 bits</option>
                            <option value="4096">4096 bits</option>
                          </>
                        ) : (
                          <>
                            <option value="256">P-256</option>
                            <option value="384">P-384</option>
                            <option value="521">P-521</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[#ddd]">
                    <button onClick={handleGenerateCSR} className="forti-btn forti-btn-primary">
                      Generate CSR
                    </button>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-header-neutral">
                  <span>Pending CSRs</span>
                </div>
                <div className="section-body">
                  <div className="text-center py-8 text-[#666]">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <div className="text-[11px]">No pending CSRs</div>
                    <div className="text-[10px] text-[#999] mt-1">Generated CSRs will appear here</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="forti-modal-header">
            <DialogTitle className="text-sm">
              {modalType === 'generate' && 'Generate Certificate'}
              {modalType === 'import' && 'Import Certificate'}
              {modalType === 'csr' && 'Generate CSR'}
            </DialogTitle>
          </div>
          <div className="forti-modal-body space-y-4">
            {modalType === 'import' && (
              <>
                <div>
                  <label className="forti-label">Certificate Name</label>
                  <input type="text" className="forti-input w-full" placeholder="My Certificate" />
                </div>
                <div>
                  <label className="forti-label">Certificate Type</label>
                  <select className="forti-select w-full">
                    <option>Local Certificate</option>
                    <option>CA Certificate</option>
                    <option>Remote Certificate</option>
                  </select>
                </div>
                <div>
                  <label className="forti-label">Certificate File (PEM/CRT)</label>
                  <div className="border-2 border-dashed border-[#ccc] rounded p-4 text-center">
                    <Upload className="w-8 h-8 mx-auto text-[#999] mb-2" />
                    <div className="text-[11px] text-[#666]">Click to upload or drag and drop</div>
                    <div className="text-[10px] text-[#999]">PEM, CRT, CER files supported</div>
                  </div>
                </div>
                <div>
                  <label className="forti-label">Private Key (optional)</label>
                  <div className="border-2 border-dashed border-[#ccc] rounded p-4 text-center">
                    <Key className="w-8 h-8 mx-auto text-[#999] mb-2" />
                    <div className="text-[11px] text-[#666]">Upload private key file</div>
                    <div className="text-[10px] text-[#999]">KEY, PEM files supported</div>
                  </div>
                </div>
              </>
            )}
            {modalType === 'generate' && (
              <>
                <div>
                  <label className="forti-label">Certificate Name</label>
                  <input type="text" className="forti-input w-full" placeholder="Self-Signed Certificate" />
                </div>
                <div>
                  <label className="forti-label">Common Name (CN)</label>
                  <input type="text" className="forti-input w-full" placeholder="*.local.lan" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="forti-label">Key Type</label>
                    <select className="forti-select w-full">
                      <option>RSA</option>
                      <option>ECDSA</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Validity (days)</label>
                    <input type="number" className="forti-input w-full" defaultValue="365" />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="forti-modal-footer">
            <button onClick={() => setModalOpen(false)} className="forti-btn forti-btn-secondary">
              Cancel
            </button>
            <button onClick={() => { toast.success('Operation completed'); setModalOpen(false); }} className="forti-btn forti-btn-primary">
              {modalType === 'import' ? 'Import' : 'Generate'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default CertificateManagement;
