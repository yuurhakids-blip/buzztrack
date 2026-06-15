import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Cpu, AlertTriangle, Info, RefreshCw, Power, PowerOff } from 'lucide-react';

interface AlertData {
  severity: 'high' | 'medium' | 'low';
  alerts: Array<{ id: string; message: string; details: any[] }>;
  summary: string[];
  stats: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalAccounts: number;
    highBotAccounts: number;
    avgBotScore: number;
    totalPosts: number;
  };
  timestamp: number;
}

interface Props {
  onNavigate?: () => void;
  showNotification?: (type: 'success' | 'error' | 'warning', text: string) => void;
}

const severityConfig = {
  high: { color: 'border-red-500/40 bg-red-500/10 text-red-400', icon: AlertTriangle },
  medium: { color: 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]', icon: ShieldAlert },
  low: { color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400', icon: Info },
};

export default function DeepCognitionAlert({ onNavigate, showNotification }: Props) {
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(() => localStorage.getItem('deep-cognition-enabled') !== 'false');
  const prevSeverity = useRef<string | null>(null);
  const scrapingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('deep-cognition-enabled', String(enabled));
  }, [enabled]);

  const fetchAlerts = async () => {
    if (!enabled) { setLoading(false); return; }
    try {
      const resp = await fetch('/api/deep-cognition');
      const result = await resp.json();
      setData(result);

      // Auto-scrape if no posts
      if (result.stats.totalPosts === 0 && !scrapingRef.current) {
        scrapingRef.current = true;
        try {
          const scrapeResp = await fetch('/api/social/scrape-trending', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          if (scrapeResp.ok) {
            const retryResp = await fetch('/api/deep-cognition');
            const retryResult = await retryResp.json();
            setData(retryResult);
            if (retryResult.stats.totalPosts > 0) {
              showNotification?.('success', 'Deep Cognition: Data berhasil di-scrape secara otomatis.');
            }
          }
        } catch { /* silent */ } finally { scrapingRef.current = false; }
      }

      // Escalation toast
      if (result.severity === 'high' && prevSeverity.current && prevSeverity.current !== 'high') {
        showNotification?.('warning', '⚠️ Deep Cognition: Severitas KRITIS — periksa Log Peringatan!');
      }
      prevSeverity.current = result.severity;

      window.dispatchEvent(new CustomEvent('alert-count-changed', {
        detail: enabled ? { count: result.alerts?.length || 0, severity: result.severity } : { count: 0, severity: 'low' },
      }));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [enabled]);

  const toggle = () => setEnabled(prev => !prev);

  const handleClick = () => {
    if (onNavigate && data && data.alerts.length > 0) onNavigate();
  };

  if (!enabled) {
    return (
      <div className="p-4 rounded border border-slate-800 bg-slate-900/40 text-slate-600 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between mb-1">
          <strong className="text-xs flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-500" /> Deep Cognition
          </strong>
          <button onClick={toggle} className="hover:text-slate-300 transition" title="Aktifkan">
            <PowerOff className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>
        <p className="text-slate-600">Nonaktif. <button onClick={toggle} className="underline hover:text-slate-400">Aktifkan</button></p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 rounded border border-slate-800 bg-slate-900/40 text-slate-600 text-[11px] leading-relaxed">
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full" />
          Memindai aktivitas jaringan...
        </div>
      </div>
    );
  }

  if (!data || data.alerts.length === 0) {
    return (
      <div className="p-4 rounded border border-slate-800 bg-slate-900/40 text-slate-600 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <strong className="block mb-1 text-xs flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Status Jaringan
          </strong>
          <button onClick={toggle} className="hover:text-slate-400 transition" title="Nonaktifkan">
            <Power className="w-3 h-3 text-slate-500" />
          </button>
        </div>
        Tidak ada anomali terdeteksi. Sistem dalam kondisi normal.
        {data && (
          <div className="mt-2 pt-2 border-t border-slate-800 text-[9px] text-slate-600 font-mono">
            {data.stats.totalPosts} posting · {data.stats.totalCampaigns} kampanye · Bot Ø {data.stats.avgBotScore}%
          </div>
        )}
      </div>
    );
  }

  const sev = severityConfig[data.severity];
  const Icon = sev.icon;

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-4 rounded border ${sev.color} leading-relaxed relative overflow-hidden transition hover:brightness-110 cursor-pointer`}
      title="Klik untuk detail peringatan"
    >
      <div className="absolute right-1 bottom-1 opacity-10">
        <Cpu className="w-16 h-16" />
      </div>
      <div className="flex items-start justify-between mb-1">
        <strong className="font-bold text-xs flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" /> Deep Cognition Alert
          {data.severity === 'high' && <span className="text-[8px] bg-red-500/20 px-1.5 py-0.5 rounded font-mono">KRITIS</span>}
        </strong>
        <button onClick={(e) => { e.stopPropagation(); toggle(); }} className="hover:opacity-70 transition shrink-0" title="Nonaktifkan">
          <Power className="w-3 h-3" />
        </button>
      </div>
      <ul className="space-y-1">
        {data.summary.slice(0, 3).map((msg, i) => (
          <li key={i} className="text-[11px] leading-relaxed flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0">•</span>
            <span>{msg}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-current/10 text-[9px] opacity-70 font-mono flex items-center justify-between">
        <span>{data.stats.totalPosts} posting · {data.stats.activeCampaigns} aktif · Bot ≥70: {data.stats.highBotAccounts}</span>
        <span className="hover:opacity-80 transition text-[10px]" onClick={(e) => { e.stopPropagation(); fetchAlerts(); }} title="Refresh">
          <RefreshCw className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}
