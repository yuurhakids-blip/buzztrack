import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  Search,
  Activity,
  MessageSquare,
  TrendingUp,
  Filter,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Minus,
  Clock,
  Users,
  Hash,
  Share2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink
} from 'lucide-react';
import { AIService } from '../infrastructure/services/AIService';
import { api } from '../api';

interface SentimentData {
  sentiment: 'Positif' | 'Negatif' | 'Netral';
  score: number;
  summary: string;
  keywords: string[];
  mode: 'AI' | 'Heuristic';
}

interface PostData {
  id: string;
  text: string;
  authorUsername: string;
  platform: string;
  date: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagementRate: number;
  postUrl: string;
  sentiment: 'Positif' | 'Negatif' | 'Netral';
  sentimentScore: number;
}

const COLORS = ['#D4AF37', '#8A6D3B', '#4A4A6A'];

const POSITIVE_WORDS = ['bagus', 'hebat', 'sukses', 'menyenangkan', 'terbaik', 'luar biasa', 'cinta', 'bangga', 'positif', 'baik', 'senang', 'dukung', 'keren', 'salut', 'maju', 'cerdas', 'indah', 'bermanfaat', 'berhasil', 'inovatif', 'transparan', 'adil', 'bersih', 'pintar'];
const NEGATIVE_WORDS = ['buruk', 'jelek', 'gagal', 'menyedihkan', 'terburuk', 'mengecewakan', 'benci', 'kecewa', 'negatif', 'penipuan', 'hoax', 'jahat', 'bohong', 'tolak', 'korupsi', 'rusak', 'salah', 'curang', 'bodoh', 'parah', 'ancam', 'krisis', 'darurat', 'provokasi'];

function analyzePostSentiment(text: string): { sentiment: 'Positif' | 'Negatif' | 'Netral'; score: number } {
  const lower = text.toLowerCase();
  let posCount = 0;
  let negCount = 0;

  POSITIVE_WORDS.forEach(word => {
    const regex = new RegExp(word.replace(/\s+/g, '\\s+'), 'gi');
    posCount += (lower.match(regex) || []).length;
  });
  NEGATIVE_WORDS.forEach(word => {
    const regex = new RegExp(word.replace(/\s+/g, '\\s+'), 'gi');
    negCount += (lower.match(regex) || []).length;
  });

  const total = posCount + negCount;
  if (total === 0) return { sentiment: 'Netral', score: 50 };

  if (posCount > negCount) {
    const score = Math.round(50 + (posCount / total) * 50);
    return { sentiment: 'Positif', score };
  } else if (negCount > posCount) {
    const score = Math.round(50 - (negCount / total) * 50);
    return { sentiment: 'Negatif', score };
  }
  return { sentiment: 'Netral', score: 50 };
}

export default function SentimentAnalysis({
  showNotification,
  aiConfig
}: {
  showNotification: (type: 'success' | 'error', text: string) => void;
  aiConfig: { provider: string; model: string; apiKey: string };
}) {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');

  const handleAnalyze = async () => {
    if (!topic.trim()) {
      showNotification('error', 'Masukkan topik terlebih dahulu!');
      return;
    }

    setLoading(true);
    try {
      let scrapedPosts: PostData[] = [];

      try {
        await api.social.search(topic.trim());
      } catch { /* search may fail silently */ }

      try {
        const postsData = await api.social.posts.list();
        scrapedPosts = postsData
          .filter(p => p.text.toLowerCase().includes(topic.toLowerCase()))
          .map(p => {
            const { sentiment, score } = analyzePostSentiment(p.text);
            return {
              id: p.id,
              text: p.text,
              authorUsername: p.authorUsername,
              platform: p.platform,
              date: p.publishedAt.split('T')[0],
              likes: p.likes,
              comments: p.comments,
              shares: p.shares,
              reach: p.reach,
              engagementRate: p.engagementRate,
              postUrl: p.postUrl,
              sentiment,
              sentimentScore: score
            };
          });
      } catch { /* fallback to empty */ }

      if (scrapedPosts.length === 0) {
        try {
          const postsData = await api.social.posts.list();
          scrapedPosts = postsData.map(p => {
            const { sentiment, score } = analyzePostSentiment(p.text);
            return {
              id: p.id,
              text: p.text,
              authorUsername: p.authorUsername,
              platform: p.platform,
              date: p.publishedAt.split('T')[0],
              likes: p.likes,
              comments: p.comments,
              shares: p.shares,
              reach: p.reach,
              engagementRate: p.engagementRate,
              postUrl: p.postUrl,
              sentiment,
              sentimentScore: score
            };
          });
        } catch { /* no data at all */ }
      }

      if (scrapedPosts.length === 0) {
        showNotification('error', 'Belum ada data postingan. Jalankan pencarian di tab Analitik Sosial terlebih dahulu.');
        setLoading(false);
        return;
      }

      setPosts(scrapedPosts);

      const batchResult = await AIService.analyzePostSentimentsBatch(
        scrapedPosts.map(p => ({ id: p.id, text: p.text })),
        aiConfig as any
      );

      if (batchResult.postSentiments.length > 0) {
        const sentimentMap = new Map(batchResult.postSentiments.map(s => [s.postId, s]));
        scrapedPosts = scrapedPosts.map(p => {
          const match = sentimentMap.get(p.id);
          if (match) {
            return { ...p, sentiment: match.sentiment, sentimentScore: match.score };
          }
          return p;
        });
        setPosts(scrapedPosts);
      }

      const positif = scrapedPosts.filter(p => p.sentiment === 'Positif').length;
      const negatif = scrapedPosts.filter(p => p.sentiment === 'Negatif').length;
      const netral = scrapedPosts.filter(p => p.sentiment === 'Netral').length;
      const total = scrapedPosts.length;
      let dominantSentiment: 'Positif' | 'Negatif' | 'Netral' = 'Netral';
      let dominantScore = 50;
      if (positif > negatif && positif > netral) {
        dominantSentiment = 'Positif';
        dominantScore = total > 0 ? Math.round((positif / total) * 100) : 50;
      } else if (negatif > positif && negatif > netral) {
        dominantSentiment = 'Negatif';
        dominantScore = total > 0 ? Math.round((negatif / total) * 100) : 50;
      } else {
        dominantSentiment = 'Netral';
        dominantScore = total > 0 ? Math.round((netral / total) * 100) : 50;
      }
      const keywords = scrapedPosts
        .flatMap(p => p.text.match(/#\w+/g) || [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5);
      const summary = `[MODE ${batchResult.mode}] Dari ${total} postingan yang dianalisis, sentimen ${dominantSentiment.toLowerCase()} mendominasi (${dominantScore}% dari total). ${positif} positif, ${negatif} negatif, ${netral} netral.`;
      setSentimentData({ sentiment: dominantSentiment, score: dominantScore, summary, keywords, mode: batchResult.mode });

      showNotification('success', `Analisis sentimen selesai! ${scrapedPosts.length} postingan dianalisis.`);
    } catch (err) {
      showNotification('error', 'Gagal melakukan analisis');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentStats = () => {
    const filtered = posts.filter(p => selectedPlatform === 'All' || p.platform === selectedPlatform);
    const positif = filtered.filter(p => p.sentiment === 'Positif').length;
    const negatif = filtered.filter(p => p.sentiment === 'Negatif').length;
    const netral = filtered.filter(p => p.sentiment === 'Netral').length;
    return [
      { name: 'Positif', value: positif, color: '#10B981' },
      { name: 'Negatif', value: negatif, color: '#EF4444' },
      { name: 'Netral', value: netral, color: '#6366F1' }
    ];
  };

  const getPlatformStats = () => {
    const platforms = ['X', 'TikTok', 'YouTube'];
    return platforms.map(p => {
      const pPosts = posts.filter(post => post.platform === p);
      const avgSentiment = pPosts.length > 0
        ? pPosts.reduce((sum, p) => sum + p.sentimentScore, 0) / pPosts.length
        : 0;
      return {
        name: p,
        posts: pPosts.length,
        avgSentiment: Math.round(avgSentiment)
      };
    });
  };

  const getTrendData = () => {
    const dateMap = new Map();
    posts.forEach(post => {
      if (!dateMap.has(post.date)) {
        dateMap.set(post.date, { positif: 0, negatif: 0, netral: 0 });
      }
      const dayData = dateMap.get(post.date);
      if (post.sentiment === 'Positif') dayData.positif++;
      else if (post.sentiment === 'Negatif') dayData.negatif++;
      else dayData.netral++;
    });

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const filteredPosts = posts.filter(p => selectedPlatform === 'All' || p.platform === selectedPlatform);
  const sentimentStats = getSentimentStats();
  const platformStats = getPlatformStats();
  const trendData = getTrendData();

  const totalPosts = posts.length;
  const avgEngagement = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.likes + p.comments + p.shares, 0) / posts.length)
    : 0;
  const totalReach = posts.reduce((sum, p) => sum + p.likes * 10 + p.comments * 5 + p.shares * 20, 0);

  return (
    <div className="space-y-6 animate-fade-in text-left pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#D4AF37]" />
            Analisis Sentimen Umum
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analisis sentimen secara akurat menggunakan AI dengan fallback heuristic
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sentimentData && (
            <span className={`text-[10px] font-mono px-3 py-1.5 rounded-full ${
              sentimentData.mode === 'AI'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              Mode: {sentimentData.mode}
            </span>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[#66666E] font-semibold block mb-2">
              Topik Analisis
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Masukkan topik (misal: Pemilu 2024, Teknologi AI, dll.)"
                className="w-full bg-[#0F0F12] border border-[#2A2A2E] rounded-xl px-12 py-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#D4AF37]/50 transition"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:w-64">
            <label className="text-[10px] font-mono uppercase tracking-widest text-[#66666E] font-semibold block mb-2">
              Filter Platform
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full bg-[#0F0F12] border border-[#2A2A2E] rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-[#D4AF37]/50 transition"
            >
              <option value="All">Semua Platform</option>
              <option value="X">X</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-gradient-to-r from-[#D4AF37] to-[#8A6D3B] text-black font-bold px-6 py-4 rounded-xl hover:brightness-110 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Menganalisis...' : 'Analisis Sentimen'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {sentimentData && posts.length > 0 && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                  Postingan
                </span>
              </div>
              <div className="text-3xl font-serif text-[#D4AF37] font-bold mb-1">
                {totalPosts.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                postingan dianalisis
              </p>
            </div>

            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                  Sentimen Dominan
                </span>
              </div>
              <div className={`text-3xl font-serif font-bold mb-1 ${
                sentimentData.sentiment === 'Positif' ? 'text-emerald-400' :
                sentimentData.sentiment === 'Negatif' ? 'text-red-400' :
                'text-violet-400'
              }`}>
                {sentimentData.sentiment}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sentimentData.sentiment === 'Positif' ? 'bg-emerald-500' :
                      sentimentData.sentiment === 'Negatif' ? 'bg-red-500' :
                      'bg-violet-500'
                    }`}
                    style={{ width: `${sentimentData.score}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400">{sentimentData.score}%</span>
              </div>
            </div>

            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                  Total Engagement
                </span>
              </div>
              <div className="text-3xl font-serif text-blue-400 font-bold mb-1">
                {avgEngagement.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                rata-rata per postingan
              </p>
            </div>

            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <Hash className="w-5 h-5 text-purple-400" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                  Estimasi Reach
                </span>
              </div>
              <div className="text-3xl font-serif text-purple-400 font-bold mb-1">
                {totalReach.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                potensi jangkauan
              </p>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#D4AF37]" />
              Ringkasan Analisis
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {sentimentData.summary}
            </p>
            {sentimentData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sentimentData.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full text-xs font-mono"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sentiment Distribution */}
            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#D4AF37]" />
                Distribusi Sentimen
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sentimentStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sentimentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#15151A', border: '1px solid #2A2A2E', borderRadius: '8px' }}
                    itemStyle={{ color: '#F5F5F5' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Platform Sentiment */}
            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4AF37]" />
                Sentimen per Platform
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={platformStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                  <XAxis dataKey="name" stroke="#66666E" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#66666E" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#15151A', border: '1px solid #2A2A2E', borderRadius: '8px' }}
                    itemStyle={{ color: '#F5F5F5' }}
                  />
                  <Bar dataKey="avgSentiment" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Over Time */}
          <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D4AF37]" />
              Tren Sentimen Waktu
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" />
                <XAxis dataKey="date" stroke="#66666E" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#66666E" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#15151A', border: '1px solid #2A2A2E', borderRadius: '8px' }}
                  itemStyle={{ color: '#F5F5F5' }}
                />
                <Legend />
                <Line type="monotone" dataKey="positif" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="negatif" stroke="#EF4444" strokeWidth={2} />
                <Line type="monotone" dataKey="netral" stroke="#6366F1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Posts List */}
          <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
                Postingan Terkait ({filteredPosts.length})
              </h3>
              <div className="text-[10px] font-mono text-slate-500">
                Menampilkan {Math.min(20, filteredPosts.length)} postingan teratas
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredPosts.slice(0, 20).map((post) => (
                <div
                  key={post.id}
                  className="p-4 bg-[#0F0F12] border border-[#2A2A2E] rounded-xl hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400">{post.platform}</span>
                      <span className="text-xs font-mono text-[#D4AF37]">@{post.authorUsername}</span>
                      <span className="text-[10px] font-mono text-slate-500">{post.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.postUrl && (
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-[#D4AF37] transition"
                          title="Buka sumber asli"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1 ${
                        post.sentiment === 'Positif' ? 'bg-emerald-500/10 text-emerald-400' :
                        post.sentiment === 'Negatif' ? 'bg-red-500/10 text-red-400' :
                        'bg-violet-500/10 text-violet-400'
                      }`}>
                        {post.sentiment === 'Positif' ? <ThumbsUp className="w-3 h-3" /> :
                         post.sentiment === 'Negatif' ? <ThumbsDown className="w-3 h-3" /> :
                         <Minus className="w-3 h-3" />}
                        {post.sentiment}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-3 leading-relaxed">{post.text}</p>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" /> {post.likes.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {post.comments.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> {post.shares.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
