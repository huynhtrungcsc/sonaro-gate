// Export/Import utility functions for configuration data

export const exportToJSON = <T>(data: T[], filename: string) => {
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    type: filename.replace('.json', ''),
    count: data.length,
    data: data,
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToCSV = <T extends Record<string, any>>(data: T[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importFromJSON = <T>(
  file: File,
  onSuccess: (data: T[]) => void,
  onError: (error: string) => void
) => {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      
      if (parsed.data && Array.isArray(parsed.data)) {
        onSuccess(parsed.data);
      } else if (Array.isArray(parsed)) {
        onSuccess(parsed);
      } else {
        onError('Invalid file format: expected an array or object with data property');
      }
    } catch (err) {
      onError('Failed to parse JSON file');
    }
  };
  
  reader.onerror = () => {
    onError('Failed to read file');
  };
  
  reader.readAsText(file);
};

export const createFileInput = (
  accept: string,
  onChange: (file: File) => void
) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) onChange(file);
  };
  input.click();
};
