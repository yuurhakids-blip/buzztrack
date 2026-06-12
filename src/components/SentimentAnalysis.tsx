import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  Activity, 
  Tag, 
  MessageSquare, 
  Loader2, 
  ThumbsUp, 
  ThumbsDown, 
  Minus 
} from 'lucide-react';
import { AIService, AIConfig } from '../infrastructure/services/AIService';
import { api } from '../api';

interface SentimentAnalysisProps {
  showNotification: (type: 'success' | 'error', text: string) => void;
  aiConfig: AIConfig;
}

export default function SentimentAnalysis({ showNotification, aiConfig }: SentimentAnalysisProps) {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ 
    sentiment: 'Positif' | 'Negatif' | 'Netral';
    score: number;
    summary: string;
    keywords: string[];
    mode: 'AI' | 'Heuristic';
  } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);

  const fetchPostsAndAnalyze = async () => {
    if (!topic.trim()) {
      showNotification('error', 'Masukkan topik terlebih dahulu!');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let allPosts: any[] = [];

      // Pertama, coba ambil postingan dari scrapedPosts via API
      try {
        const existingPosts = await api.social.posts.list();
        allPosts = existingPosts.filter((p: any) => 
          (p.text || '').toLowerCase().includes(topic.toLowerCase())
        );
      } catch {
        allPosts = [];
      }

      // Jika tidak ada postingan, lakukan pencarian otomatis
      if (allPosts.length === 0) {
        try {
          const searchResult = await api.social.search(topic);
          if (searchResult.success) {
            const newPosts = await api.social.posts.list();
            allPosts = newPosts.filter((p: any) => 
              (p.text || '').toLowerCase().includes(topic.toLowerCase())
            );
          }
        } catch {
          // Jika pencarian gagal, gunakan fallback
        }
      }

      setPosts(allPosts);

      const sentimentResult = await AIService.analyzeSentiment(topic, allPosts, aiConfig);
      setResult(sentimentResult);
      showNotification('success', 'Analisis sentimen selesai!');
    } catch (err) {
      showNotification('error', 'Gagal melakukan analisis sentimen');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = () => {
    if (!result) return <Minus className="w-6 h-6 text-gray-500" />;
    switch (result.sentiment) {
      case 'Positif': return <ThumbsUp className="w-6 h-6 text-emerald-500" />;
      case 'Negatif': return <ThumbsDown className="w-6 h-6 text-red-500" />;
      default: return <Minus className="w-6 h-6 text-gray-500" />;
    }
  };

  const getSentimentColor = () => {
    if (!result) return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    switch (result.sentiment) {
      case 'Positif': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      case 'Negatif': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getScoreColor = () => {
    if (!result) return 'from-gray-400 to-gray-600';
    const score = result.score;
    if (score >= 70) return 'from-emerald-500 to-emerald-700';
    if (score <= 30) return 'from-red-500 to-red-700';
    return 'from-amber-500 to-amber-700';
  };

  return (
    <div className="space-y-8 animate-fade-in text-left pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#D4AF37]" />
            Analisis Sentimen Umum
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analisis sentimen secara akurat untuk topik tertentu dengan dukungan AI dan fallback heuristic.
          </p>
        </div>
      </div>

      {/* Form Input Topik */}
      <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-400 block mb-2">
              Topik Analisis
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Masukkan topik, misal: Pemilu 2024, Teknologi AI, dll."
              className="w-full bg-[#0F0F12] border border-[#2A2A2E] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#D4AF37]/50 transition"
              onKeyDown={(e) => e.key === 'Enter' && fetchPostsAndAnalyze()}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchPostsAndAnalyze}
              disabled={loading}
              className="bg-gradient-to-r from-[#D4AF37] to-[#8A6D3B] text-black font-bold px-6 py-3 rounded-xl hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Menganalisis...' : 'Analisis Sentimen'}
            </button>
          </div>
        </div>
      </div>

      {/* Hasil Analisis */}
      {result && (
        <>
          {/* Kartu Utama Sentimen */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {getSentimentIcon()}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Hasil Sentimen</h3>
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${getSentimentColor()}`}>
                      {result.sentiment}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full">
                  MODE: {result.mode}
                </span>
              </div>

              {/* Skor Sentimen */}
              <div className="mb-6">
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>Skor Sentimen</span>
                  <span className="text-[#D4AF37] font-bold">{result.score}/100</span>
                </div>
                <div className="w-full bg-[#0F0F12] h-4 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${getScoreColor()} transition-all duration-500`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              {/* Ringkasan */}
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                  Ringkasan Analisis
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {result.summary}
                </p>
              </div>
            </div>

            {/* Kartu Kata Kunci & Data */}
            <div className="space-y-6">
              {/* Kata Kunci */}
              <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#D4AF37]" />
                  Kata Kunci Penting
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-3 py-1 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full font-mono"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Jumlah Postingan */}
              <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
                  Data Postingan
                </h3>
                <div className="text-center">
                  <span className="text-3xl font-serif text-[#D4AF37] font-bold">
                    {posts.length}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    postingan dianalisis
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Daftar Postingan (opsional) */}
          {posts.length > 0 && (
            <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
                Contoh Postingan Terkait ({Math.min(posts.length, 5)})
              </h3>
              <div className="space-y-3">
                {posts.slice(0, 5).map((post, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono text-slate-400">{post.platform}</span>
                      <span className="text-[10px] font-mono text-amber-500">@{post.authorUsername}</span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-3">{post.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
