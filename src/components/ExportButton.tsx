import React, { useState } from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  tab: string;
  data: any[];
  filters?: any;
  filename?: string;
}

export default function ExportButton({ tab, data, filters, filename }: ExportButtonProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: 'csv') => {
    setExporting(type);
    try {
      const resp = await fetch('/api/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, data, filters }),
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${tab}-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Export error:', e);
    } finally {
      setExporting(null);
    }
  };

  return (
    <button
      onClick={() => handleExport('csv')}
      disabled={exporting !== null}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      {exporting === 'csv' ? 'Mengexport...' : 'CSV'}
    </button>
  );
}
