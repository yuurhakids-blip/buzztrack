import React from 'react';
import { Campaign, SuspiciousAccount } from '../types';
import { ShieldAlert, TrendingUp, Users, Target, CheckCircle2, MessageSquare, Flame } from 'lucide-react';

interface CampaignDetailsProps {
  campaign: Campaign;
  suspiciousAccounts: SuspiciousAccount[];
  onBack?: () => void;
}

export default function CampaignDetails({ campaign, suspiciousAccounts, onBack }: CampaignDetailsProps) {
  // Filter accounts associated with the platform of the campaign
  const associatedAccounts = suspiciousAccounts.filter(
    acc => campaign.platforms.includes(acc.platform)
  );

  // Hardcode representative posts/comments based on campaign keywords for rich realism
  const getCopypastaSamples = (title: string): string[] => {
    switch (title) {
      case '#BicaraFaktaTolBaru':
        return [
          "Tol Baru Smart Highway ini adalah solusi kemacetan masa depan! Jangan percaya isu lingkungan buatan yang ingin menghambat kemajuan ekonomi Indonesia! 👍🇮🇩 #BicaraFaktaTolBaru #TolSmartModern",
          "Keluarga saya sudah mencoba jalur baru, hemat waktu sampai 2 jam. Tol ini luar biasa membantu roda logistik dan perjalanan rakyat kecil. Mantap proyeknya! #BicaraFaktaTolBaru #InfrastrukturMaju",
          "Jangan mau diprovokasi LSM asing! Pembangunan tol smart modern ini sepenuhnya transparan dan berdampak positif bagi masyarakat lokal di sekitarnya. Dukung terus! #BicaraFaktaTolBaru"
        ];
      case '#BoikotPanganXCorp':
        return [
          "SUDAH LIHAT VIDEO BURUH DI-PHK SEPIHAK?? Kejam sekali manajemen XCorp ini! KITA HARUS AMBIL SIKAP NYATA! BOIKOT PRODUK MEREKA SEKARANG JUGA! 💔😡 #BoikotPanganXCorp #BuruhTertindas",
          "Jangan biarkan korporasi serakah menindas hak buruh lokal! Ganti konsumsi rumah tangga Anda dengan produk alternatif lain yang lebih peduli rakyat. #BoikotPanganXCorp #BuruhTertindas #XCorpSakit",
          "Keadilan harus ditegakkan! Karyawan dituntut lembur tanpa kompensasi layak. Stop beli semua cemilan dan mie instan produksi XCorp! Kirim pesan keras! #BoikotPanganXCorp"
        ];
      case '#DukungRUUSehat':
        return [
          "RUU Kesehatan baru merapikan regulasi medis agar puskesmas di pelosok dapat dokter spesialis dengan mudah. Ayo kawal pengesahannya sekarang! #DukungRUUSehat #KesehatanUntukSemua",
          "Reformasi medis sangat krusial saat ini. Birokrasi STR lama menyulitkan pengabdian dokter muda. Semoga dengan UU baru, akses kesehatan jadi lebih merata 🙏 #DukungRUUSehat",
          "Demi pelayanan dokter yang profesional, adil, bebas pungli sistematis, kita butuh payung hukum kuat. Sepenuhnya menyuarakan #DukungRUUSehat #KesehatanUntukSemua #ReformasiMedis"
        ];
      default:
        return [
          `Sepenuhnya menyuarakan langkah positif demi stabilitas bersama! Mari rapatkan barisan dukung kelancaran program ini. ${campaign.title} adalah solusi!`,
          `Jangan terpengaruh provokasi negatif dari pihak yang ingin memecah belah opini publik. Suarakan kebenaran secara sehat! ${campaign.title}`,
          `Sangat berterima kasih atas inisiatif cepat pemerintah/korporat dalam menangani hal ini. Kami di akar rumput sangat terbantu. ${campaign.title}`
        ];
    }
  };

  const copypastas = getCopypastaSamples(campaign.title);

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6" id={`camp-details-${campaign.id}`}>
      {/* Header and intensity panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/80 pb-6">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mb-2 flex items-center gap-1 cursor-pointer"
            >
              ← Back to Overview
            </button>
          )}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              {campaign.title}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              campaign.intensity === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' :
              campaign.intensity === 'High' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
              'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}>
              {campaign.intensity} Threat
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
            {campaign.description}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-xs">
          <span className="text-slate-500">Topic:</span>
          <span className="text-slate-300 font-bold">{campaign.topic}</span>
        </div>
      </div>

      {/* Grid statistics metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-950/75 rounded-xl border border-slate-900 p-4">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-xs font-bold font-mono tracking-wider uppercase">Bot / Humanness Ratio</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {Math.round(campaign.botRatio * 100)}%
            </span>
            <span className="text-[10px] text-rose-500 font-semibold">BOTNET TRAFFIC</span>
          </div>
          <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${campaign.botRatio * 100}%` }}></div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-950/75 rounded-xl border border-slate-900 p-4">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-xs font-bold font-mono tracking-wider uppercase">Estimated Narrative Reach</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {(campaign.reach / 1000000).toFixed(1)}M
            </span>
            <span className="text-[10px] text-emerald-500 font-semibold">GLOBAL IMPRESSIONS</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Aggregated across all tracked hashtags.</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-950/75 rounded-xl border border-slate-900 p-4">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-xs font-bold font-mono tracking-wider uppercase">Buzzer Nodes Engaged</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100 font-mono">
              {campaign.buzzerCount}
            </span>
            <span className="text-[10px] text-blue-400 font-semibold">ACTIVE ACCOUNTS</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Active state within the last 24 hours.</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-950/75 rounded-xl border border-slate-900 p-4">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-xs font-bold font-mono tracking-wider uppercase">Primary Narrative Sentiment</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl font-black font-mono ${
              campaign.sentiment === 'Negative' ? 'text-red-400' :
              campaign.sentiment === 'Positive' ? 'text-emerald-400' :
              'text-yellow-400'
            }`}>
              {campaign.sentiment}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">BIAS INDEX</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Sentiment polarization directed at targets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Copypasta / Template Spreading Analysis */}
        <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-5 space-y-4">
          <h3 className="text-sm font-bold/80 tracking-wider text-indigo-400 uppercase font-mono flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Detected Spreader Templates (Copypasta)
          </h3>
          <p className="text-xs text-slate-400">
            These boilerplate patterns are copy-pasted across dozens of different puppet accounts with minute alterations or identical tags to artificially trending issues.
          </p>

          <div className="space-y-3">
            {copypastas.map((text, i) => (
              <div key={i} className="bg-slate-950 p-3.5 rounded-lg border border-slate-900/80 text-xs text-slate-300 font-sans relative overflow-hidden">
                <span className="absolute top-2 right-2 text-[9px] font-mono text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/50">
                  Pattern {i + 1}
                </span>
                <p className="pr-12 leading-relaxed italic text-slate-300">"{text}"</p>
                <div className="mt-2.5 flex items-center gap-2 text-[10px] text-red-400 font-mono">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                  <span>Spam-Similarity Score: 98.4% match</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Associated Tracked Social Accounts / Buzzers */}
        <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-5 space-y-4">
          <h3 className="text-sm font-bold/80 tracking-wider text-indigo-400 uppercase font-mono flex items-center gap-2">
            <Target className="w-4 h-4" />
            Active Buzzer Clients Identified ({associatedAccounts.length})
          </h3>
          <p className="text-xs text-slate-400">
            Accounts participating in this campaign containing high similarity scores or immediate synchronization delays.
          </p>

          <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
            {associatedAccounts.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-12">
                No active standalone buzzer clients flagged for {campaign.platforms.join('/')} platforms.
              </div>
            ) : (
              associatedAccounts.map((acc) => (
                <div key={acc.id} className="bg-slate-950 p-3 rounded-lg border border-slate-900/60 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300">
                      {acc.platform}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">@{acc.username}</div>
                      <div className="text-[10px] text-slate-500">{acc.displayName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Bot Score</div>
                      <div className="font-mono text-red-400 font-bold">{acc.botScore}%</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                      acc.status === 'Verified Bot' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      acc.status === 'Suspended' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      'bg-orange-500/10 text-orange-400'
                    }`}>
                      {acc.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="pt-2 bg-slate-950/20 rounded p-3 border border-slate-900">
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span>We share metadata signatures with decentralized moderation coalitions to optimize defense profiles.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
