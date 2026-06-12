import type { AnalysisResponse } from '../domain/entities/index.ts';
import type { IGeminiRepository } from '../domain/repositories/IGeminiRepository.ts';
import { AIService, AIConfig } from '../../infrastructure/services/AIService.ts';

export class AnalyzeThreatUseCase {
  private geminiRepo: IGeminiRepository;

  constructor(geminiRepo: IGeminiRepository) {
    this.geminiRepo = geminiRepo;
  }

  async execute(type: string, content: string, platform: string): Promise<AnalysisResponse> {
    const config = this.getAIConfig();
    
    if (config.apiKey) {
      try {
        const result = await AIService.analyze(content, config);
        // Tambahkan penanda bahwa ini hasil AI
        result.summary = `[MODE AI: ${config.provider}] ${result.summary}`;
        return result;
      } catch (err) {
        console.error("AI Analysis failed, falling back to heuristic:", err);
      }
    }
    
    const result = this.fallbackHeuristic(type, content, platform);
    // Tambahkan penanda bahwa ini hasil Heuristik
    result.summary = `[MODE HEURISTIK] ${result.summary}`;
    return result;
  }

  private getAIConfig(): AIConfig {
    if (typeof window === 'undefined') return { provider: 'Gemini', model: 'gemini-pro', apiKey: '' };
    
    const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
    const model = localStorage.getItem('selectedModel') || 'gemini-1.5-flash';
    const apiKey = localStorage.getItem(`api-key-${provider}`) || '';
    
    return { provider, model, apiKey };
  }

  private fallbackHeuristic(type: string, content: string, platform: string): AnalysisResponse {
    const lowercaseContent = content.toLowerCase();
    
    // 1. Scoring Engine (Matrix)
    let score = 0;
    const characteristics: string[] = [];
    const redFlags: any[] = [];
    const narratives: string[] = [];

    // A. Keyword & Phrase Analysis (Bobot Tinggi)
    const agitasiTerms = [
      "boikot", "anti", "palsu", "bayaran", "admin", "buzzer", "rupiah", "opini", 
      "rezim", "grup", "gabung", "terpercaya", "amanah", "gacor", "jasa", "promo",
      "kawal", "kendor", "kadrun", "cebong", "kampret", "pemerintah gagal", 
      "rakyat sengsara", "curang", "fitnah", "hoax", "tangkap", "turunkan", "radikal"
    ];
    
    const matchedTerms = agitasiTerms.filter(t => lowercaseContent.includes(t));
    score += matchedTerms.length * 15;
    if (matchedTerms.length > 0) {
      characteristics.push(`Terdeteksi ${matchedTerms.length} kata kunci agitasi/propaganda.`);
      narratives.push(`Amplifikasi narasi: ${matchedTerms.slice(0, 2).join(', ')}`);
    }

    // B. Structure Analysis
    const hashtagCount = (content.match(/#/g) || []).length;
    if (hashtagCount >= 3) {
      score += 25;
      characteristics.push("Spamming hashtag terdeteksi (High Density).");
      redFlags.push({ title: "Hashtag Abuse", description: "Penggunaan tagar berlebihan untuk manipulasi algoritma.", severity: "high" });
    }

    const uppercaseRatio = (content.replace(/[^A-Z]/g, '').length) / (content.length || 1);
    if (uppercaseRatio > 0.4) {
      score += 20;
      characteristics.push("Penggunaan huruf kapital berlebihan (Agitasi visual).");
    }

    // C. Copypasta Check (Simulasi - jika teks sangat pendek dan mengandung instruksi)
    if (content.length < 50 && (content.includes("Ayo") || content.includes("Kawal"))) {
      score += 30;
      characteristics.push("Pola kalimat instruksional boilerplate.");
    }

    // D. Profile Metadata Analysis (Jika input adalah JSON profil)
    if (type === 'profile' || content.includes('{')) {
      try {
        const profile = JSON.parse(content);
        if (profile.followers / (profile.following || 1) < 0.2) {
          score += 40;
          characteristics.push("Rasio Follower/Following sangat rendah (Indikasi akun ternak).");
          redFlags.push({ title: "Inauthentic Account Ratio", description: "Akun mengikuti jauh lebih banyak orang daripada pengikutnya.", severity: "high" });
        }
      } catch (e) {}
    }

    // Final Verdict
    let isBuzzer = score >= 60;
    let verdict: any = 'Genuine Account';
    let summary = '';

    if (score >= 85) {
      verdict = 'Coordinated Botnet Client';
      summary = 'DETEKSI KRITIS (Heuristik): Pola koordinasi sangat kuat. Teks mengandung elemen propaganda masif dan indikasi manipulasi algoritma.';
    } else if (score >= 60) {
      verdict = 'Suspected Social Buzzer';
      summary = 'PERINGATAN (Heuristik): Akun menunjukkan perilaku anomali. Gaya bahasa dan penggunaan tagar menyerupai pola akun pendukung terorganisir.';
    } else {
      verdict = 'Genuine Account';
      summary = 'AMAN (Heuristik): Aktivitas terlihat organik. Tidak ditemukan pola koordinasi atau botnet yang signifikan dalam konten ini.';
    }

    const sentimentScore = matchedTerms.some(t => ["boikot", "curang", "gagal", "fitnah"].includes(t)) ? -80 : 0;

    return {
      isBuzzer,
      confidenceScore: Math.min(99, score),
      botCharacteristics: characteristics.length > 0 ? characteristics : ["Pola tulisan organik"],
      sentimentScore,
      detectedNarratives: narratives.length > 0 ? narratives : ["Opini publik umum"],
      summary,
      redFlags,
      verdict
    };
  }
}

