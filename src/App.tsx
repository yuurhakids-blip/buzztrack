import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Radio, 
  Hash, 
  UserX, 
  BrainCircuit, 
  AlertTriangle, 
  PlusCircle, 
  ExternalLink, 
  Send, 
  Users, 
  LineChart, 
  CornerDownRight, 
  TrendingUp,
  X as CloseIcon,
  CheckCircle,
  Clock,
  Fingerprint,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { Campaign, SuspiciousAccount, Platform, AnalysisResponse, UserReport } from './types';
import NetworkGraph from './components/NetworkGraph';
import SocialAnalyticsDashboard from './components/SocialAnalyticsDashboard';

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'campaigns' | 'accounts' | 'graph' | 'analyzer' | 'reporter' | 'analytics'>('campaigns');
  
  // Data State
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

  // Controls State
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<SuspiciousAccount | null>(null);

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

  // Keyword OSINT Search State
  const [searchKeywordInput, setSearchKeywordInput] = useState('');
  const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKeywordInput.trim()) {
      showNotification('error', 'Silakan masukkan kata kunci penyelidikan terlebih dahulu.');
      return;
    }

    setIsSearchingKeyword(true);
    try {
      const response = await fetch('/api/social/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: searchKeywordInput })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Terjadi kesalahan saat memproses rute pemindaian.');
      }

      setCurrentKeyword(searchKeywordInput);
      setReloadTrigger(prev => prev + 1);
      
      // Pull newly generated data
      await fetchData();
      
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
      await fetch('/api/social/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: "Reset_Siber_Clean_Slate" })
      });
      setReloadTrigger(prev => prev + 1);
      await fetchData();
      showNotification('success', 'Berhasil mereset penyelidikan siber ke kondisi awal.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingKeyword(false);
    }
  };

  // Load backend data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, aRes, sRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/accounts'),
        fetch('/api/stats')
      ]);

      if (cRes.ok && aRes.ok && sRes.ok) {
        const cData = await cRes.json();
        const aData = await aRes.json();
        const sData = await sRes.json();
        setCampaigns(cData);
        setAccounts(aData);
        setStats(sData);

        // Pre-select first item in details if nothing selected
        if (cData.length > 0 && !selectedCampaign) {
          setSelectedCampaign(cData[0]);
        }
        if (aData.length > 0 && !selectedAccount) {
          setSelectedAccount(aData[0]);
        }
      }
    } catch (error) {
      console.error("Error loading intelligence data:", error);
      showNotification('error', 'Failed to synchronize with central threat matrix feed.');
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
  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzeContent.trim()) {
      showNotification('error', 'Please enter some text, links, or username profiles to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: analyzeType,
          content: analyzeContent,
          platform: analyzePlatform
        })
      });

      if (response.ok) {
        const data: AnalysisResponse = await response.json();
        setAnalysisResult(data);
        showNotification('success', `Analysis completed with verdict: ${data.verdict}`);
        // Increment statistics and live-sync list!
        fetchData();
      } else {
        const errObj = await response.json();
        showNotification('error', errObj.error || 'Server returned deep analysis error.');
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Connection timed out during heavy intelligence query.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Community Case Report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportUrl || !reportNarrative) {
      showNotification('error', 'Please fill in the reported URL and narrative descriptive keywords.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: reportUrl,
          username: reportUsername,
          platform: reportPlatform,
          narrative: reportNarrative,
          evidence: reportEvidence,
          email: reportEmail
        })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('success', 'Incident vector logged successfully. Synchronization updated live!');
        // Reset Form
        setReportUrl('');
        setReportUsername('');
        setReportNarrative('');
        setReportEvidence('');
        setReportEmail('');
        
        // Refresh tables with newly generated campaign or account
        fetchData();
        // Redirect to live campaigns/accounts to see changes
        if (reportUsername) {
          setActiveTab('accounts');
        } else {
          setActiveTab('campaigns');
        }
      } else {
        showNotification('error', 'Failed to publish incident record. Verify inputs.');
      }
    } catch (err) {
      showNotification('error', 'API unavailable during incident propagation.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Custom styling filters
  const filteredCampaigns = campaigns.filter(c => {
    const matchesPlatform = platformFilter === 'All' || c.platforms.includes(platformFilter as Platform);
    const matchesSearch = searchQuery === '' || 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const filteredAccounts = accounts.filter(a => {
    const matchesPlatform = platformFilter === 'All' || a.platform === platformFilter;
    const matchesSearch = searchQuery === '' || 
      a.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.reason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
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
              <h1 className="text-xl md:text-2xl font-serif italic tracking-tight text-[#F5F5F5] font-semibold">EchoWatch Tracker</h1>
              <span className="text-[9px] font-mono border border-amber-500/30 text-[#D4AF37] font-semibold px-1.5 py-0.5 rounded uppercase tracking-widest bg-amber-500/5">
                v2.6 Live
              </span>
            </div>
            <p className="text-[10px] text-[#A0A0A5] font-mono tracking-wider uppercase">Multi-Platform Disinformation Scanner</p>
          </div>
        </div>

        {/* Desktop Custom Nav Link Tabs */}
        <nav className="hidden lg:flex items-center space-x-8 text-xs uppercase tracking-[0.18em] font-semibold text-[#A0A0A5]">
          <button 
            onClick={() => setActiveTab('campaigns')}
            className={`pb-1 transition-all ${activeTab === 'campaigns' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-campaigns"
          >
            Campaign Intel
          </button>
          <button 
            onClick={() => setActiveTab('accounts')}
            className={`pb-1 transition-all ${activeTab === 'accounts' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-accounts"
          >
            Entity Profiling
          </button>
          <button 
            onClick={() => setActiveTab('graph')}
            className={`pb-1 transition-all ${activeTab === 'graph' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-graph"
          >
            Network Matrix
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`pb-1 transition-all ${activeTab === 'analytics' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-analytics"
          >
            Social Analytics
          </button>
          <button 
            onClick={() => setActiveTab('analyzer')}
            className={`pb-1 transition-all ${activeTab === 'analyzer' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-analyzer"
          >
            Threat Analyzer
          </button>
          <button 
            onClick={() => setActiveTab('reporter')}
            className={`pb-1 transition-all ${activeTab === 'reporter' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'hover:text-[#F5F5F5]'}`}
            id="nav-reporter"
          >
            Log Incident
          </button>
        </nav>

        {/* Security level badge & user */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right">
            <p className="text-[9px] font-mono text-[#66666E] uppercase tracking-wider">Access Integrity Mode</p>
            <p className="text-xs font-bold text-[#D4AF37] opacity-90 font-mono">Level 4: Security Admin</p>
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
              <span className="text-[9px] uppercase tracking-wider text-[#66666E] font-semibold">Campaigns</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-serif text-[#D4AF37] font-bold">{stats.totalCampaigns}</span>
                <span className="text-[10px] text-emerald-400 font-mono">(Active: {stats.activeCampaignsCount})</span>
              </div>
            </div>
            <div className="bg-[#15151A] border border-[#2A2A2E] p-3 rounded-lg flex flex-col justify-between" id="stat-active-buzzers">
              <span className="text-[9px] uppercase tracking-wider text-[#66666E] font-semibold">Nodes Tracked</span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-serif text-[#D4AF37] font-bold">{stats.activeBuzzersCount}</span>
                <span className="text-[10px] text-red-400 font-mono">▲ {stats.avgBotScore}% bot</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#2A2A2E] pt-5">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#66666E]/90 mb-3 flex items-center gap-1.5 font-bold">
              <Fingerprint className="w-3.5 h-3.5 text-[#D4AF37]" /> Filter Platforms
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
              <Search className="w-3.5 h-3.5 text-[#D4AF37]" /> Live Filter Stream
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hashtags, usernames, keywords..."
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
              <Cpu className="w-3.5 h-3.5 text-rose-400" /> OSINT Keyword Discovery
            </h3>
            <form onSubmit={handleKeywordSearch} className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-[#D4AF37]" />
                <input
                  type="text"
                  value={searchKeywordInput}
                  onChange={(e) => setSearchKeywordInput(e.target.value)}
                  placeholder="Masukkan kata kunci (e.g. Pemilu)..."
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
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
            </form>
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

          <div className="mt-auto hidden xl:block pt-4">
            <div className="p-4 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/5 text-[11px] text-[#D4AF37] leading-relaxed relative overflow-hidden">
              <div className="absolute right-1 bottom-1 opacity-10">
                <Cpu className="w-16 h-16 text-amber-400" />
              </div>
              <strong className="block mb-1 font-bold text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> DEEP COGNITION ALERT
              </strong>
              Spike in coordinated copypasta across 3 regional campaigns detected today. Synchronize threat maps utilizing the siber threat engine analysis tab.
            </div>
          </div>
        </aside>

        {/* Dynamic Nav Tabs for Mobile Views */}
        <div className="lg:hidden flex bg-[#0F0F12] border-b border-[#2A2A2E] overflow-x-auto whitespace-nowrap p-2 scrollbar-none" id="mobile-nav-tabs">
          {[
            { id: 'campaigns', label: 'Campaigns' },
            { id: 'accounts', label: 'Suspicious Accounts' },
            { id: 'graph', label: 'Correlation Graph' },
            { id: 'analytics', label: 'Social Analytics' },
            { id: 'analyzer', label: 'Threat Scan' },
            { id: 'reporter', label: 'Report Incident' },
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
                    Filtering: {platformFilter}
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
                      <p className="text-xs">No coordinated campaigns match the current criteria.</p>
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
                          <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                            {camp.intensity.toUpperCase()} THREAT
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
                            {camp.reach.toLocaleString()} reach
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
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 font-mono">Detailed Campaign Profile</span>
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
                              showNotification('success', 'Campaign context copied into Threat Analyzer matrix!');
                            }}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] font-semibold border border-amber-500/20 hover:border-[#D4AF37]/50 text-[11px] font-mono px-2.5 py-1 rounded transition duration-200"
                            id="btn-scan-campaign"
                          >
                            AI Scan Narrative
                          </button>
                        </div>
                      </div>

                      {/* Topic, Description, Key Narrative block */}
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1">Strategic Objective</h5>
                          <p className="text-xs text-slate-300 leading-relaxed bg-[#0F0F12] border border-[#2A2A2E]/70 p-3.5 rounded-lg">
                            {selectedCampaign.description}
                          </p>
                        </div>

                        <div>
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1">Coordinated Core Narrative</h5>
                          <p className="text-xs text-slate-300 leading-relaxed bg-[#0F0F12] border border-[#2A2A2E]/70 p-3.5 rounded-lg border-l-2 border-l-[#D4AF37]">
                            {selectedCampaign.keyNarrative}
                          </p>
                        </div>

                        {/* Coordinated Hashtags */}
                        <div>
                          <h5 className="text-[10px] tracking-widest font-mono uppercase text-slate-500 font-bold mb-1.5">Monitored Amplification Hashtags</h5>
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
                              <span className="text-[10px] font-mono text-slate-500 font-semibold">BOTNET DENSITY</span>
                              <span className="text-xs font-bold font-mono text-rose-400">{Math.round(selectedCampaign.botRatio * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-500 to-rose-600 rounded-full"
                                style={{ width: `${selectedCampaign.botRatio * 100}%` }}
                              ></div>
                            </div>
                            <p className="text-[9px] text-[#A0A0A5] mt-1.5">
                              Percent of volume generated by pre-programmed scheduler algorithms.
                            </p>
                          </div>

                          {/* Network Severity */}
                          <div className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-lg flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-mono text-slate-500 font-semibold">INTENSITY CLASSIFICATION</span>
                              <span className="text-xs font-bold font-mono text-amber-400">{selectedCampaign.intensity}</span>
                            </div>
                            <div className="flex gap-1">
                              {['Low', 'Medium', 'High', 'Critical'].map((lv) => (
                                <span 
                                  key={lv} 
                                  className={`flex-1 h-1 rounded ${
                                    selectedCampaign.intensity === lv ? 'bg-orange-500' : 'bg-slate-800'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-[9px] text-[#A0A0A5] mt-1.5">
                              Campaign prioritization indicator within threat matrix.
                            </p>
                          </div>
                        </div>

                        {/* Reach & Active node details */}
                        <div className="grid grid-cols-3 gap-2 text-center pt-2">
                          <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg">
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block uppercase">Est. Impression</span>
                            <span className="text-sm font-semibold font-serif text-[#D4AF37]">{selectedCampaign.reach.toLocaleString()}</span>
                          </div>
                          <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg">
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block uppercase">Tracked Agents</span>
                            <span className="text-sm font-semibold font-serif text-[#D4AF37]">{selectedCampaign.buzzerCount}</span>
                          </div>
                          <div className="bg-slate-950/70 border border-slate-900 p-2 rounded-lg">
                            <span className="text-[9.5px] font-mono text-slate-500 font-bold block uppercase">Sentiment Bias</span>
                            <span className={`text-sm font-semibold font-serif ${
                              selectedCampaign.sentiment === 'Positive' ? 'text-emerald-400' :
                              selectedCampaign.sentiment === 'Negative' ? 'text-rose-400' :
                              'text-amber-400'
                            }`}>{selectedCampaign.sentiment}</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-slate-500 text-center py-20">
                      <Radio className="w-12 h-12 text-slate-700 stroke-1 mb-3 animate-pulse" />
                      <p className="font-semibold text-sm">Select a campaign in the left listing to inspect details.</p>
                    </div>
                  )}

                  {/* Informative tips */}
                  <div className="mt-6 pt-4 border-t border-[#2A2A2E]/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      Live Feed Start: {selectedCampaign?.startDate || "2026-06"}
                    </span>
                    <span className="italic">ID: {selectedCampaign?.id}</span>
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
                    Pemetaan agen/client botnet, spammer, dan operator manipulator opini publik. Klik untuk membedah.
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
                      <p className="text-xs">No entities match the filters set.</p>
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
                            <p className="text-[11px] text-[#A0A0A5] font-mono mt-0.5">@{acc.username}</p>
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
                            <p className="text-xs text-amber-500 font-mono mt-0.5">@{selectedAccount.username} on {selectedAccount.platform}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                            selectedAccount.status === 'Verified Bot' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            selectedAccount.status === 'Suspended' ? 'bg-zinc-700/20 text-zinc-500 border border-zinc-700/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {selectedAccount.status}
                          </span>
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
                            <span className="text-[10px] tracking-wider font-mono text-slate-400 font-bold uppercase">BOTNET COORDINATION RATING</span>
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
                          <span className="text-[9.5px] font-mono text-slate-500 block uppercase font-bold">Followers</span>
                          <span className="text-sm font-semibold font-mono text-slate-300">{selectedAccount.followers.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                          <span className="text-[9.5px] font-mono text-slate-500 block uppercase font-bold">Following</span>
                          <span className="text-sm font-semibold font-mono text-slate-300">{selectedAccount.following.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                          <span className="text-[9.5px] font-mono text-slate-500 block uppercase font-bold">Copypastas</span>
                          <span className="text-sm font-semibold font-mono text-rose-400">{selectedAccount.recentCopypastaCount} logged</span>
                        </div>
                      </div>

                      {/* Coordination Signals */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] tracking-widest font-mono uppercase text-[#66666E]/90 font-bold mb-2">Coordination Footprints</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-300">
                          <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-900 flex items-start space-x-2">
                            <CornerDownRight className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-200">Temporal Synchronization</p>
                              <p className="text-[11px] text-slate-400 mt-1">Posts within 4 seconds of central hub instructions.</p>
                            </div>
                          </div>
                          <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-900 flex items-start space-x-2">
                            <CornerDownRight className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-slate-200">Repetitive Sentence Trees</p>
                              <p className="text-[11px] text-slate-400 mt-1">Phrases overlap perfectly with known disinformation templates.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-slate-500 text-center py-20">
                      <UserX className="w-12 h-12 text-slate-700 stroke-1 mb-3" />
                      <p className="font-semibold text-sm">Select an account card to inspect the threat levels.</p>
                    </div>
                  )}

                  {/* Footer metadata details */}
                  <div className="mt-6 pt-4 border-t border-[#2A2A2E]/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      Detected Active Signature: {selectedAccount?.lastActive || "Recently"}
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
                  Peta simpul visual koordinasi buzzer. Menghubungkan master server, tagar manipulatif, dan bot penguat pesan.
                </p>
              </div>

              {/* Direct insertion of interactive Network Canvas */}
              <NetworkGraph onSelectNode={handleNodeSelect} reloadTrigger={reloadTrigger} />

              {/* Auxiliary details explaining the map */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#0F0F12] border border-[#2A2A2E] p-5 rounded-2xl relative" id="graph-legends-container">
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-semibold">1. Campaign Hub</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Senter utama (simpul berwarna ungu) mendefinisikan objektif propaganda atau narasi sentral yang disuntikkan.
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-semibold">2. Propagandist Master</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Individu berpengaruh atau server botnet master (simpul oranye) bertindak sebagai distributor/orator pertama.
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-semibold">3. Bot Client Clients</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Client bot & shill (simpul merah) yang secara simultan menduplikasi postingan (copypasta) demi memalsukan viralitas.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* TAB 3.5: Social Accounts & Analytics Dashboard */}
          {activeTab === 'analytics' && (
            <SocialAnalyticsDashboard showNotification={showNotification} reloadTrigger={reloadTrigger} />
          )}

          {/* TAB 4: Gemini-powered Analyzer Playground */}
          {activeTab === 'analyzer' && (
            <div className="space-y-6 animate-fade-in" id="view-analyzer">
              <div>
                <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-[#D4AF37]" />
                  Radar Detektif AI (Heuristic Threat Engine)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tempelkan teks postingan, tautan promosi, atau biografi akun sosial media untuk membedah pola inautentik dan koordinasi buzzer.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Form column */}
                <div className="lg:col-span-5 bg-[#15151A] border border-[#2A2A2E] rounded-xl p-5" id="analyzer-form-container">
                  <h3 className="text-xs font-mono uppercase text-[#D4AF37] tracking-wider font-bold mb-4">Input Parameter Scanner</h3>
                  
                  <form onSubmit={handleRunAnalysis} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">Tipe Analisis</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'copypasta', label: 'Copypasta' },
                          { id: 'profile', label: 'User Bio' },
                          { id: 'campaign', label: 'Campaign' }
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
                      <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5 font-bold">Platform Asal</label>
                      <select
                        value={analyzePlatform}
                        onChange={(e) => setAnalyzePlatform(e.target.value as Platform)}
                        className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-[#D4AF37]"
                        id="select-scan-platform"
                      >
                        <option value="All">Semua Platform (All)</option>
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
                            ? 'Tempelkan beberapa baris komentar atau tweet mencurigakan di sini...' 
                            : analyzeType === 'profile'
                            ? 'Contoh:\nUsername: @budi_nasionalis\nBio: Menolak Lupa, Dukung NKRI #SaveNegara\nFollowers: 12\nFollowing: 1950'
                            : 'Deskripsikan taktik narasi kampanye digital yang dicurigai...'
                        }
                        rows={6}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
                        id="textarea-scan-content"
                      />
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
                          Memproses Threat Matrix...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-black" />
                          RUN DEEP SCANNERS
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Status or Results column */}
                <div className="lg:col-span-7 bg-[#0F0F12] border border-[#2A2A2E] rounded-xl p-5 lg:p-6 min-h-[400px] flex flex-col justify-between" id="analyzer-results-viewport">
                  {isAnalyzing ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-16 space-y-4">
                      {/* Elaborate styled cyber telemetry scanning sequence */}
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin"></div>
                        <BrainCircuit className="w-8 h-8 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-mono font-bold text-amber-500">Menganalisis Sidik Jari Digital...</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1 font-semibold">Cross-referencing boilerplate databases via local threat patterns</p>
                      </div>
                    </div>
                  ) : analysisResult ? (
                    <div className="space-y-5 text-left">
                      {/* Metric headers */}
                      <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-[#66666E]">RADAR SCORE VERDICT</span>
                          <h4 className="text-slate-100 font-bold text-base mt-2 flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${analysisResult.isBuzzer ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                            {analysisResult.verdict}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#66666E]">CONFIDENCE LEVEL</span>
                          <span className={`block font-serif italic text-2xl font-bold mt-1 ${analysisResult.confidenceScore > 75 ? 'text-rose-500' : 'text-[#D4AF37]'}`}>
                            {analysisResult.confidenceScore}%
                          </span>
                        </div>
                      </div>

                      {/* Summary response block */}
                      <div className="bg-[#15151A] border border-[#D4AF37]/20 p-4 rounded-xl leading-relaxed text-xs text-slate-200">
                        <strong className="text-[#D4AF37] block font-mono text-[10.5px] uppercase tracking-wider mb-1.5">Executive Summary Analysis</strong>
                        {analysisResult.summary}
                        {analysisResult.fallback && (
                          <span className="block mt-2.5 text-[9.5px] font-mono text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded inline-block">
                            💡 Offline Simulation Active: Configure process.env.GEMINI_API_KEY in Secrets for live satellite signals.
                          </span>
                        )}
                      </div>

                      {/* Characteristics and Red Flags block */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#15151A]/60 p-4 rounded-xl border border-slate-900">
                          <span className="text-[10.5px] font-mono uppercase text-[#66666E] font-bold block mb-2">Identified Core Traits</span>
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
                          <span className="text-[10.5px] font-mono uppercase text-[#66666E] font-bold block mb-2">Narrative/Topic Vectors</span>
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
                          <span className="text-[10.5px] font-mono uppercase text-red-400 font-bold block mb-2.5">System Red Flag Signals</span>
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
                      <p className="font-semibold text-xs uppercase tracking-wider font-mono">Telemetry Output Ready</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">Provide social content or account biographies in the left input forms to trigger cyber intelligence scanning sequence logs.</p>
                    </div>
                  )}

                  {/* Sandbox warning helper */}
                  <div className="pt-4 border-t border-slate-900 mt-6 text-[10px] text-slate-500 text-center italic font-mono uppercase">
                    Detection threshold matrix parameters verified: Coordinated Inauthentic Behavior standard v4.1
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
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-black" />
                          PUBLISH INCIDENT
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

        </section>
      </main>

      {/* Footer Status Bar representing the Sophisticated Dark look */}
      <footer className="h-10 bg-[#D4AF37] text-black text-[10px] px-6 lg:px-12 flex items-center justify-between font-bold uppercase tracking-wider select-none z-10" id="global-footer">
        <div className="flex space-x-6 overflow-hidden truncate">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse"></span>
            SYSTEM STATUS: OPERATIONAL
          </span>
          <span className="hidden md:inline">LAST SYNC: JUST NOW</span>
          <span className="hidden md:inline">ENCRYPTION: SHA-256</span>
        </div>
        <div className="flex space-x-4">
          <span className="hidden sm:inline">SAT NETWORK: CONSOLIDATED</span>
          <span>ACTIVE COGNITION: ONLINE</span>
        </div>
      </footer>

    </div>
  );
}
