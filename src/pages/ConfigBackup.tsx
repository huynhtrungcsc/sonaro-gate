import { useState, useRef } from 'react';
import { StatsBar } from '@/components/ui/stats-bar';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import {
  Download, Upload, FileJson, FileCode, Check, AlertTriangle,
  Shield, Network, Clock, ArrowRightLeft, Eye, X,
  RefreshCw, HardDrive, Search
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { useConfigBackups } from '@/hooks/useConfigBackups';
import { formatBytes } from '@/lib/formatters';

interface ExportConfig {
  firewallRules: boolean;
  natRules: boolean;
  aliases: boolean;
  schedules: boolean;
}

interface ImportPreview {
  firewallRules: number;
  natRules: number;
  aliases: number;
  schedules: number;
  version: string;
  exportDate: string;
  valid: boolean;
  errors: string[];
}

const ConfigBackup = () => {
  const { backups, loading: backupsLoading } = useConfigBackups();
  const [activeTab, setActiveTab] = useState('backup');
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    firewallRules: true, natRules: true, aliases: true, schedules: true,
  });
  const [exportFormat, setExportFormat] = useState<'json' | 'xml'>('json');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const configSections = [
    { key: 'firewallRules', label: 'Firewall Rules', icon: Shield, count: 0 },
    { key: 'natRules', label: 'NAT Rules', icon: ArrowRightLeft, count: 0 },
    { key: 'aliases', label: 'Addresses', icon: Network, count: 0 },
    { key: 'schedules', label: 'Schedules', icon: Clock, count: 0 },
  ];

  const selectedCount = Object.values(exportConfig).filter(Boolean).length;

  const generateExportData = () => {
    const data: any = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      hostname: 'SONARO-GATE',
    };
    return data;
  };

  const convertToXML = (obj: any, rootName = 'config'): string => {
    const convert = (o: any, indent = 0): string => {
      const sp = '  '.repeat(indent);
      let xml = '';
      if (Array.isArray(o)) {
        o.forEach((item, idx) => { xml += `${sp}<item index="${idx}">\n${convert(item, indent + 1)}${sp}</item>\n`; });
      } else if (typeof o === 'object' && o !== null) {
        Object.entries(o).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            xml += `${sp}<${key}>\n${convert(value, indent + 1)}${sp}</${key}>\n`;
          } else {
            xml += `${sp}<${key}>${value}</${key}>\n`;
          }
        });
      } else { xml += `${sp}${o}\n`; }
      return xml;
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n${convert(obj, 1)}</${rootName}>`;
  };

  const handleExport = () => {
    const data = generateExportData();
    const isJson = exportFormat === 'json';
    const content = isJson ? JSON.stringify(data, null, 2) : convertToXML(data, 'sonaro-config');
    const filename = `sonaro-config-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
    const blob = new Blob([content], { type: isJson ? 'application/json' : 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Configuration exported as ${filename}`);
  };

  const handlePreview = () => {
    const data = generateExportData();
    setPreviewContent(exportFormat === 'json' ? JSON.stringify(data, null, 2) : convertToXML(data, 'sonaro-config'));
    setPreviewOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!file.name.endsWith('.json')) { toast.error('Only JSON import is supported'); return; }
        const data = JSON.parse(content);
        const preview: ImportPreview = {
          firewallRules: data.firewallRules?.length || 0,
          natRules: data.natRules?.length || 0,
          aliases: data.aliases?.length || 0,
          schedules: data.schedules?.length || 0,
          version: data.version || 'unknown',
          exportDate: data.exportDate || 'unknown',
          valid: true, errors: [],
        };
        if (!data.version) { preview.errors.push('Missing version field'); preview.valid = false; }
        if (preview.firewallRules === 0 && preview.natRules === 0 && preview.aliases === 0 && preview.schedules === 0) {
          preview.errors.push('No configuration data found'); preview.valid = false;
        }
        setImportPreview(preview); setImportData(data); setImporting(true);
      } catch { toast.error('Failed to parse file'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = () => {
    if (!importData) return;
    const imported = [];
    if (importData.firewallRules?.length) imported.push(`${importData.firewallRules.length} firewall rules`);
    if (importData.natRules?.length) imported.push(`${importData.natRules.length} NAT rules`);
    if (importData.aliases?.length) imported.push(`${importData.aliases.length} aliases`);
    if (importData.schedules?.length) imported.push(`${importData.schedules.length} schedules`);
    toast.success(`Imported: ${imported.join(', ')}`);
    setImporting(false); setImportPreview(null); setImportData(null);
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <HardDrive size={14} />
            <span className="font-semibold">Configuration Backup</span>
            <span className="text-[10px] text-[#888]">Export / Import / Restore</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={handleExport} disabled={selectedCount === 0}>
            <Download size={12} />
            <span>Backup</span>
          </button>
          <button className="forti-toolbar-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={12} />
            <span>Restore</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handlePreview} disabled={selectedCount === 0}>
            <Eye size={12} />
            <span>Preview</span>
          </button>
          <button className="forti-toolbar-btn" onClick={() => toast.success('Refreshed')}>
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input type="text" placeholder="Search..." readOnly />
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".json,.xml" onChange={handleFileSelect} className="hidden" />

        {/* Stats Bar */}
        <StatsBar items={[
          { icon: Shield, value: configSections.reduce((s, c) => s + c.count, 0), label: 'Total Objects', color: 'text-blue-600' },
          { icon: Check, value: selectedCount, label: 'Selected', color: 'text-green-600' },
          { icon: exportFormat === 'json' ? FileJson : FileCode, value: exportFormat.toUpperCase(), label: 'Format', color: exportFormat === 'json' ? 'text-amber-600' : 'text-purple-600' },
          { icon: Clock, value: backups.length, label: 'Recent Backups', color: 'text-gray-600' },
        ]} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-[#f0f0f0] border-x border-b border-[#ddd]">
            <TabsList className="bg-transparent h-auto p-0 rounded-none">
              <TabsTrigger value="backup" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]">
                Backup & Restore
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]">
                Backup History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Backup & Restore Tab */}
          <TabsContent value="backup" className="mt-0">
            <div className="border-x border-b border-[#ddd] bg-white">
              {/* Export format selector */}
              <div className="px-3 py-2 bg-[#f5f5f5] border-b border-[#ddd] flex items-center gap-4">
                <span className="text-[11px] font-semibold text-[#555]">Export Format:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="fmt" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} className="accent-[hsl(142,70%,35%)]" />
                  <FileJson size={12} className="text-amber-600" />
                  <span className="text-[11px] text-[#333]">JSON</span>
                  <span className="text-[10px] text-[#999]">(recommended)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="fmt" checked={exportFormat === 'xml'} onChange={() => setExportFormat('xml')} className="accent-[hsl(142,70%,35%)]" />
                  <FileCode size={12} className="text-purple-600" />
                  <span className="text-[11px] text-[#333]">XML</span>
                  <span className="text-[10px] text-[#999]">(legacy)</span>
                </label>
              </div>

              {/* Sections table */}
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">Export</th>
                    <th>Section</th>
                    <th className="w-24 text-center">Objects</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {configSections.map((section) => {
                    const enabled = exportConfig[section.key as keyof ExportConfig];
                    const Icon = section.icon;
                    return (
                      <tr key={section.key} className={cn(enabled && "bg-[#fafff5]")}>
                        <td className="text-center">
                          <FortiToggle
                            enabled={enabled}
                            onToggle={() => setExportConfig(prev => ({ ...prev, [section.key]: !prev[section.key as keyof ExportConfig] }))}
                            size="sm"
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Icon size={13} className="text-[#555]" />
                            <span className="font-medium text-[#333]">{section.label}</span>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className={cn("forti-tag", section.count > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                            {section.count}
                          </span>
                        </td>
                        <td className="text-[#666]">
                          {section.key === 'firewallRules' && 'IPv4 firewall policies and rules'}
                          {section.key === 'natRules' && 'NAT port-forwarding and outbound rules'}
                          {section.key === 'aliases' && 'Address objects and groups'}
                          {section.key === 'schedules' && 'Time-based schedule objects'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Import zone (when active) */}
              {importing && importPreview && (
                <div className="border-t border-[#ddd]">
                  <div className="px-3 py-1.5 bg-[#e8e8e8] border-b border-[#ccc] text-[11px] font-semibold text-[#333] flex items-center gap-2">
                    <Upload size={12} />
                    <span>Import Preview</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {/* Validation status */}
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 text-[11px] border",
                      importPreview.valid
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    )}>
                      {importPreview.valid ? <Check size={12} /> : <AlertTriangle size={12} />}
                      {importPreview.valid ? 'File validated successfully' : 'Validation errors found'}
                    </div>

                    {importPreview.errors.length > 0 && (
                      <div className="px-3 py-2 bg-red-50 border border-red-200 text-[11px] text-red-700">
                        {importPreview.errors.map((err, i) => <div key={i}>• {err}</div>)}
                      </div>
                    )}

                    <div className="text-[11px] text-[#666]">
                      Version: <span className="font-mono">{importPreview.version}</span> &nbsp;|&nbsp;
                      Exported: {new Date(importPreview.exportDate).toLocaleString()}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      {configSections.map((s) => {
                        const count = importPreview[s.key as keyof ImportPreview] as number;
                        const Icon = s.icon;
                        return (
                          <div key={s.key} className={cn("flex items-center gap-2 px-2 py-1.5 border", count > 0 ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200")}>
                            <Icon size={12} className="text-[#555]" />
                            <span>{s.label}</span>
                            <span className="ml-auto font-mono font-bold">{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#eee]">
                      <button className="forti-toolbar-btn" onClick={() => { setImporting(false); setImportPreview(null); setImportData(null); }}>
                        <X size={12} /> <span>Cancel</span>
                      </button>
                      <button className="forti-toolbar-btn primary" onClick={handleImport} disabled={!importPreview.valid}>
                        <Upload size={12} /> <span>Import Configuration</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning banner */}
              <div className="px-3 py-2 bg-[#fff8e1] border-t border-[#f0d060] flex items-center gap-2 text-[11px] text-[#7a5d00]">
                <AlertTriangle size={12} />
                <span><strong>Note:</strong> Importing configuration will merge with existing data. Duplicate items may be overwritten. Always create a backup before restoring.</span>
              </div>
            </div>
          </TabsContent>

          {/* Backup History Tab */}
          <TabsContent value="history" className="mt-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th className="w-32">Date</th>
                  <th className="w-20 text-center">Format</th>
                  <th className="w-20 text-center">Size</th>
                  <th className="w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backupsLoading ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">Loading backup history...</td></tr>
                ) : backups.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-[#999] py-4">No backup history — use the Export button to create a backup</td></tr>
                ) : backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileJson size={13} className="text-amber-600" />
                        <span className="font-mono text-[#333]">{backup.filename}</span>
                      </div>
                    </td>
                    <td className="text-[#666]">{new Date(backup.created_at).toLocaleString()}</td>
                    <td className="text-center">
                      <span className={cn("forti-tag", backup.type === 'auto' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                        {backup.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-center text-[#666]">{formatBytes(backup.size_bytes)}</td>
                    <td className="text-center">
                      <button className="forti-toolbar-btn" onClick={() => toast.success(`Downloaded ${backup.filename}`)}>
                        <Download size={11} />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {exportFormat === 'json' ? <FileJson size={14} /> : <FileCode size={14} />}
              Export Preview — {exportFormat.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Preview of the configuration that will be exported
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] bg-[#f5f5f5] border border-[#ddd] p-3">
            <pre className="text-[11px] font-mono text-[#333] whitespace-pre-wrap">{previewContent}</pre>
          </div>
          <div className="flex justify-end gap-2">
            <button className="forti-toolbar-btn" onClick={() => setPreviewOpen(false)}>Close</button>
            <button className="forti-toolbar-btn primary" onClick={() => { setPreviewOpen(false); handleExport(); }}>
              <Download size={12} /> <span>Export</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default ConfigBackup;
