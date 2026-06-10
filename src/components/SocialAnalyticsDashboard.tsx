import React, { useState, useEffect } from 'react';
import { 
  X, 
  Youtube, 
  Video, 
  RefreshCw, 
  Trash2, 
  Plus, 
  TrendingUp, 
  Users, 
  Activity, 
  ThumbsUp, 
  MessageSquare, 
  Share2, 
  Info, 
  UserCheck, 
  MapPin, 
  Layers,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { SocialAccount, SocialPost, DailyEngagement, AudienceDemographics } from '../types';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface SocialAnalyticsDashboardProps {
  showNotification: (type: 'success' | 'error', text: string) => void;
  reloadTrigger?: number;
}

export default function SocialAnalyticsDashboard({ showNotification, reloadTrigger }: SocialAnalyticsDashboardProps) {
  // Accounts and Posts Data State
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [demographics, setDemographics] = useState<AudienceDemographics | null>(null);
  const [timeline, setTimeline] = useState<DailyEngagement[]>([]);
  
  // Interface selection states
  const [selectedPlatform, setSelectedPlatform] = useState<'All' | 'X' | 'YouTube' | 'TikTok'>('All');
  const [selectedMetric, setSelectedMetric] = useState<'likes' | 'comments' | 'shares' | 'reach'>('likes');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Load all analytics dataset elements on mount
  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedPlatform, reloadTrigger]);

  // Handle callback receiver for OAuth popups
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin is from preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
         return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { platform, username } = event.data;
        showNotification('success', `OAuth Connection Success! Authenticated as @${username} on ${platform}`);
        await handleRegisterConnectedAccount(platform, username);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const [accountsRes, postsRes, demoRes, timelineRes] = await Promise.all([
        fetch('/api/social/accounts'),
        fetch('/api/social/posts'),
        fetch(`/api/social/demographics?platform=${selectedPlatform}`),
        fetch('/api/social/engagement')
      ]);

      if (accountsRes.ok && postsRes.ok && demoRes.ok && timelineRes.ok) {
        const accountsData = await accountsRes.json();
        const postsData = await postsRes.json();
        const demoData = await demoRes.json();
        const timelineData = await timelineRes.json();

        setAccounts(accountsData);
        setPosts(postsData);
        setDemographics(demoData);
        setTimeline(timelineData);
      }
    } catch (err) {
      console.error("Error fetching social analytics dataset:", err);
      showNotification('error', 'Failed to pull social channels telemetry.');
    }
  };

  // Launch popup for social authentication
  const handleConnectProfile = async (platform: 'X' | 'YouTube' | 'TikTok') => {
    setConnectingPlatform(platform);
    try {
      const response = await fetch(`/api/social/auth/url?platform=${platform}`);
      if (!response.ok) {
        throw new Error('Failed to fetch auth routing URL.');
      }
      const { url, real } = await response.json();

      showNotification('success', `Opening ${platform} authorization popup...`);

      // Open OAuth provider directly or Sandbox simulator
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=500,height=600,status=no,resizable=yes,scrollbars=yes'
      );

      if (!authWindow) {
        showNotification('error', 'Popup blocked. Please permit pop-ups on this tab to connect accounts.');
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Could not open authentication gateway.');
    } finally {
      setConnectingPlatform(null);
    }
  };

  // Connects social profile on server and synchronizes interface
  const handleRegisterConnectedAccount = async (platform: string, username: string) => {
    try {
      const response = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, username })
      });

      if (response.ok) {
        showNotification('success', `Synchronized profile feed: @${username}`);
        await fetchAnalyticsData();
      } else {
        const errObj = await response.json().catch(() => ({}));
        showNotification('error', errObj.error || 'Error binding account verification.');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'Failed to connect account.');
    }
  };

  // Sync metrics for individual account
  const handleSyncAccount = async (id: string, username: string) => {
    setSyncingId(id);
    try {
      const response = await fetch('/api/social/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('success', data.message);
        await fetchAnalyticsData();
      } else {
        const errObj = await response.json().catch(() => ({}));
        showNotification('error', errObj.error || 'Failed to sync API channels.');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'Sync request failed.');
    } finally {
      setSyncingId(null);
    }
  };

  // Disconnect social profile
  const handleDisconnectAccount = async (id: string, username: string) => {
    if (!confirm(`Apakah Anda yakin ingin mematikan koneksi API untuk @${username}? Postingan dan metrik terkait akan dihapus.`)) {
      return;
    }

    try {
      const response = await fetch('/api/social/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        showNotification('success', `Koneksi @${username} berhasil diputuskan.`);
        await fetchAnalyticsData();
      } else {
        showNotification('error', 'Gagal memutuskan sambungan.');
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed response from disconnect API.');
    }
  };

  // Calculations for filtered posts metrics
  const filteredAccounts = selectedPlatform === 'All' 
    ? accounts 
    : accounts.filter(a => a.platform === selectedPlatform);

  const filteredPosts = selectedPlatform === 'All' 
    ? posts 
    : posts.filter(p => p.platform === selectedPlatform);

  // Total Reach of selected posts
  const aggregateReach = filteredPosts.reduce((sum, p) => sum + p.reach, 0);

  // Total interaction metrics (likes + comments + shares)
  const aggregateInteractions = filteredPosts.reduce((sum, p) => sum + p.likes + p.comments + p.shares, 0);

  // Average Engagement Rate
  const averageEngagementRate = filteredPosts.length > 0
    ? parseFloat((filteredPosts.reduce((sum, p) => sum + p.engagementRate, 0) / filteredPosts.length).toFixed(2))
    : 0.00;

  // Identify Top 5 posts by engagement rate or total actions
  const topPosts = [...filteredPosts]
    .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
    .slice(0, 5);

  // Custom styling elements depending on selected platform colors
  const getPlatformColors = (plat: string) => {
    switch (plat) {
      case 'X': return { text: 'text-zinc-100', border: 'border-zinc-700', bg: 'bg-zinc-950/80', badgeBg: 'bg-zinc-800' };
      case 'YouTube': return { text: 'text-red-400', border: 'border-red-500/25', bg: 'bg-red-950/20', badgeBg: 'bg-red-500/10' };
      case 'TikTok': return { text: 'text-cyan-400', border: 'border-cyan-500/25', bg: 'bg-cyan-950/20', badgeBg: 'bg-cyan-500/10' };
      default: return { text: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-950/10', badgeBg: 'bg-amber-500/10' };
    }
  };

  // Custom tooltips styling for dark mode charts
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#121215] border border-[#D4AF37]/30 p-3.5 rounded-xl shadow-2xl text-left" id="chart-tooltip">
          <p className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-1.5">{label}</p>
          <p className="text-xs text-slate-100 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
            Total {selectedMetric.toUpperCase()}: <span className="font-mono text-[#D4AF37] font-bold">{payload[0].value.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fade-in text-left pb-10" id="social-dashboard">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-serif text-[#F5F5F5] font-semibold flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#D4AF37]" id="title-icon" />
            Integrasi Multi-Platform & Dashboard Analitik
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hubungkan akun X, YouTube, dan TikTok API Anda secara aman untuk memonitor jangkauan postingan dan mendeteksi korelasi manipulasi persepsi publik.
          </p>
        </div>

        {/* Global Select platform switcher for the dashboard */}
        <div className="flex items-center space-x-2 bg-[#121215] border border-[#2A2A2E] px-2 py-1.5 rounded-xl">
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider pl-2.5">Dashboard Focus:</span>
          {['All', 'X', 'YouTube', 'TikTok'].map((plat) => (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat as any)}
              className={`text-xs px-3 py-1 rounded font-semibold transition ${
                selectedPlatform === plat 
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#8A6D3B] text-black font-extrabold shadow-md' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#1A1A1F]'
              }`}
              id={`focus-${plat.toLowerCase()}`}
            >
              {plat}
            </button>
          ))}
        </div>
      </div>

      {/* 1. ACCOUNTS CHANNELS LIST */}
      <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6 relative overflow-hidden" id="accounts-connector-deck">
        <div className="absolute right-3 top-3 opacity-5 pointer-events-none">
          <UserCheck className="w-24 h-24 text-amber-500" />
        </div>
        
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-[#D4AF37] rounded-sm"></span>
              Profil Saluran API Terkoneksi ({accounts.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Permit otentikasi API independen untuk memantau feed metrik secara berkala.</p>
          </div>
          
          {/* Quick instructions indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            SDK Otomatis & Sandbox Simulator Aktif
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Loop accounts */}
          {accounts.map((acc) => {
            const colors = getPlatformColors(acc.platform);
            return (
              <div 
                key={acc.id} 
                className={`bg-[#0F0F12] border ${colors.border} rounded-xl p-4 flex flex-col justify-between transition hover:shadow-lg`} 
                id={`soc-card-${acc.id}`}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[9px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded uppercase ${colors.badgeBg} ${colors.text}`}>
                      {acc.platform}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">Terkoneksi: {acc.connectedAt}</span>
                  </div>

                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#1A1A1F] flex items-center justify-center border border-slate-800 text-sm font-mono font-bold text-[#D4AF37]">
                      {acc.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs text-slate-200 font-bold truncate">{acc.displayName}</h4>
                      <p className="text-[11px] text-slate-500 font-mono truncate">@{acc.username}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center pb-3 border-b border-slate-900 mb-3">
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-900">
                      <span className="text-[9px] font-mono text-slate-600 block font-bold">FOLLOWERS</span>
                      <span className="text-xs font-mono font-bold text-slate-300">{acc.followersCount.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-900">
                      <span className="text-[9px] font-mono text-slate-600 block font-bold">MONITORED</span>
                      <span className="text-xs font-mono font-bold text-slate-300">{acc.postCount} posts</span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button 
                    disabled={syncingId === acc.id}
                    onClick={() => handleSyncAccount(acc.id, acc.username)}
                    className="flex-1 py-1.5 bg-[#1C1C22] hover:bg-[#25252D] text-slate-300 hover:text-white border border-slate-800 rounded font-mono text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                    id={`btn-sync-${acc.id}`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${syncingId === acc.id ? 'animate-spin' : ''}`} />
                    Sync API
                  </button>
                  <button 
                    onClick={() => handleDisconnectAccount(acc.id, acc.username)}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded hover:border-rose-400 transition"
                    title="Disconnect account feed"
                    id={`btn-disc-${acc.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Connect Accounts Cards */}
          {['X', 'YouTube', 'TikTok'].map((plat) => {
            const isConnected = accounts.some(a => a.platform === plat);
            if (isConnected) return null; // already connected, keep things clean
            
            return (
              <div 
                key={plat} 
                className="bg-[#0F0F12]/40 border-2 border-dashed border-slate-800 rounded-xl p-5 flex flex-col justify-center items-center text-center hover:border-amber-500/40 transition"
                id={`add-soc-${plat.toLowerCase()}`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 text-sm">
                  {plat === 'X' ? <span className="font-mono font-bold">X</span> :
                   plat === 'YouTube' ? <Youtube className="w-4 h-4 stroke-1.5" /> : 
                   <Video className="w-4 h-4 stroke-1.5" />}
                </div>
                <h4 className="text-xs text-slate-300 font-bold mb-1">Hubungkan {plat} API</h4>
                <p className="text-[10px] text-slate-500 max-w-xs mb-4 leading-normal">Otentikasikan profil {plat} Anda untuk menarik jangkauan post digital.</p>
                
                <button
                  onClick={() => handleConnectProfile(plat as any)}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[#D4AF37] hover:border-[#D4AF37] transition font-mono text-[10.5px] font-bold rounded-lg flex items-center gap-1.5"
                  id={`btn-connect-${plat.toLowerCase()}`}
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                  LINK PROFILE
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CORE AGGREGATE DASHBOARD METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="aggregate-metrics-cards">
        <div className="bg-[#15151A] border border-[#2A2A2E] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[9.5px] font-mono text-slate-500 uppercase font-bold tracking-wider">Connected Accounts</span>
          <div className="flex items-baseline space-x-1.5 mt-2.5">
            <span className="text-2xl font-serif text-[#D4AF37] font-bold" id="metric-accounts-count">{filteredAccounts.length}</span>
            <span className="text-[10.5px] text-slate-500 font-mono">active channels</span>
          </div>
        </div>
        
        <div className="bg-[#15151A] border border-[#2A2A2E] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[9.5px] font-mono text-slate-500 uppercase font-bold tracking-wider">Est. Audience Reach</span>
          <div className="flex items-baseline space-x-1.5 mt-2.5">
            <span className="text-2xl font-serif text-[#D4AF37] font-bold" id="metric-total-reach">{aggregateReach.toLocaleString()}</span>
            <span className="text-[10.5px] text-slate-500 font-mono">impressions</span>
          </div>
        </div>

        <div className="bg-[#15151A] border border-[#2A2A2E] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[9.5px] font-mono text-slate-500 uppercase font-bold tracking-wider">Average Engagement</span>
          <div className="flex items-baseline space-x-1.5 mt-2.5">
            <span className="text-2xl font-serif text-[#D4AF37] font-bold" id="metric-avg-engagement">{averageEngagementRate}%</span>
            <span className="text-[10.5px] text-slate-500 font-mono">rating score</span>
          </div>
        </div>

        <div className="bg-[#15151A] border border-[#2A2A2E] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[9.5px] font-mono text-slate-500 uppercase font-bold tracking-wider">Aggregate Interactions</span>
          <div className="flex items-baseline space-x-1.5 mt-2.5">
            <span className="text-2xl font-serif text-[#D4AF37] font-bold" id="metric-total-reactions">{aggregateInteractions.toLocaleString()}</span>
            <span className="text-[10.5px] text-slate-500 font-mono">actions logged</span>
          </div>
        </div>
      </div>

      {/* 3. CHART & TOP 5 POSTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-core-visualization">
        
        {/* Left 8 columns: Timeseries metrics chart */}
        <div className="lg:col-span-8 bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-5 lg:p-6 flex flex-col justify-between" id="engagement-time-chart-container">
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-800 pb-4 mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-[#D4AF37] rounded-sm"></span>
                  Gagasan Keterlibatan Historis (Timeline Tren)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Analisis tren interaksi harian dari seluruh postingan akun terkoneksi.</p>
              </div>

              {/* Chart Metric Selection Toggle Toggles */}
              <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
                {[
                  { id: 'likes', label: 'Likes' },
                  { id: 'comments', label: 'Comments' },
                  { id: 'shares', label: 'Shares' },
                  { id: 'reach', label: 'Reach' }
                ].map((met) => (
                  <button
                    key={met.id}
                    onClick={() => setSelectedMetric(met.id as any)}
                    className={`text-[10.5px] font-mono px-2 py-1 rounded transition font-semibold ${
                      selectedMetric === met.id 
                        ? 'bg-[#1C1C22] text-[#D4AF37] font-bold border border-amber-500/20' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    id={`toggle-metric-${met.id}`}
                  >
                    {met.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts responsive area container */}
            <div className="h-72 w-full" id="timeline-chart">
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeline}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#444" 
                      fontSize={9} 
                      fontFamily="monospace"
                      tickFormatter={(d) => d.substring(5)}
                    />
                    <YAxis 
                      stroke="#444" 
                      fontSize={9} 
                      fontFamily="monospace"
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      stroke="#D4AF37" 
                      strokeWidth={1.8}
                      fillOpacity={1} 
                      fill="url(#colorMetric)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs font-mono uppercase">
                  Data feed unavailable. Connect a profile first.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900 mt-4 text-[10.5px] text-slate-500 flex items-center justify-between font-mono">
            <span>METRIC MATRIX TIMEFRAME: L-14 DAYS</span>
            <span>SYSTEM CONVERSION EXTRAPOLATION: SECURE ON-CHAIN</span>
          </div>
        </div>

        {/* Right 4 columns: Top 5 posts listed */}
        <div className="lg:col-span-4 bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-5 lg:p-6 flex flex-col justify-between" id="top-posts-feed-container">
          <div>
            <div className="border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-[#D4AF37] rounded-sm"></span>
                Top 5 Postings ({selectedPlatform})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Postingan tersaring dengan volume interaksi agregat terbanyak.</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {topPosts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No social posts captured. Connect profiles to load posts.
                </div>
              ) : (
                topPosts.map((post, index) => {
                  const aggregateEng = post.likes + post.comments + post.shares;
                  return (
                    <div 
                      key={post.id} 
                      className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl leading-relaxed text-xs relative hover:border-slate-800 transition"
                      id={`top-post-card-${post.id}`}
                    >
                      {/* Ranking badge */}
                      <span className="absolute top-2.5 right-2 text-[10px] font-mono font-black text-[#D4AF37] bg-[#D4AF37]/10 w-5 h-5 rounded-full flex items-center justify-center border border-amber-500/20">
                        #{index + 1}
                      </span>

                      <div className="flex items-center space-x-1.5 mb-1.5 pr-8">
                        <span className="font-mono text-[10px] text-amber-500">@{post.authorUsername}</span>
                        <span className="text-[8.5px] text-slate-600 font-mono font-bold uppercase">● {post.platform}</span>
                      </div>

                      <p className="text-slate-300 text-[11.5px] line-clamp-2 mb-2 leading-relaxed font-sans">{post.text}</p>
                      
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-900/60">
                        {/* Compact metrics info */}
                        <div className="flex items-center space-x-2">
                          <span className="flex items-center gap-0.5" title="Likes">
                            <ThumbsUp className="w-3 h-3 text-zinc-600" /> {post.likes}
                          </span>
                          <span className="flex items-center gap-0.5" title="Comments">
                            <MessageSquare className="w-3 h-3 text-zinc-600" /> {post.comments}
                          </span>
                          <span className="flex items-center gap-0.5" title="Reaction/Shares">
                            <Share2 className="w-3 h-3 text-zinc-600" /> {post.shares}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#D4AF37]">{aggregateEng.toLocaleString()} acts</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-900 mt-4 text-[10.5px] text-slate-500 font-mono text-center">
            Penyaringan dihitung otomatis berdasarkan: (likes+comments+shares)
          </div>
        </div>

      </div>

      {/* 4. AUDIENCE DEMOGRAPHICS SUMMARY */}
      <div className="bg-[#15151A] border border-[#2A2A2E] rounded-2xl p-6 relative overflow-hidden" id="audience-demographics-container">
        
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-[#D4AF37] rounded-sm"></span>
              Profil & Demografi Audiens Terbuka ({selectedPlatform} Platform)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Proporsi segmentasi usia, gender, dan sebaran wilayah pengkutkut yang direkaput oleh API.</p>
          </div>
          
          <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded">
            <Info className="w-3.5 h-3.5 text-zinc-500" /> Securing API Metadata Access
          </div>
        </div>

        {demographics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Age groups indicator */}
            <div className="space-y-4">
              <h4 className="text-[11.5px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Users className="w-4 h-4 text-amber-500 stroke-1.5" /> Segmentasi Kelompok Usia (%)
              </h4>
              <div className="space-y-3.5">
                {demographics.ageBreakdown.map((seg) => (
                  <div key={seg.category} className="space-y-1" id={`demo-age-${seg.category}`}>
                    <div className="flex justify-between text-xs font-mono text-slate-300">
                      <span>Usia {seg.category}</span>
                      <span className="font-bold text-[#D4AF37]">{seg.value}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-[#8A6D3B] rounded-full"
                        style={{ width: `${seg.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gender groups indicator */}
            <div className="space-y-4">
              <h4 className="text-[11.5px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <UserCheck className="w-4 h-4 text-emerald-500 stroke-1.5" /> Distribusi Gender (%)
              </h4>
              <div className="space-y-4 pt-2">
                {demographics.genderBreakdown.map((seg) => (
                  <div key={seg.category} className="p-3.5 bg-slate-900/40 border border-slate-900 rounded-xl relative overflow-hidden" id={`demo-gender-${seg.category.toLowerCase()}`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300">{seg.category === 'Male' ? 'Laki-laki (Male)' : seg.category === 'Female' ? 'Perempuan (Female)' : 'Lainnya (Non-binary)'}</span>
                      <span className="font-mono font-bold text-sm text-[#D4AF37]">{seg.value}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2.5 border border-slate-900">
                      <div 
                        className={`h-full rounded-full ${
                          seg.category === 'Male' ? 'bg-blue-500' :
                          seg.category === 'Female' ? 'bg-pink-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${seg.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Region Sebaran Geografis indicator */}
            <div className="space-y-4">
              <h4 className="text-[11.5px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <MapPin className="w-4 h-4 text-violet-500 stroke-1.5" /> Sebaran Geografis Teratas
              </h4>
              <div className="space-y-3">
                {demographics.regionBreakdown.map((seg, idx) => (
                  <div key={seg.category} className="flex justify-between items-center p-2.5 bg-slate-950/60 border border-slate-900 rounded-lg text-xs font-mono" id={`demo-region-${idx}`}>
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="text-[10px] text-slate-600 font-bold">0{idx + 1}.</span>
                      {seg.category}
                    </span>
                    <span className="font-bold text-[#D4AF37]">{seg.value}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="py-20 text-center text-slate-500 text-xs font-mono">
            Demographic profiling is loading or unavailable. Use the API connectors to register feed data channels.
          </div>
        )}
      </div>

    </div>
  );
}
