import React from 'react';
import { TrendingUp, AlertTriangle, BrainCircuit, Users, MessageSquare, Share2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TrendDashboardProps {
  trendData: any;
  insight: string;
  insightMode: 'AI' | 'Heuristic' | null;
  isTrendLoading: boolean;
  onHashtagClick?: (tag: string) => void;
}

export default function TrendDashboard({ trendData, insight, insightMode, isTrendLoading, onHashtagClick }: TrendDashboardProps) {
  if (isTrendLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" />
        <span className="ml-3 text-slate-400 text-sm">Memuat tren harian...</span>
      </div>
    );
  }

  if (!trendData) {
    return (
      <div className="p-8 text-center bg-[#15151A] rounded-xl border border-[#2A2A2E] text-slate-500">
        <AlertTriangle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
        <p className="text-xs">Belum ada data tren untuk hari ini.</p>
      </div>
    );
  }

  const { platforms, totalPosts, dominantPlatform, overallSentiment, date, location } = trendData;
  const platformList = Object.entries(platforms || {}).map(([key, val]: any) => ({ name: key, ...val }));
  const chartData = platformList.map((p: any) => ({ name: p.name, posts: p.postCount, engagement: p.totalEngagement }));

  return (
    <div className="space-y-6" id="view-trend">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Tren Harian — {date || 'Hari Ini'}
            <span className="ml-1 text-[11px] font-mono bg-red-600/20 text-red-400 border border-red-600/30 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              🇮🇩 Indonesia
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Total {totalPosts || 0} postingan terpantau di Indonesia · Dominasi: {dominantPlatform} · Sentimen: {overallSentiment}
          </p>
        </div>
      </div>

      {/* AI Insight */}
      {insight && (
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              <BrainCircuit className="w-3.5 h-3.5" /> Insight Analitik AI
            </h5>
            {insightMode && (
              <span className={`text-[8px] px-2 py-0.5 rounded-full font-mono font-bold ${insightMode === 'AI' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {insightMode}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed italic">"{insight}"</p>
        </div>
      )}

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platformList.map((p: any) => {
          const platformColors: Record<string, { bg: string, text: string, border: string }> = {
            X: { bg: 'bg-zinc-900/60', text: 'text-zinc-300', border: 'border-zinc-700' },
            YouTube: { bg: 'bg-red-950/20', text: 'text-red-400', border: 'border-red-800/40' },
            TikTok: { bg: 'bg-cyan-950/20', text: 'text-cyan-400', border: 'border-cyan-800/40' }
          };
          const colors = platformColors[p.name] || platformColors.X;

          return (
            <div key={p.name} className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-sm font-bold ${colors.text}`}>{p.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded ${p.avgSentiment === 'Negative' ? 'bg-red-500/20 text-red-400' : p.avgSentiment === 'Positive' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {p.avgSentiment}
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex justify-between"><span>Postingan</span><span className="text-slate-200 font-bold">{p.postCount}</span></div>
                <div className="flex justify-between"><span>Engagement</span><span className="text-slate-200 font-bold">{p.totalEngagement?.toLocaleString()}</span></div>
              </div>
                {p.topHashtags?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-[9px] text-slate-500 uppercase">Top Hashtag</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.topHashtags.map((tag: string) => (
                        <span 
                          key={tag} 
                          className="text-[10px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded border border-slate-800 cursor-pointer hover:border-amber-500/50 hover:text-amber-400 transition"
                          onClick={() => onHashtagClick?.(tag)}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {p.topPosts?.length > 0 && (
                <div className="mt-2 text-[9px] text-slate-500 truncate" title={p.topPosts[0]?.text}>
                  Top: {p.topPosts[0]?.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#15151A] border border-[#2A2A2E] rounded-xl p-5">
          <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 font-mono mb-3">Perbandingan Platform</h5>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                <XAxis dataKey="name" stroke="#66666E" tick={{ fontSize: 12 }} />
                <YAxis stroke="#66666E" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1A1A1F', border: '1px solid #2A2A2E', borderRadius: '8px', color: '#E2E8F0' }} />
                <Bar dataKey="posts" name="Postingan" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="engagement" name="Engagement" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
