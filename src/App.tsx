import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Campaign, SuspiciousAccount, Platform, AnalysisResponse, NetworkNode, NetworkLink, SocialAccount, SocialPost, DailyEngagement, AudienceDemographics } from './core/domain/entities';
import { api } from './api';
import { AIService } from './infrastructure/services/AIService';
import { Settings as SettingsIcon, ShieldAlert, Search, Radio, Hash, UserX, BrainCircuit, AlertTriangle, PlusCircle, ExternalLink, Send, Users, LineChart, CornerDownRight, TrendingUp, CalendarDays, X as CloseIcon, CheckCircle, Clock, Fingerprint, Cpu, RefreshCw } from 'lucide-react';
const NetworkGraph = lazy(() => import('./components/NetworkGraph'));
const SocialAnalyticsDashboard = lazy(() => import('./components/SocialAnalyticsDashboard'));
const Settings = lazy(() => import('./settings/Settings'));
import DatePickerModal from './components/DatePickerModal';
import events from 'events';
events.defaultMaxListeners = 100;

const TrendDashboard = lazy(() => import('./components/TrendDashboard'));

export default function App() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'accounts' | 'graph' | 'analyzer' | 'reporter' | 'analytics' | 'settings' | 'tren'>('campaigns');
  const [trendData, setTrendData] = useState<any>(null);
  const [trendInsight, setTrendInsight] = useState<{ insight: string, mode: 'AI' | 'Heuristic' | null }>({ insight: '', mode: null });
  const [isTrendLoading, setIsTrendLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'tren' && !trendData) {
      fetchTrendData();
    }
  }, [activeTab]);

  const fetchTrendData = async (autoScrape: boolean = true) => {
    setIsTrendLoading(true);
    try {
      // Cek apakah sudah ada data
      const trendResp = await fetch('/api/trend/daily');
      let trendData = await trendResp.json();
      
      // Jika tidak ada data dan autoScrape aktif, lakukan scraping trending otomatis
      if (autoScrape && (!trendData || trendData.totalPosts === 0)) {
        // Lakukan scraping trending otomatis
        const searchResp = await fetch('/api/social/scrape-trending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (searchResp.ok) {
          const searchResult = await searchResp.json();
          setCampaigns(searchResult.campaigns || []);
          setAccounts(searchResult.accounts || []);
          // Ambil data tren lagi setelah pencarian
          const newTrendResp = await fetch('/api/trend/daily');
          trendData = await newTrendResp.json();
        }
      }
      
      setTrendData(trendData);
      setIsTrendLoading(false);
      
      // Fungsi heuristic fallback
      const generateHeuristicInsight = (data: any) => {
        if (!data) return "Belum ada data tren yang cukup untuk analisis.";
        const { platforms, totalPosts, dominantPlatform, overallSentiment } = data;
        const platformNames = Object.keys(platforms || {}).join(', ');
        return `Hari ini terpantau ${totalPosts || 0} postingan di ${platformNames || 'beberapa platform'}, dengan dominasi di ${dominantPlatform || 'platform utama'} dan sentimen keseluruhan ${overallSentiment || 'netral'}.`;
      };

      // Coba AI terlebih dahulu, jika gagal fallback ke heuristic
      try {
        const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
        const config = {
          provider,
          model: localStorage.getItem('selectedModel') || 'gemini-1.5-flash',
          apiKey: localStorage.getItem(`api-key-${provider}`) || ''
        };

        if (config.apiKey) {
          // Coba dapatkan insight dari AI
          const aiResult = await AIService.analyzeTrend(trendData, config);
          setTrendInsight(aiResult);
        } else {
          // Tidak ada API key, langsung heuristic
          setTrendInsight({ insight: generateHeuristicInsight(trendData), mode: 'Heuristic' });
        }
      } catch (aiError) {
        // AI gagal (token habis atau error), fallback ke heuristic
        console.warn("AI failed, using heuristic:", aiError);
        setTrendInsight({ insight: generateHeuristicInsight(trendData), mode: 'Heuristic' });
      }
    } catch (err) {
      console.error("Trend data fetch failed:", err);
      setIsTrendLoading(false);
    }
  };
  // ... rest of state
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<SuspiciousAccount[]>([]);
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaignsCount: 0,
    totalReach: 0,
    activeBuzzersCount: 0,
    avgBotScore: 0,
    recentReportsCount: 0
  });
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<SuspiciousAccount | null>(null);
  const [campaignBrief, setCampaignBrief] = useState<string | null>(null);
  const [accountBrief, setAccountBrief] = useState<string | null>(null);
  const [accountPosts, setAccountPosts] = useState<any[]>([]);

  const [campaignAIMode, setCampaignAIMode] = useState<'AI' | 'Heuristic' | null>(null);

  useEffect(() => {
    if (selectedCampaign?.id) {
      setCampaignBrief(null);
      setCampaignAIMode(null);
      
      const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
      const config = {
        provider,
        model: localStorage.getItem('selectedModel') || 'gemini-1.5-flash',
        apiKey: localStorage.getItem(`api-key-${provider}`) || ''
      };
      
      // Cek localStorage cache dulu dengan suffix v2 untuk invalidate cache lama
      const cacheKey = `brief_${selectedCampaign.id}_v2`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { text, mode, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 300000) {
            setCampaignBrief(text);
            setCampaignAIMode(mode);
            return;
          }
        }
      } catch {}
      
      const generateBrief = async () => {
        try {
          if (config.apiKey) {
            const prompt = `Buat ringkasan intelijen singkat (2-3 kalimat Bahasa Indonesia) untuk kampanye disinformasi ini:
Judul: ${selectedCampaign.title}
Platform: ${selectedCampaign.platforms?.join(', ')}
Topik: ${selectedCampaign.topic}
Intensitas: ${selectedCampaign.intensity}
Rasio Bot: ${Math.round((selectedCampaign.botRatio || 0) * 100)}%
Postingan: ${selectedCampaign.buzzerCount || 0}
Tagar: ${(selectedCampaign.hashtags || []).join(', ')}
Narasi: ${selectedCampaign.keyNarrative || 'Tidak diketahui'}`;
            
            const resp = await AIService.generateEvidence([{ text: prompt }], config, selectedCampaign.id);
            const text = `[MODE ${resp.mode}] ${resp.summary}`;
            localStorage.setItem(cacheKey, JSON.stringify({ text, mode: resp.mode, timestamp: Date.now() }));
            setCampaignBrief(text);
            setCampaignAIMode(resp.mode);
          } else {
            const text = `[MODE HEURISTIK] Kampanye "${selectedCampaign.title}" terdeteksi di ${selectedCampaign.platforms?.[0] || 'multi-platform'} dengan intensitas ${selectedCampaign.intensity}. ${Math.round((selectedCampaign.botRatio || 0) * 100)}% aktivitas terindikasi dari akun buzzer terkoordinasi.`;
            setCampaignBrief(text);
            setCampaignAIMode('Heuristic');
          }
        } catch {
          setCampaignBrief(`[MODE HEURISTIK] Analisis AI gagal. Data kampanye menunjukkan ${selectedCampaign.buzzerCount} agen terpantau.`);
          setCampaignAIMode('Heuristic');
        }
      };
      generateBrief();
    }
  }, [selectedCampaign?.id]);

  useEffect(() => {
    if (selectedAccount?.id) {
      setAccountBrief(null);
      setAccountPosts([]);
      fetch(`/api/account/${selectedAccount.id}/brief`).then(r => r.json()).then(d => setAccountBrief(d.brief)).catch(() => {});
      fetch(`/api/account/${selectedAccount.id}/posts`).then(r => r.json()).then(d => setAccountPosts(d)).catch(() => {});
    }
  }, [selectedAccount?.id]);

  // Gemini Analyzer Form State
  const [analyzeType, setAnalyzeType] = useState<'profile' | 'copypasta' | 'campaign'>('copypasta');
  const [analyzePlatform, setAnalyzePlatform] = useState<Platform>('X');
  const [analyzeContent, setAnalyzeContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);

  // Community Reporter Form State
  const [reportUrl, setReportUrl] = useState('');
  const [reportUsername, setReportUsername] = useState('');
  const [reportPlatform, setReportPlatform] = useState<Platform>('X');
  const [reportNarrative, setReportNarrative] = useState('');
  const [reportEvidence, setReportEvidence] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // General Notification Alert
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [activeProvider, setActiveProvider] = useState<string>('Gemini');
  const [aiActive, setAiActive] = useState<boolean>(false);
  const [todayTrend, setTodayTrend] = useState<any[]>([]);

  const [activeModel, setActiveModel] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem('selectedProvider') || 'Gemini';
    const savedModel = localStorage.getItem('selectedModel') || '';
    setActiveProvider(saved);
    setActiveModel(savedModel);
    const key = localStorage.getItem(`api-key-${saved}`);
    setAiActive(!!key);
  }, []);

  useEffect(() => {
    const fetchTodayTrend = async () => {
      try {
        const resp = await fetch('/api/trend');
        const data = await resp.json();
        setTodayTrend(data);
      } catch {}
    };
    fetchTodayTrend();

    fetchData();
    const statsInterval = setInterval(fetchData, 10000);

    // Deep Cognition Alert dinonaktifkan (statik & tanpa notifikasi otomatis)
    // const alertInterval = setInterval(async () => {
    //   const mockCritical = true; 
    //   if (mockCritical) {
    //     showNotification('success', 'Peringatan Deteksi Ancaman Kritis!');
    //   }
    // }, 10000); 

    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  // Keyword OSINT Search State
  const [searchKeywordInput, setSearchKeywordInput] = useState('');
  const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const handleKeywordSearch = async (_e?: any) => {
    if (!searchKeywordInput.trim()) {
      showNotification('error', 'Silakan masukkan kata kunci penyelidikan terlebih dahulu.');
      return;
    }

    setIsSearchingKeyword(true);
    try {
      const result = await api.social.search(searchKeywordInput);
      setCurrentKeyword(searchKeywordInput);

      if (result.campaigns && result.campaigns.length > 0) {
        setCampaigns(result.campaigns);
        setAccounts(result.accounts || []);
        setSelectedCampaign(result.campaigns[0]);
        if (result.accounts && result.accounts.length > 0) {
          setSelectedAccount(result.accounts[0]);
        }
      } else if (result.method !== 'reset') {
        await fetchData();
      }

      setReloadTrigger(prev => prev + 1);
      setActiveTab('campaigns');
      showNotification('success', `Berhasil mendeteksi jaringan buzzer untuk kata kunci: "${searchKeywordInput}"`);
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'Gagal memindai kata kunci. Silakan coba lagi.');
    } finally {
      setIsSearchingKeyword(false);
    }
  };

  const handleClearKeywordSearch = async () => {
    setSearchKeywordInput('');
    setCurrentKeyword('');
    setIsSearchingKeyword(true);
    try {
      await api.social.search("Reset_Siber_Clean_Slate");
      setReloadTrigger(prev => prev + 1);
      await fetchData();
      showNotification('success', 'Berhasil mereset penyelidikan siber ke kondisi awal.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingKeyword(false);
    }
  };

  const [isCollectingEvidence, setIsCollectingEvidence] = useState(false);
  const handleCollectEvidence = async (account: SuspiciousAccount) => {
    setIsCollectingEvidence(true);
    try {
      const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
      const config = {
        provider,
        model: localStorage.getItem('selectedModel') || 'gemini-1.5-flash',
        apiKey: localStorage.getItem(`api-key-${provider}`) || ''
      };
      
      const result = await AIService.generateEvidence(accountPosts, config);
      const briefText = result.mode === 'AI' 
        ? `[MODE AI] ${result.summary}`
        : `[MODE HEURISTIK] Data postingan tidak cukup untuk AI. Akun menunjukkan pola: ${account.reason || 'Tidak ada info'}`;
      
      setAccountBrief(briefText);
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, aiEvidenceSummary: briefText } : a));
    } catch (err) {
      console.error("Evidence collection failed:", err);
    } finally {
      setIsCollectingEvidence(false);
    }
  };

  const [isPredicting, setIsPredicting] = useState(false);
  const handlePredictRisk = async (campaign: Campaign) => {
    setIsPredicting(true);
    try {
      const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
      const config = {
        provider,
        model: localStorage.getItem('selectedModel') || 'gemini-1.5-flash',
        apiKey: localStorage.getItem(`api-key-${provider}`) || ''
      };
      
      const result = await AIService.predictRisk(campaign, todayTrend, config);
      const insightText = `[MODE ${result.mode}] ${result.insight}`;
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { 
        ...c, 
        predictedRiskTrend: result.trend as any,
        aiInsight: insightText,
        riskTrendMode: result.mode
      } : c));
      showNotification('success', `Analisis prediksi selesai. Mode: ${result.mode}`);
    } catch (err) {
      console.error("Prediction failed:", err);
    } finally {
      setIsPredicting(false);
    }
  };

  // Load backend data on mount
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchData = async () => {
    try {
      const [cResponse, aResponse, sData] = await Promise.all([
        api.campaigns.list(1, 20),
        api.accounts.list(1, 20),
        api.stats.get()
      ]);
      console.log('fetchData results:', { campaigns: cResponse.data?.length, accounts: aResponse.data?.length });
      
      if (cResponse.data?.length > 0) {
        setCampaigns(cResponse.data);
        setAccounts(aResponse.data);
        setStats(sData);
        
        // Hanya set default jika belum ada yang dipilih (cegah "reload" view)
        setSelectedCampaign(prev => {
          if (prev) {
            const stillExists = cResponse.data.find((c: any) => c.id === prev.id);
            return stillExists || cResponse.data[0];
          }
          return cResponse.data[0];
        });

        setSelectedAccount(prev => {
          if (prev) {
            const stillExists = aResponse.data.find((a: any) => a.id === prev.id);
            return stillExists || aResponse.data[0];
          }
          return aResponse.data[0];
        });
      } else {
        // ... rest of logic
      }
    } catch (error) {
      // ... error handling
    }
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Triggered when clicking a node inside the Network Correlation Map
  const handleNodeSelect = (nodeId: string, label: string, botScore?: number) => {
    if (nodeId.startsWith('camp-') || label.startsWith('#')) {
      const matchedCamp = campaigns.find(c => c.id === nodeId || c.title.toLowerCase() === label.toLowerCase());
      if (matchedCamp) {
        setSelectedCampaign(matchedCamp);
        setActiveTab('campaigns');
        showNotification('success', `Focused campaign: ${matchedCamp.title}`);
      } else {
        // Create matching temporary view object if it's new
        const tempCamp: Campaign = {
          id: nodeId,
          title: label,
          description: "Sub-node of ongoing active hashtag correlation network.",
          topic: "Affiliated Campaign",
          platforms: ['X'],
          intensity: 'High',
          sentiment: 'Negative',
          startDate: '2026-06-10',
          status: 'Active',
          botRatio: (botScore ? botScore / 100 : 0.82),
          reach: 84000,
          hashtags: [label],
          keyNarrative: "Amplified narrative node tracking coordinated message loops.",
          buzzerCount: 24
        };
        setSelectedCampaign(tempCamp);
        setActiveTab('campaigns');
      }
    } else {
      // Clean up username representation from node label
      const parsedUsername = label.replace('@', '');
      const matchedAcc = accounts.find(a => a.id === nodeId || a.username.toLowerCase() === parsedUsername.toLowerCase());
      if (matchedAcc) {
        setSelectedAccount(matchedAcc);
        setActiveTab('accounts');
        showNotification('success', `Focused suspicious account profiling: @${matchedAcc.username}`);
      } else {
        // Temporary view profile
        const tempAcc: SuspiciousAccount = {
          id: nodeId,
          username: parsedUsername,
          displayName: label,
          platform: 'X',
          followers: 412,
          following: 1980,
          botScore: botScore || 85,
          status: 'Under Investigation',
          lastActive: 'Just now',
          reason: 'Identified coordination cluster node linked to high-frequency retweeter cells.',
          recentCopypastaCount: 8
        };
        setSelectedAccount(tempAcc);
        setActiveTab('accounts');
      }
    }
  };

  // Handle active Gemini scan submission
  const analyzeSamples: Record<string, string> = {
    copypasta: 'Saya warga negara Indonesia yg cinta NKRI harga mati!\n' +
      'Bangsa ini harus dijaga dari penghianat!\n' +
      'Kami tidak akan pernah mundur, NKRI harga mati!\n' +
      'Ayo lawan mereka yg ingin menghancurkan Indonesia!\n' +
      '#NKRIhargaMatiamin\n' +
      'Jangan pernah percaya pada berita bohong!\n' +
      'Kita harus bersatu padu menjaga keutuhan bangsa!',
    profile: 'Username: @budi_nasionalis\nBio: NKRI Harga Mati | Menolak Lupa | Pendukung penuh pemerintah | #SaveNegara\nFollowers: 12\nFollowing: 1950\nJoin: March 2024\nVerified: No',
    campaign: 'Narasi: serangan terhadap pemerintah melalui tagar #PemerintahGagal, #RakyatSengsara. Akun-akun baru (usia < 3 bulan) membanjiri komentar dengan narasi seragam. Pola posting: 50+ tweet per jam per akun. Semua menyertakan link ke situs berita yang tidak jelas sumbernya.',
  };

  const fillSampleData = (type: string) => {
    setAnalyzeType(type as any);
    setAnalyzeContent(analyzeSamples[type] || '');
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzeContent.trim()) {
      showNotification('error', 'Masukkan teks, tautan, atau profil untuk dianalisis.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
      const config = {
        provider,
        model: localStorage.getItem('selectedModel') || 'gemini-1.5-flash',
        apiKey: localStorage.getItem(`api-key-${provider}`) || ''
      };

      const data = await AIService.analyze(analyzeContent, config);
      setAnalysisResult(data);
      showNotification('success', `Analisis selesai: ${data.verdict}`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Gagal memanggil AI. Periksa API Key di Pengaturan.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Community Case Report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportUrl || !reportNarrative) {
      showNotification('error', 'Isi URL bukti dan deskripsi narasi terlebih dahulu.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      await api.reports.submit({
        url: reportUrl,
        username: reportUsername,
        platform: reportPlatform,
        narrative: reportNarrative,
        evidence: reportEvidence,
        email: reportEmail
      });
      showNotification('success', 'Laporan insiden berhasil dikirim!');
      setReportUrl('');
      setReportUsername('');
      setReportNarrative('');
      setReportEvidence('');
      setReportEmail('');
      fetchData();
      if (reportUsername) {
        setActiveTab('accounts');
      } else {
        setActiveTab('campaigns');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'API tidak tersedia saat pengiriman laporan.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Date range helper
  const matchesDateRange = (date?: string) => {
    if (!dateRange.start && !dateRange.end) return true;
    const d = date || '';
    if (dateRange.start && d < dateRange.start) return false;
    if (dateRange.end && d > dateRange.end) return false;
    return true;
  };

  // Custom styling filters
  const filteredCampaigns = (campaigns || []).filter(c => {
    const matchesPlatform = platformFilter === 'All' || (c as any).platforms?.includes(platformFilter as Platform);
    const matchesSearch = searchQuery === '' || 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = matchesDateRange(c.startDate);
    return matchesPlatform && matchesSearch && matchesDate;
  });

  const filteredAccounts = accounts.filter(a => {
    const matchesPlatform = platformFilter === 'All' || a.platform === platformFilter;
    const matchesSearch = searchQuery === '' || 
      a.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = matchesDateRange(a.lastActive);
    return matchesPlatform && matchesSearch && matchesDate;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white" id="main-root">
      
      {/* Dynamic Pop-up Notification Banner */}
      {notification && (
        <div 
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in ${
            notification.type === 'success' 
              ? 'bg-[#152A18]/90 text-emerald-400 border-emerald-500/30' 
              : 'bg-[#2A1515]/90 text-red-400 border-red-500/30'
          }`}
          id="system-notification"
        >
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
          <span className="text-xs font-semibold font-mono tracking-tight">{notification.text}</span>
          <button onClick={() => setNotification(null)} className="hover:opacity-75 transition">
            <CloseIcon className="w-4 h-4 text-slate-400 ml-1" />
          </button>
        </div>
      )}

      {/* Header (Top Navigation & Clearances) */}
      <header className="h-20 bg-[#0A0A0B] border-b border-[#2A2A2E] px-6 lg:px-12 flex items-center justify-between z-10 sticky top-0" id="global-header">
        <div className="flex items-center space-x-4">
          {/* EchoWatch Styled Golden Hex Logo */}
          <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-[#8A6D3B] rounded flex items-center justify-center text-black font-extrabold text-xl shadow-lg shadow-[#D4AF37]/10 select-none">
            Σ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-serif italic tracking-tight text-[#F5F5F5] font-semibold">EchoWatch</h1>
              <span className="text-[9px] font-mono border border-amber-500/30 text-[#D4AF37] font-semibold px-1.5 py-0.5 rounded uppercase tracking-widest bg-amber-500/5">
                v2.6
              </span>
              <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 ${aiActive ? 'border border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border border-slate-700 text-slate-500 bg-slate-800/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${aiActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {aiActive ? `AI ${activeProvider} (${activeModel}) Aktif` : 'AI Offline'}
              </span>
            </div>
            <p className="text-[10px] text-[#A0A0A5] font-mono tracking-wider uppercase">Pemindai Disinformasi Multi-Platform</p>
          </div>
        </div>

        {/* Desktop Custom Nav Link Tabs */}
        <nav className="hidden lg:flex items-center space-x-8 text-xs uppercase tracking-[0.18em] font-semibold text-[#A0A0A5]">
          <button 
            onClick={() => setActiveTab('campaigns')}
            className={`pb-1 transition-all ${activeTab === 'campaigns' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-campaigns"
          >
            Intel Kampanye
          </button>
          <button 
            onClick={() => setActiveTab('accounts')}
            className={`pb-1 transition-all ${activeTab === 'accounts' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-accounts"
          >
            Profil Entitas
          </button>
          <button 
            onClick={() => setActiveTab('graph')}
            className={`pb-1 transition-all ${activeTab === 'graph' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-graph"
          >
            Matriks Jaringan
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`pb-1 transition-all ${activeTab === 'analytics' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-analytics"
          >
            Analitik Sosial
          </button>
          <button 
            onClick={() => setActiveTab('tren')}
            className={`pb-1 transition-all ${activeTab === 'tren' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-trend"
          >
            Tren Harian
          </button>
          <button 
            onClick={() => setActiveTab('analyzer')}
            className={`pb-1 transition-all ${activeTab === 'analyzer' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-analyzer"
          >
            Analis Ancaman
          </button>
          <button 
            onClick={() => setActiveTab('reporter')}
            className={`pb-1 transition-all ${activeTab === 'reporter' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-reporter"
          >
            Lapor Insiden
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`pb-1 transition-all ${activeTab === 'settings' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-settings"
          >
            Pengaturan
          </button>
        </nav>

        {/* Security level badge & user */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right">
            <p className="text-[9px] font-mono text-[#66666E] uppercase tracking-wider">Mode Akses Integritas</p>
            <p className="text-xs font-bold text-[#D4AF37] opacity-90 font-mono">Level 4: Admin Keamanan</p>
          </div>
          <div className="w-10 h-10 rounded-full border border-violet-500/20 bg-[#15151A] p-0.5 flex items-center justify-center text-xs font-mono font-bold text-amber-400 bg-gradient-to-tr from-[#1A1A1F] to-[#272730] shadow-inner border border-[#D4AF37]/30">
            H.I
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 flex flex-col xl:flex-row overflow-hidden" id="main-content-layout">
        
        {/* Left Control Sidebar */}
        <aside className="w-full xl:w-80 bg-[#0F0F12] border-b xl:border-b-0 xl:border-r border-[#2A2A2E] p-6 flex flex-col space-y-6" id="left-sidebar">
          
          {/* Quick Stats Panel */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#15151A] border border-[#2A2A2E] p-3 rounded-lg flex flex-col justify-between" id="stat-total-campaigns">
              <span className="text-[9px] uppercase tracking-wider text-[#66666E] font-semibold">Kampanye</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-serif text-[#D4AF37] font-bold">{stats.totalCampaigns}</span>
                <span className="text-[10px] text-emerald-400 font-mono">(Active: {stats.activeCampaignsCount})</span>
              </div>
            </div>
            <div className="bg-[#15151A] border border-[#2A2A2E] p-3 rounded-lg flex flex-col justify-between" id="stat-active-buzzers">
              <span className="text-[9px] uppercase tracking-wider text-[#66666E] font-semibold">Node Terpantau</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-serif text-[#D4AF37] font-bold">{stats.activeBuzzersCount}</span>
                <span className="text-[10px] text-red-400 font-mono">▲ {stats.avgBotScore}% buzzer</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#2A2A2E] pt-5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#66666E]/90 mb-3 flex items-center gap-1.5 font-bold">
              <Fingerprint className="w-3.5 h-3.5 text-[#D4AF37]" /> Filter Platform
            </h3>
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
              {[
                { name: 'All', icon: <Users className="w-3.5 h-3.5" />, color: 'bg-indigo-500' },
                { name: 'X', icon: <span className="font-mono text-xs">X</span>, color: 'bg-zinc-600' },
                { name: 'TikTok', icon: <span className="font-mono text-xs">tk</span>, color: 'bg-black border border-slate-700' },
                { name: 'YouTube', icon: <span className="font-mono text-xs">yt</span>, color: 'bg-red-600' },
              ].map((plat) => (
                <button
                  key={plat.name}
                  id={`filter-sidebar-${plat.name.toLowerCase()}`}
                  onClick={() => {
                    setPlatformFilter(plat.name);
                    showNotification('success', `Platform context set to: ${plat.name}`);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded text-xs select-none transition border ${
                    platformFilter === plat.name
                      ? 'bg-[#1A1A1F] border-[#D4AF37] text-white shadow-sm'
                      : 'bg-[#15151A]/80 border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#1A1A1F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {plat.icon}
                    <span>{plat.name}</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${plat.color} ring-2 ring-slate-950`}></span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Search */}
          <div className="border-t border-[#2A2A2E] pt-5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#66666E]/90 mb-3 flex items-center gap-1.5 font-bold">
              <Search className="w-3.5 h-3.5 text-[#D4AF37]" /> Stream Filter Langsung
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tagar, nama pengguna, kata kunci..."
                className="w-full text-xs bg-slate-950 border border-[#2A2A2E] rounded-lg py-2.5 pl-9 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]/50"
                id="sidebar-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Keyword Discovery and OSINT scanning */}
          <div className="border-t border-[#2A2A2E] pt-5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#66666E]/90 mb-3 flex items-center gap-1.5 font-bold">
              <Cpu className="w-3.5 h-3.5 text-rose-400" /> Pencarian Kata Kunci OSINT
            </h3>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-[#D4AF37]" />
                <input
                  type="text"
                  value={searchKeywordInput}
                  onChange={(e) => setSearchKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isSearchingKeyword) handleKeywordSearch(); }}
                  placeholder="Masukkan kata kunci (e.g. Pemilu)..."
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleKeywordSearch}
                  disabled={isSearchingKeyword}
                  className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium py-2 px-3 rounded-lg text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingKeyword ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  {isSearchingKeyword ? 'Memindai...' : 'Mulai Pindai'}
                </button>
                {currentKeyword && (
                  <button
                    type="button"
                    onClick={handleClearKeywordSearch}
                    disabled={isSearchingKeyword}
                    className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 p-2 rounded-lg text-xs font-mono cursor-pointer transition"
                    title="Reset data ke kondisi awal"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            {currentKeyword && (
              <div className="mt-3 p-3 bg-rose-950/20 rounded-lg border border-rose-500/10 text-left">
                <p className="text-[10px] uppercase font-mono text-rose-400 font-bold tracking-wide">AKTIF MEMANTAU</p>
                <p className="text-xs font-bold font-mono text-slate-200 mt-1 truncate">"{currentKeyword}"</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Sistem telah mematangkan pemodelan intelligence buatan dari arus data platform X, TikTok & YouTube.
                </p>
              </div>
            )}
          </div>

          {/* Time Range Filter */}
          <div className="border-t border-[#2A2A2E] pt-5 mt-5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#66666E]/90 mb-3 flex items-center gap-1.5 font-bold">
              <CalendarDays className="w-3.5 h-3.5 text-[#D4AF37]" /> Jenjang Waktu
            </h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <DatePickerModal
                  label="Mulai"
                  value={dateRange.start}
                  onChange={(val) => setDateRange(prev => ({ ...prev, start: val }))}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div className="flex-1">
                <DatePickerModal
                  label="Akhir"
                  value={dateRange.end}
                  onChange={(val) => setDateRange(prev => ({ ...prev, end: val }))}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto hidden xl:block pt-4">
            <div className="p-4 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/5 text-[11px] text-[#D4AF37] leading-relaxed relative overflow-hidden">
              <div className="absolute right-1 bottom-1 opacity-10">
                <Cpu className="w-16 h-16 text-amber-400" />
              </div>
              <strong className="block mb-1 font-bold text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> DEEP COGNITION ALERT
              </strong>
              Lonjakan copypasta terkoordinasi di 3 kampanye regional terdeteksi hari ini. Sinkronkan peta ancaman menggunakan tab analisis mesin ancaman siber.
            </div>
          </div>
        </aside>

        {/* Dynamic Nav Tabs for Mobile Views */}
        <div className="lg:hidden flex bg-[#0F0F12] border-b border-[#2A2A2E] overflow-x-auto whitespace-nowrap p-2 scrollbar-none" id="mobile-nav-tabs">
          {[
            { id: 'campaigns', label: 'Kampanye' },
            { id: 'accounts', label: 'Akun Mencurigakan' },
            { id: 'graph', label: 'Grafik Korelasi' },
            { id: 'analytics', label: 'Analitik Sosial' },
            { id: 'tren', label: 'Tren Harian' },
            { id: 'analyzer', label: 'Pindai Ancaman' },
            { id: 'reporter', label: 'Lapor Insiden' },
            { id: 'settings', label: 'Pengaturan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 mx-1 text-xs font-semibold rounded-md transition duration-200 ${
                activeTab === tab.id
                  ? 'bg-[#1A1A1F] text-[#D4AF37] border border-[#D4AF37]/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Primary Content View Container */}
        <section className="flex-1 p-6 lg:p-10 overflow-y-auto" id="primary-viewport-container">
          
          {/* TAB 1: Campaign Intelligence Directory */}
          {activeTab === 'campaigns' && (
            <div className="space-y-6" id="view-campaigns">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
                    <Radio className="w-5 h-5 text-[#D4AF37] animate-pulse" />
                    Kampanye Buzzer Terkoordinasi
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Direktori operasional, tagar, dan manipulasi opini publik multi platform yang terdeteksi oleh radar.
                  </p>
                </div>
                {platformFilter !== 'All' && (
                  <span className="text-xs bg-[#1A1A1F] border border-[#D4AF37]/30 text-[#D4AF37] font-semibold px-2.5 py-1 rounded">
                    Filter: {platformFilter}
                  </span>
                )}
              </div>

              {/* Grid split: Campaign List and Campaign Detailed Profile */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side: List */}
                <div className="lg:col-span-5 space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {filteredCampaigns.length === 0 ? (
                    <div className="p-8 text-center bg-[#15151A] rounded-xl border border-[#2A2A2E] text-slate-500">
                      <AlertTriangle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs">Tidak ada kampanye yang sesuai dengan kriteria saat ini.</p>
                    </div>
                  ) : (
                    filteredCampaigns.map((camp) => (
                      <div
                        key={camp.id}
                        id={`camp-card-${camp.id}`}
                        onClick={() => setSelectedCampaign(camp)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                          selectedCampaign?.id === camp.id
                            ? 'bg-[#15151A] border-[#D4AF37] shadow-lg shadow-[#D4AF37]/5'
                            : 'bg-[#15151A]/60 border-[#2A2A2E]/80 hover:border-slate-700 hover:bg-[#1A1A1F]'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-mono font-bold flex items-center gap-1 ${
                            camp.intensity === 'Critical' || camp.intensity === 'High' ? 'text-rose-400' :
                            camp.intensity === 'Medium' ? 'text-amber-400' :
                            'text-slate-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              camp.intensity === 'Critical' ? 'bg-rose-500 animate-ping' :
                              camp.intensity === 'High' ? 'bg-rose-500' :
                              camp.intensity === 'Medium' ? 'bg-amber-500' :
                              'bg-slate-500'
                            }`}></span>
                            ANCAMAN {camp.intensity.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded">
                            {camp.topic}
                          </span>
                        </div>
                        <h4 className="text-slate-100 font-bold text-sm truncate tracking-tight">{camp.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{camp.description}</p>
                        
                        {/* Tags and reach pill layout */}
                        <div className="flex flex-wrap items-center justify-between mt-3 pt-3 border-t border-[#2A2A2E]/50 text-[10px] text-slate-500">
                          <div className="flex gap-1.5">
                            {camp.platforms.map(p => (
                              <span key={p} className="bg-[#1A1A1F] border border-slate-800 text-slate-300 font-bold px-1.5 py-0.2 rounded">
                                {p}
                              </span>
                            ))}
                          </div>
                          <span className="font-mono text-amber-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-orange-400" />
                            {camp.reach.toLocaleString()} jangkauan
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Right side: Selected Profile Detailed Metrics */}
                <div className="lg:col-span-7 bg-[#15151A] border border-[#2A2A2E] rounded-xl p-5 lg:p-6 lg:min-h-[500px] flex flex-col justify-between" id="campaign-profile-detail">
                  {selectedCampaign ? (
                    <div>
                      {/* Detailed meta headers */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2E] pb-4 mb-5">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 font-mono">Profil Kampanye Detail</span>
                          <h3 className="text-slate-100 text-lg font-serif italic font-semibold mt-1 flex items-center gap-2">
                            {selectedCampaign.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                            selectedCampaign.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            selectedCampaign.status === 'Monitoring' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}>
                            ● {selectedCampaign.status}
                          </span>
                          <button 
                            onClick={() => {
                              setAnalyzeContent(`Campaign investigation payload for ${selectedCampaign.title}: ${selectedCampaign.description}. Key Narratives: ${selectedCampaign.keyNarrative}. Focused hashtags: ${selectedCampaign.hashtags.join(', ')}.`);
                              setActiveTab('analyzer');
                              showNotification('success', 'Konteks kampanye disalin ke Threat Analyzer!');
                            }}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] font-semibold border border-amber-500/20 hover:border-[#D4AF37]/50 text-[11px] font-mono px-2.5 py-1 rounded transition duration-200"
                            id="btn-scan-campaign"
                          >
                            Pindai AI Narasi
                          </button>
                        </div>
                      </div>

                      {/* Topic, Description, Key Narrative block */}
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1">Objektif Strategis</h5>
                          <p className="text-xs text-slate-300 leading-relaxed bg-[#0F0F12] border border-[#2A2A2E]/70 p-3.5 rounded-lg">
                            {selectedCampaign.description}
                          </p>
                        </div>

                          {/* AI Campaign Brief */}
                          <div>
                            <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${campaignAIMode === 'AI' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                Risalah Intelijen AI
                              </span>
                              {campaignAIMode && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded ${campaignAIMode === 'AI' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {campaignAIMode}
                                </span>
                              )}
                            </h5>
                            <p className="text-xs text-slate-300 leading-relaxed bg-[#0F0F12] border border-[#2A2A2E]/70 p-3.5 rounded-lg border-l-2 border-l-emerald-500/50">
                              {campaignBrief || 'Menganalisis kampanye...'}
                            </p>
                          </div>

                        <div>
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1">Narasi Inti Terkoordinasi</h5>
                          <p className="text-xs text-slate-300 leading-relaxed bg-[#0F0F12] border border-[#2A2A2E]/70 p-3.5 rounded-lg border-l-2 border-l-[#D4AF37]">
                            {selectedCampaign.keyNarrative}
                          </p>
                        </div>

                        {/* Coordinated Hashtags */}
                        <div>
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1.5">Tagar Amplifikasi Terpantau</h5>
                          <div className="flex flex-wrap gap-2">
                            {selectedCampaign.hashtags.map((tag) => (
                              <span 
                                key={tag} 
                                className="text-xs font-mono bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded cursor-pointer transition"
                                onClick={() => {
                                  setSearchQuery(tag);
                                  showNotification('success', `Filtering list on: ${tag}`);
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Custom Data Metrics block */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          {/* Bot Ratio Bar */}
                          <div className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-lg flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-mono text-slate-500 font-semibold">KEPADATAN BUZZER</span>
                              <span className="text-xs font-bold font-mono text-rose-400">{Math.round(selectedCampaign.botRatio * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-500 to-rose-600 rounded-full"
                                style={{ width: `${selectedCampaign.botRatio * 100}%` }}
                              ></div>
                            </div>
                            <p className="text-[9px] text-[#A0A0A5] mt-1.5">
                              Persentase volume yang dihasilkan oleh algoritma penjadwal terprogram.
                            </p>
                          </div>

                          {/* Network Severity */}
                          <div className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-lg flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-mono text-slate-500 font-semibold flex items-center justify-between w-full">
                                KLASIFIKASI INTENSITAS
                                {campaignAIMode && (
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${campaignAIMode === 'AI' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {campaignAIMode}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {['Low', 'Medium', 'High', 'Critical'].map((lv) => (
                                <span 
                                  key={lv} 
                                  className={`flex-1 h-1 rounded ${
                                    selectedCampaign.intensity === lv ? (lv === 'Critical' ? 'bg-rose-500' : 'bg-orange-500') : 'bg-slate-800'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-[9px] text-[#A0A0A5] mt-1.5">
                              Indikator prioritas kampanye dalam matriks ancaman.
                            </p>
                          </div>
                        </div>

                        {/* Reach & Active node details */}
                        <div className="grid grid-cols-3 gap-2 text-center pt-2">
                          <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg">
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block uppercase">Estimasi Tayangan</span>
                            <span className="text-sm font-semibold font-serif text-[#D4AF37]">{selectedCampaign.reach.toLocaleString()}</span>
                          </div>
                          <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg relative">
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block uppercase">Agen Terpantau</span>
                            <span className="text-sm font-semibold font-serif text-[#D4AF37]">{selectedCampaign.buzzerCount}</span>
                          </div>
                          <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg relative">
                            <button
                              onClick={() => handlePredictRisk(selectedCampaign)}
                              disabled={isPredicting}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center border border-indigo-400 shadow-lg transition z-10"
                              title="Prediksi Tren Risiko AI"
                            >
                              {isPredicting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                            </button>
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block uppercase">Tren Risiko AI</span>
                            <span className={`text-sm font-semibold font-serif ${
                              selectedCampaign.predictedRiskTrend === 'rising' ? 'text-rose-500' :
                              selectedCampaign.predictedRiskTrend === 'falling' ? 'text-emerald-500' :
                              'text-amber-400'
                            }`}>
                              {selectedCampaign.predictedRiskTrend ? selectedCampaign.predictedRiskTrend.toUpperCase() : 'STABLE'}
                            </span>
                          </div>
                        </div>

                        {selectedCampaign.aiInsight && (
                          <div className="mt-3 p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-left">
                            <h6 className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <BrainCircuit className="w-3 h-3" /> Wawasan Mendalam AI
                              </span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded ${selectedCampaign.riskTrendMode === 'AI' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {selectedCampaign.riskTrendMode || 'Heuristic'}
                              </span>
                            </h6>
                            <p className="text-[11px] text-slate-300 leading-normal italic">
                              "{selectedCampaign.aiInsight}"
                            </p>
                          </div>
                        )}

                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-slate-500 text-center py-20">
                      <Radio className="w-12 h-12 text-slate-700 stroke-1 mb-3 animate-pulse" />
                      <p className="font-semibold text-sm">Pilih kampanye di daftar kiri untuk melihat detail.</p>
                    </div>
                  )}

                  {/* Informative tips */}
                  <div className="mt-6 pt-4 border-t border-[#2A2A2E]/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      Mulai Umpan Langsung: {selectedCampaign?.startDate || "2026-06"}
                    </span>
                    <span className="italic">ID Kampanye: {selectedCampaign?.id}</span>
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* TAB 2: Suspicious Accounts Investigator */}
          {activeTab === 'accounts' && (
            <div className="space-y-6" id="view-accounts">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
                    <UserX className="w-5 h-5 text-rose-500" />
                    Profil Akun Mencurigakan (Buzzer Portal)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Pemetaan agen/client buzzer, spammer, dan operator manipulator opini publik. Klik untuk membedah.
                  </p>
                </div>
                {platformFilter !== 'All' && (
                  <span className="text-xs bg-[#1A1A1F] border border-[#D4AF37]/30 text-[#D4AF37] font-semibold px-2.5 py-1 rounded">
                    Platform: {platformFilter}
                  </span>
                )}
              </div>

              {/* Grid Content Split: Accounts directory lists, Accounts analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left side list */}
                <div className="lg:col-span-5 space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {filteredAccounts.length === 0 ? (
                    <div className="p-8 text-center bg-[#15151A] rounded-xl border border-[#2A2A2E] text-slate-500">
                      <AlertTriangle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs">Tidak ada entitas yang sesuai filter.</p>
                    </div>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        id={`acc-card-${acc.id}`}
                        onClick={() => setSelectedAccount(acc)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex items-center justify-between ${
                          selectedAccount?.id === acc.id
                            ? 'bg-[#15151A] border-[#D4AF37] shadow-lg shadow-[#D4AF37]/5'
                            : 'bg-[#15151A]/60 border-[#2A2A2E]/80 hover:border-slate-700 hover:bg-[#1A1A1F]'
                        }`}
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-9 h-9 rounded-full bg-[#2A2A2E]/60 flex items-center justify-center font-bold font-mono text-slate-400 text-xs border border-slate-700">
                            {acc.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="text-slate-100 font-bold text-xs truncate flex items-center gap-1.5">
                              {acc.displayName}
                              <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono font-bold">
                                {acc.platform}
                              </span>
                            </h4>
                            <p className="text-[11px] text-[#A0A0A5] font-mono mt-0.5 flex items-center gap-1">
                              @{acc.username}
                              {(() => {
                                const url = acc.platform === 'X' ? `https://x.com/${acc.username}`
                                  : acc.platform === 'YouTube' ? `https://youtube.com/@${acc.username}`
                                  : acc.platform === 'TikTok' ? `https://tiktok.com/@${acc.username}`
                                  : null;
                                return url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-slate-600 hover:text-[#D4AF37] transition" title="Buka profil">
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : null;
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-red-400 flex items-center justify-end gap-1">
                            {acc.botScore}%
                          </div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold font-mono block mt-0.5">
                            {acc.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Right side detailed layout */}
                <div className="lg:col-span-7 bg-[#15151A] border border-[#2A2A2E] rounded-xl p-5 lg:p-6 lg:min-h-[500px] flex flex-col justify-between" id="account-profiler-detail">
                  {selectedAccount ? (
                    <div>
                      {/* Detailed meta headers */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2E] pb-4 mb-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-full border border-[#D4AF37]/40 bg-slate-900/80 p-0.5 flex items-center justify-center text-sm font-mono font-bold text-[#D4AF37]">
                            {selectedAccount.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-slate-100 text-sm font-bold tracking-tight">
                              {selectedAccount.displayName}
                            </h3>
                            <p className="text-xs text-amber-500 font-mono mt-0.5 flex items-center gap-1.5">
                              @{selectedAccount.username} on {selectedAccount.platform}
                              {(() => {
                                const profileUrl = selectedAccount.platform === 'X' ? `https://x.com/${selectedAccount.username}`
                                  : selectedAccount.platform === 'YouTube' ? `https://youtube.com/@${selectedAccount.username}`
                                  : selectedAccount.platform === 'TikTok' ? `https://tiktok.com/@${selectedAccount.username}`
                                  : null;
                                return profileUrl ? (
                                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#D4AF37] transition" title="Buka profil asli">
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : null;
                              })()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCollectEvidence(selectedAccount)}
                            disabled={isCollectingEvidence}
                            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold rounded-lg border transition ${
                              isCollectingEvidence 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' 
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {isCollectingEvidence ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                            {isCollectingEvidence ? 'AI ANALYSING...' : 'COLLECT AI EVIDENCE'}
                          </button>
                          <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                            selectedAccount.status === 'Verified Buzzer' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            selectedAccount.status === 'Suspended' ? 'bg-zinc-700/20 text-zinc-500 border border-zinc-700/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {selectedAccount.status}
                          </span>
                          {(() => {
                            const profileUrl = selectedAccount.platform === 'X' ? `https://x.com/${selectedAccount.username}`
                              : selectedAccount.platform === 'YouTube' ? `https://youtube.com/@${selectedAccount.username}`
                              : selectedAccount.platform === 'TikTok' ? `https://tiktok.com/@${selectedAccount.username}`
                              : null;
                            return profileUrl ? (
                              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-slate-700 text-[11px] font-mono px-2.5 py-1 rounded transition duration-200 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Buka Profil
                              </a>
                            ) : null;
                          })()}
                          <button 
                            onClick={() => {
                              setAnalyzeContent(`Suspected buzzer account footprint details:\nUsername: @${selectedAccount.username}\nPlatform: ${selectedAccount.platform}\nIndicators: ${selectedAccount.reason}. Followers: ${selectedAccount.followers}. Frequency counter: ${selectedAccount.recentCopypastaCount} boilerplate comments logged.`);
                              setAnalyzePlatform(selectedAccount.platform);
                              setActiveTab('analyzer');
                              showNotification('success', `Entity details loaded for Threat analysis scanning!`);
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-mono px-2.5 py-1 rounded transition duration-200"
                            id="btn-scan-account"
                          >
                            Scan Signature
                          </button>
                        </div>
                      </div>

                      {/* Bot Probability Gauge */}
                      <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-900 mb-5 text-left">
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                            <span className="text-[10px] tracking-wider font-mono text-slate-400 font-bold uppercase">RATING KOORDINASI BUZZER</span>
                          </div>
                          <span className="text-sm font-extrabold font-mono text-red-500">{selectedAccount.botScore / 100} / 1.0</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div 
                            className="h-full bg-gradient-to-r from-yellow-500 via-orange-600 to-rose-600 rounded-full"
                            style={{ width: `${selectedAccount.botScore}%` }}
                          ></div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                          Verdict: {selectedAccount.reason}
                        </p>
                      </div>

                      {/* Micro Statistics */}
                      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                          <span className="text-[9.5px] font-mono text-slate-500 block uppercase font-bold">Pengikut</span>
                          <span className="text-sm font-semibold font-mono text-slate-300">{selectedAccount.followers.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                          <span className="text-[9.5px] font-mono text-slate-500 block uppercase font-bold">Mengikuti</span>
                          <span className="text-sm font-semibold font-mono text-slate-300">{selectedAccount.following.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                          <span className="text-[9.5px] font-mono text-slate-500 block uppercase font-bold">Copypasta</span>
                          <span className="text-sm font-semibold font-mono text-rose-400">{selectedAccount.recentCopypastaCount} tercatat</span>
                        </div>
                      </div>

                      {/* Coordination Signals */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] tracking-widest font-mono uppercase text-[#66666E]/90 font-bold mb-2">Jejak Koordinasi</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-300">
                          <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-900 flex items-start space-x-2">
                            <CornerDownRight className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-200">Sinkronisasi Temporal</p>
                              <p className="text-[11px] text-slate-400 mt-1">Posting dalam 4 detik dari instruksi pusat.</p>
                            </div>
                          </div>
                          <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-900 flex items-start space-x-2">
                            <CornerDownRight className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-200">Pohon Kalimat Berulang</p>
                              <p className="text-[11px] text-slate-400 mt-1">Frasa cocok sempurna dengan template disinformasi yang dikenal.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Account Brief */}
                      {accountBrief && (
                        <div className="mb-5">
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            AI Analisis Akun
                          </h5>
                          <p className="text-xs text-slate-300 leading-relaxed bg-[#0F0F12] border border-[#2A2A2E]/70 p-3.5 rounded-lg border-l-2 border-l-emerald-500/50">
                            {accountBrief}
                          </p>
                        </div>
                      )}

                      {/* Post History */}
                      {accountPosts.length > 0 && (
                        <div className="mb-5">
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-2">Riwayat Postingan</h5>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {accountPosts.map((post, i) => (
                              <div key={i} className="bg-slate-950/40 border border-slate-900 p-2.5 rounded-lg">
                                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{post.text}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-[9px] font-mono text-slate-600">
                                  <span>❤ {post.likes || 0}</span>
                                  <span>💬 {post.comments || 0}</span>
                                  <span>🔄 {post.shares || 0}</span>
                                  {post.label && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                      post.label === 'propaganda' ? 'bg-red-900/30 text-red-400' :
                                      post.label === 'copypasta' ? 'bg-orange-900/30 text-orange-400' :
                                      post.label === 'spam' ? 'bg-yellow-900/30 text-yellow-400' :
                                      'bg-green-900/30 text-green-400'
                                    }`}>
                                      {post.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cross-platform footprint */}
                      <div className="mb-5">
                        <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-2">Jejak Lintas Platform</h5>
                        <div className="flex gap-2">
                          {['X', 'YouTube', 'TikTok'].map(p => (
                            <div key={p} className={`flex-1 p-2.5 rounded-lg border text-center ${
                              selectedAccount.platform === p
                                ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
                                : 'bg-slate-950/30 border-slate-800/60 text-slate-600'
                            }`}>
                              <span className="text-[10px] font-bold font-mono">{p === 'X' ? '𝕏' : p === 'YouTube' ? '▶' : '♬'} {p}</span>
                              {selectedAccount.platform === p && <span className="text-[8px] block text-[#D4AF37]/70 mt-0.5">AKTIF</span>}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-slate-500 text-center py-20">
                      <UserX className="w-12 h-12 text-slate-700 stroke-1 mb-3" />
                      <p className="font-semibold text-sm">Pilih kartu akun untuk memeriksa tingkat ancaman.</p>
                    </div>
                  )}

                  {/* Footer metadata details */}
                  <div className="mt-6 pt-4 border-t border-[#2A2A2E]/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      Sinyal Aktif Terdeteksi: {selectedAccount?.lastActive || "Baru Saja"}
                    </span>
                    <span className="italic">Threat Node Identifier: {selectedAccount?.id}</span>
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* TAB 3: Network Matrix Interaction Map */}
          {activeTab === 'graph' && (
            <div className="space-y-6" id="view-graph">
              <div>
                <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  Peta Korelasi Kampanye Multi-Platform
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                    Peta simpul visual koordinasi buzzer. Menghubungkan master server, tagar manipulatif, dan akun buzzer penguat pesan.
                </p>
              </div>

              {/* Direct insertion of interactive Network Canvas */}
                  <Suspense fallback={<div className="h-[480px] flex items-center justify-center text-slate-500 font-mono text-sm border border-slate-800 rounded-xl">Memuat Grafik Interaktif...</div>}>
                <NetworkGraph onSelectNode={handleNodeSelect} reloadTrigger={reloadTrigger} dateRange={dateRange} />
              </Suspense>

              {/* Auxiliary details explaining the map */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#0F0F12] border border-[#2A2A2E] p-5 rounded-2xl relative" id="graph-legends-container">
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-semibold">1. Pusat Kampanye</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Senter utama (simpul berwarna ungu) mendefinisikan objektif propaganda atau narasi sentral yang disuntikkan.
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-semibold">2. Master Propagandis</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Individu berpengaruh atau master buzzer (simpul magenta) bertindak sebagai distributor/orator pertama.
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-semibold">3. Node Buzzer</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Akun buzzer (simpul oranye/abu) yang menduplikasi postingan (copypasta) demi memalsukan viralitas.
                  </p>
                </div>
              </div>
            </div>
          )}


           {/* TAB 3.5: Social Accounts & Analytics Dashboard */}
          {activeTab === 'analytics' && (
            <Suspense fallback={<div className="p-8 text-slate-500">Loading Analitik...</div>}>
              <SocialAnalyticsDashboard showNotification={showNotification} />
            </Suspense>
          )}

          {activeTab === 'tren' && (
            <TrendDashboard 
              trendData={trendData} 
              insight={trendInsight.insight} 
              insightMode={trendInsight.mode} 
              isTrendLoading={isTrendLoading} 
            />
          )}

          {/* TAB 4: Gemini-powered Analyzer Playground */}
          {activeTab === 'analyzer' && (
            <div className="space-y-6 animate-fade-in" id="view-analyzer">
              <div>
                <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-[#D4AF37]" />
                  Radar Detektif AI — Pemindai Ancaman
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tempelkan teks postingan, tautan promosi, atau biografi akun untuk mendeteksi pola buzzer dan koordinasi inautentik.
                </p>
              </div>

              {/* Sample data quick-fill buttons */}
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-mono text-slate-500 self-center mr-1">Coba sampel:</span>
                {[
                  { type: 'copypasta', label: 'Copypasta Buzzer' },
                  { type: 'profile', label: 'Profil Mencurigakan' },
                  { type: 'campaign', label: 'Kampanye Terkoordinasi' },
                ].map(s => (
                  <button
                    key={s.type}
                    onClick={() => fillSampleData(s.type)}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-slate-700 text-slate-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition bg-slate-900/30"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Form column */}
                <div className="lg:col-span-5 bg-[#15151A] border border-[#2A2A2E] rounded-xl p-5" id="analyzer-form-container">
                  <h3 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-bold mb-4">Parameter Pemindaian</h3>
                  
                  <form onSubmit={handleRunAnalysis} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Tipe Analisis</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'copypasta', label: 'Copypasta' },
                          { id: 'profile', label: 'Profil' },
                          { id: 'campaign', label: 'Kampanye' }
                        ].map(t => (
                          <button
                            type="button"
                            key={t.id}
                            id={`btn-scantype-${t.id}`}
                            onClick={() => setAnalyzeType(t.id as any)}
                            className={`py-2 text-[10.5px] font-mono rounded border text-center transition ${
                              analyzeType === t.id
                                ? 'bg-[#D4AF37] text-black font-extrabold border-amber-500'
                                : 'bg-[#0F0F12] text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            {t.label.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Platform Asal</label>
                      <select
                        value={analyzePlatform}
                        onChange={(e) => setAnalyzePlatform(e.target.value as Platform)}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-[#D4AF37]"
                        id="select-scan-platform"
                      >
                        <option value="All">Semua Platform</option>
                        <option value="X">X (Twitter)</option>
                        <option value="TikTok">TikTok</option>
                        <option value="YouTube">YouTube</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Konten atau Data</label>
                      <textarea
                        value={analyzeContent}
                        onChange={(e) => setAnalyzeContent(e.target.value)}
                        placeholder={
                          analyzeType === 'copypasta' 
                            ? 'Tempelkan beberapa baris komentar atau tweet mencurigakan...' 
                            : analyzeType === 'profile'
                            ? 'Contoh:\nUsername: @budi_nasionalis\nBio: Menolak Lupa, Dukung NKRI #SaveNegara\nFollowers: 12\nFollowing: 1950'
                            : 'Deskripsikan taktik narasi kampanye digital yang dicurigai...'
                        }
                        rows={6}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                        id="textarea-scan-content"
                      />
                      {analyzeContent && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {analyzeContent.match(/#\w+/g)?.map((tag, i) => (
                            <span key={i} className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono">{tag}</span>
                          ))}
                          {analyzeContent.match(/@\w+/g)?.map((mention, i) => (
                            <span key={i} className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono">{mention}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAnalyzing}
                      className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#8A6D3B] text-black font-mono font-extrabold rounded-lg tracking-wider transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      id="btn-trigger-ai-analysis"
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                          Memproses Matriks Ancaman...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-black" />
                          JALANKAN PEMINDAIAN
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Status or Results column */}
                <div className="lg:col-span-7 bg-[#0F0F12] border border-[#2A2A2E] rounded-xl p-5 lg:p-6 min-h-[400px] flex flex-col justify-between" id="analyzer-results-viewport">
                  {isAnalyzing ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-16 space-y-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin"></div>
                        <BrainCircuit className="w-8 h-8 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-mono font-bold text-amber-500">Menganalisis Sidik Jari Digital...</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">Memeriksa pola koordinasi dan indikator buzzer.</p>
                      </div>
                    </div>
                  ) : analysisResult ? (
                    <div className="space-y-5 text-left">
                      {/* Metric headers */}
                      <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-[#66666E]">SKOR RADAR</span>
                          <h4 className="text-slate-100 font-bold text-base mt-2 flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${analysisResult.isBuzzer ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                            {analysisResult.verdict === 'Genuine Account' ? 'Akun Asli' :
                             analysisResult.verdict === 'Suspected Social Buzzer' ? 'Terindikasi Buzzer' :
                             analysisResult.verdict === 'Coordinated Botnet Client' ? 'Koordinasi Buzter' :
                             'Spammer Berulang'}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#66666E]">TINGKAT KEYAKINAN</span>
                          <span className={`block font-serif italic text-2xl font-bold mt-1 ${analysisResult.confidenceScore > 75 ? 'text-rose-500' : 'text-[#D4AF37]'}`}>
                            {analysisResult.confidenceScore}%
                          </span>
                        </div>
                      </div>

                        {/* Threat dimension bars */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                              <span>Skor Ancaman</span>
                              <span>{analysisResult.confidenceScore}%</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                              <div className={`h-full rounded-full ${analysisResult.confidenceScore > 75 ? 'bg-red-500' : analysisResult.confidenceScore > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${analysisResult.confidenceScore}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                              <span>Sentimen Publik</span>
                              <span>{analysisResult.sentimentScore}</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                              <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-zinc-500 to-emerald-500"
                                style={{ width: `${((analysisResult.sentimentScore + 100) / 200) * 100}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Keyword Suggestion (New Feature) */}
                        <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                           <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block mb-2">Kata Kunci Terdeteksi (Analisis Lanjutan):</span>
                           <div className="flex flex-wrap gap-2">
                             {analysisResult.detectedNarratives.flatMap(n => n.split(' ')).filter(w => w.length > 5).slice(0, 5).map((kw, i) => (
                               <span key={i} className="text-[10px] bg-indigo-900/30 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
                                 {kw.replace(/[.,!]/g, '')}
                               </span>
                             ))}
                           </div>
                        </div>

                      {/* Summary response block */}
                      <div className="bg-[#15151A] border border-[#D4AF37]/20 p-4 rounded-xl leading-relaxed text-xs text-slate-200">
                        <strong className="text-[#D4AF37] block font-mono text-[10.5px] uppercase tracking-wider mb-1.5">Ringkasan Eksekutif</strong>
                        {analysisResult.summary}
                        {analysisResult.fallback && (
                          <span className="block mt-2.5 text-[9.5px] font-mono text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded inline-block">
                            Mode Offline Aktif: Konfigurasikan GEMINI_API_KEY untuk analisis AI langsung.
                          </span>
                        )}
                      </div>

                      {/* Characteristics and Red Flags block */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#15151A]/60 p-4 rounded-xl border border-slate-900">
                          <span className="text-[10.5px] font-mono uppercase text-[#66666E] font-bold block mb-2">Karakteristik Terdeteksi</span>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {analysisResult.botCharacteristics.map((char, idx) => (
                              <li key={idx} className="flex items-start space-x-2">
                                <span className="text-[#D4AF37] mt-0.5">•</span>
                                <span>{char}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-[#15151A]/60 p-4 rounded-xl border border-slate-900">
                          <span className="text-[10.5px] font-mono uppercase text-[#66666E] font-bold block mb-2">Vektor Narasi</span>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {analysisResult.detectedNarratives.map((nar, idx) => (
                              <li key={idx} className="flex items-start space-x-2">
                                <span className="text-[#D4AF37] mt-0.5">#</span>
                                <span>{nar}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Red Flags specific warnings list */}
                      {analysisResult.redFlags && analysisResult.redFlags.length > 0 && (
                        <div>
                          <span className="text-[10.5px] font-mono uppercase text-red-400 font-bold block mb-2.5">Bendera Merah Sistem</span>
                          <div className="space-y-2">
                            {analysisResult.redFlags.map((flag, idx) => (
                              <div key={idx} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-red-400 font-semibold">{flag.title}</strong>
                                  <p className="text-[11px] text-slate-400 mt-0.5">{flag.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-slate-600 text-center py-16">
                      <Cpu className="w-12 h-12 text-slate-800 mb-3" />
                      <p className="font-semibold text-xs uppercase tracking-wider font-mono">Output Siap</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">Masukkan konten sosial atau biografi akun di form sebelah kiri untuk memulai pemindaian pola buzzer.</p>
                    </div>
                  )}

                  {/* Sandbox warning helper */}
                  <div className="pt-4 border-t border-slate-900 mt-6 text-[10px] text-slate-500 text-center italic font-mono uppercase">
                    Parameter matriks deteksi terverifikasi: Standar Perilaku Inautentik Terkoordinasi v4.1
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* TAB 5: Live Incident Logger (Report campaigns/accounts) */}
          {activeTab === 'reporter' && (
            <div className="max-w-2xl mx-auto space-y-6" id="view-reporter">
              <div>
                <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[#D4AF37]" />
                  Laporkan Temuan Kampanye / Akun Buzzer baru
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Temukan botnet liar di media sosial Anda? Masukkan detailnya di bawah ini untuk mengunggah insiden ke radar komunitas secara instan.
                </p>
              </div>

              <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6 lg:p-8" id="report-form-card">
                <form onSubmit={handleReportSubmit} className="space-y-6 text-left">
                  
                  {/* Grid fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Tautan Bukti / URL Postingan *</label>
                      <input
                        type="url"
                        value={reportUrl}
                        onChange={(e) => setReportUrl(e.target.value)}
                        placeholder="https://twitter.com/suspect/status/12398"
                        required
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                        id="input-report-url"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Platform Media Sosial</label>
                      <select
                        value={reportPlatform}
                        onChange={(e) => setReportPlatform(e.target.value as Platform)}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-[#D4AF37]"
                        id="select-report-platform"
                      >
                        <option value="X">X (Twitter)</option>
                        <option value="TikTok">TikTok</option>
                        <option value="YouTube">YouTube</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Username Akun Pelaku (Opsional)</label>
                      <input
                        type="text"
                        value={reportUsername}
                        onChange={(e) => setReportUsername(e.target.value)}
                        placeholder="@buzzermaster_202"
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                        id="input-report-username"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Kata Kunci/Hashtag Utama *</label>
                      <input
                        type="text"
                        value={reportNarrative}
                        onChange={(e) => setReportNarrative(e.target.value)}
                        placeholder="Contoh: #BoikotPanganXCorp atau Isu Buruh"
                        required
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                        id="input-report-narrative"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Naskah Duplikasi / Kalimat Copypasta (Bukti Tambahan)</label>
                    <textarea
                      value={reportEvidence}
                      onChange={(e) => setReportEvidence(e.target.value)}
                      placeholder="Contoh: 'Semua buru setuju perusahaan bersalah!' (copypasta diulangi 20x oleh akun berbeda)"
                      rows={3}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                      id="textarea-report-evidence"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Email Pelapor (Opsional - Terenkripsi Rahasia)</label>
                    <input
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="anon-researcher@protonmail.com"
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                      id="input-report-email"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <p className="text-[10px] text-slate-500 italic max-w-sm font-mono uppercase">
                      ⚠️ Pelaporan akan ditinjau otomatis dan langsung masuk ke peta koordinasi sebagai data komunitas monitoring pendahuluan.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="px-6 py-3 bg-[#D4AF37] hover:bg-amber-500 font-mono text-black font-extrabold rounded-lg tracking-wider transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      id="btn-publish-report"
                    >
                      {isSubmittingReport ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                          Menerbitkan...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-black" />
                          PUBLIKASI INSIDEN
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

          {/* TAB 6: Settings */}
          {activeTab === 'settings' && (
            <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500 font-mono text-sm">Memuat Pengaturan...</div>}>
              <Settings showNotification={showNotification} />
            </Suspense>
          )}

        </section>
      </main>

      {/* Footer Status Bar representing the Sophisticated Dark look */}
      <footer className="h-10 bg-[#D4AF37] text-black text-[10px] px-6 lg:px-12 flex items-center justify-between font-bold uppercase tracking-wider select-none z-10" id="global-footer">
        <div className="flex space-x-6 overflow-hidden truncate">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse"></span>
            STATUS SISTEM: BEROPERASI
          </span>
          <span className="hidden md:inline">SINKRON TERAKHIR: BARU SAJA</span>
          <span className="hidden md:inline">ENKRIPSI: SHA-256</span>
        </div>
        <div className="flex space-x-4">
          <span className="hidden sm:inline">JARINGAN SAT: TERKONSOLIDASI</span>
          <span>KOGNISI AKTIF: DARING</span>
        </div>
      </footer>

    </div>
  );
}
