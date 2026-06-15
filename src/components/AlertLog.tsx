import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, AlertTriangle, Info, RefreshCw, X, ExternalLink, Users, MessageSquare, Radio } from 'lucide-react';

interface AlertDetail {
  id: string;
  message: string;
  details: any[];
  posts: Array<{
    text: string;
    platform: string;
    author: string;
    likes: number;
    comments: number;
    shares: number;
    url: string;
    publishedAt: string;
  }>;
}

interface AlertItem {
  id: string;
  timestamp: number;
  severity: 'high' | 'medium' | 'low';
  alert: AlertDetail;
  stats: {
    totalCampaigns: number;
    activeCampaigns: number;
    highBotAccounts: number;
    avgBotScore: number;
  };
}

const sevBadge = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const sevIcon = {
  high: AlertTriangle,
  medium: ShieldAlert,
  low: Info,
};

const detailIcons: Record<string, React.ElementType> = {
  'high-bot': Users,
  'active-campaigns': Radio,
  'copypasta': MessageSquare,
  'avg-bot-score': Users,
  'platform-imbalance': ShieldAlert,
};

function DetailModal({ item, onClose }: { item: AlertItem; onClose: () => void }) {
  const Icon = detailIcons[item.alert.id] || ShieldAlert;
  const time = new Date(item.timestamp).toLocaleString('id-ID');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#15151A] border border-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-slate-100">Detail Peringatan</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${sevBadge[item.severity]}`}>
              {item.severity.toUpperCase()}
            </span>
            <span className="ml-2 text-[10px] font-mono text-slate-500">{time}</span>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">{item.alert.message}</p>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 font-mono mb-3">Data Terkait</h4>

            {item.alert.id === 'high-bot' && (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="py-2 pr-3 font-semibold">Username</th>
                    <th className="py-2 pr-3 font-semibold">Bot Score</th>
                    <th className="py-2 pr-3 font-semibold">Platform</th>
                    <th className="py-2 font-semibold">Followers</th>
                  </tr>
                </thead>
                <tbody>
                  {item.alert.details.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/50 text-slate-300">
                      <td className="py-2 pr-3 font-mono text-[11px]">@{d.username || 'unknown'}</td>
                      <td className="py-2 pr-3 font-mono text-red-400">{d.botScore}%</td>
                      <td className="py-2 pr-3 text-[11px]">{d.platform || '-'}</td>
                      <td className="py-2 font-mono">{(d.followers || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {item.alert.id === 'active-campaigns' && (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="py-2 pr-3 font-semibold">Kampanye</th>
                    <th className="py-2 pr-3 font-semibold">Buzzer</th>
                    <th className="py-2 pr-3 font-semibold">Platform</th>
                    <th className="py-2 font-semibold">Reach</th>
                  </tr>
                </thead>
                <tbody>
                  {item.alert.details.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/50 text-slate-300">
                      <td className="py-2 pr-3 text-[11px] max-w-[200px] truncate">{d.title}</td>
                      <td className="py-2 pr-3 font-mono">{d.buzzerCount}</td>
                      <td className="py-2 pr-3 text-[11px]">{d.platform || '-'}</td>
                      <td className="py-2 font-mono">{(d.reach || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {item.alert.id === 'copypasta' && (
              <div className="space-y-3">
                {item.alert.details.map((d: any, i: number) => (
                  <div key={i} className="bg-[#0F0F12] border border-slate-800 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-mono text-red-400 font-bold">{d.count}x</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-mono break-words">{d.text}</p>
                  </div>
                ))}
              </div>
            )}

            {item.alert.id === 'avg-bot-score' && (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="py-2 pr-3 font-semibold">Username</th>
                    <th className="py-2 pr-3 font-semibold">Bot Score</th>
                    <th className="py-2 font-semibold">Platform</th>
                  </tr>
                </thead>
                <tbody>
                  {item.alert.details.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/50 text-slate-300">
                      <td className="py-2 pr-3 font-mono text-[11px]">@{d.username || 'unknown'}</td>
                      <td className="py-2 pr-3 font-mono text-amber-400">{d.botScore}%</td>
                      <td className="py-2 text-[11px]">{d.platform || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {item.alert.id === 'platform-imbalance' && (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="py-2 pr-3 font-semibold">Platform</th>
                    <th className="py-2 font-semibold">Postingan</th>
                  </tr>
                </thead>
                <tbody>
                  {item.alert.details.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/50 text-slate-300">
                      <td className="py-2 pr-3 text-[11px]">{d.platform || d.platformName || '-'}</td>
                      <td className="py-2 font-mono">{d.postCount || d.count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!['high-bot', 'active-campaigns', 'copypasta', 'avg-bot-score', 'platform-imbalance'].includes(item.alert.id) && (
              <p className="text-xs text-slate-500 italic">Data detail tidak tersedia untuk peringatan ini.</p>
            )}
          </div>

          {/* Posts Section — grouped by platform */}
          {item.alert.posts && item.alert.posts.length > 0 && (
            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 font-mono mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Postingan Terkait ({item.alert.posts.length})
              </h4>
              {(() => {
                const grouped: Record<string, any[]> = {};
                item.alert.posts.forEach((p: any) => {
                  const key = p.platform || 'Lainnya';
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(p);
                });
                return Object.entries(grouped).map(([platform, plPosts]) => (
                  <div key={platform} className="mb-4 last:mb-0">
                    <h5 className={`text-[11px] font-bold mb-2 flex items-center gap-1.5 ${
                      platform === 'X' ? 'text-zinc-400' : platform === 'YouTube' ? 'text-red-400' : platform === 'TikTok' ? 'text-cyan-400' : 'text-slate-400'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {platform} ({plPosts.length})
                    </h5>
                    <div className="space-y-2">
                      {plPosts.map((p: any, i: number) => (
                        <div key={i} className="bg-[#0F0F12] border border-slate-800/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span>@{p.author || 'unknown'}</span>
                              {p.publishedAt && <span>{new Date(p.publishedAt).toLocaleDateString('id-ID')}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-slate-600 font-mono">
                              <span>Likes {p.likes}</span>
                              <span>Komen {p.comments}</span>
                              <span>Share {p.shares}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed break-words">{p.text}</p>
                          {p.url && p.url !== '#' && (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[9px] text-slate-600 hover:text-slate-400 transition">
                              <ExternalLink className="w-3 h-3" /> Buka
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertLog() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const lastAlertIds = useRef<Set<string>>(new Set());

  const fetchAlerts = async () => {
    try {
      const resp = await fetch('/api/deep-cognition');
      const data = await resp.json();
      if (data.alerts && data.alerts.length > 0) {
        const batchId = `${data.timestamp}`;
        const newItems: AlertItem[] = data.alerts.map((a: any) => ({
          id: `${batchId}-${a.id}`,
          timestamp: data.timestamp,
          severity: data.severity,
          alert: { id: a.id, message: a.message, details: a.details || [], posts: a.posts || [] },
          stats: data.stats,
        }));
        // Only add if any of these alert messages haven't been seen before
        const currentMsgs = new Set(newItems.map(i => i.alert.id + i.alert.message));
        const hasNew = [...currentMsgs].some(msg => !lastAlertIds.current.has(msg));
        if (hasNew) {
          setItems(prev => {
            const merged = [...newItems, ...prev];
            const unique = merged.filter((v, idx, self) => idx === self.findIndex(t => t.id === v.id));
            return unique.slice(0, 200);
          });
          // Update seen messages
          currentMsgs.forEach(msg => lastAlertIds.current.add(msg));
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Log Peringatan
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Riwayat deteksi anomali dan aktivitas mencurigakan — diperbarui otomatis tiap 30 detik. Klik baris untuk detail.
          </p>
        </div>
        <button onClick={fetchAlerts} className="text-slate-500 hover:text-slate-300 transition p-2" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center bg-[#15151A] rounded-xl border border-[#2A2A2E] text-slate-500">
          <ShieldAlert className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs">Belum ada peringatan. Sistem dalam kondisi normal.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                <th className="py-3 pr-4 font-semibold">Waktu</th>
                <th className="py-3 pr-4 font-semibold">Severity</th>
                <th className="py-3 pr-4 font-semibold">Pesan</th>
                <th className="py-3 pr-4 font-semibold">Kampanye</th>
                <th className="py-3 pr-4 font-semibold">Aktif</th>
                <th className="py-3 pr-4 font-semibold">Bot ≥70</th>
                <th className="py-3 font-semibold">Bot Ø</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => {
                const Icon = sevIcon[a.severity];
                const time = new Date(a.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-900/30 transition cursor-pointer"
                  >
                    <td className="py-3 pr-4 font-mono text-slate-400 text-[10px] whitespace-nowrap">{time}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border ${sevBadge[a.severity]}`}>
                        <Icon className="w-3 h-3" />
                        {a.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[11px] max-w-md truncate">{a.alert.message}</td>
                    <td className="py-3 pr-4 font-mono text-[11px]">{a.stats.totalCampaigns}</td>
                    <td className="py-3 pr-4 font-mono text-[11px]">{a.stats.activeCampaigns}</td>
                    <td className="py-3 pr-4 font-mono text-[11px]">{a.stats.highBotAccounts}</td>
                    <td className="py-3 font-mono text-[11px]">{a.stats.avgBotScore}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
