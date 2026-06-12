import { AnalysisResponse } from '../../core/domain/entities';
import { AICache } from '../../utils/cache';

export interface AIConfig {
  provider: 'Gemini' | 'OpenRouter';
  model: string;
  apiKey: string;
}

export class AIService {
  static async analyze(content: string, config: AIConfig): Promise<AnalysisResponse> {
    const cacheKey = AICache.generateKey('analyze', content + config.model);
    const cached = AICache.get<AnalysisResponse>(cacheKey);
    if (cached) return cached;

    const { provider, model, apiKey } = config;
    
    let result: AnalysisResponse;
    if (provider === 'Gemini') {
      result = await this.callGemini(content, model, apiKey);
    } else {
      result = await this.callOpenRouter(content, model, apiKey);
    }
    AICache.set(cacheKey, result);
    return result;
  }

  private static async callGemini(content: string, model: string, key: string): Promise<AnalysisResponse> {
    const url = `/api/proxy/gemini/generate?model=${model}&key=${key}`;
    const prompt = `Analisis apakah teks ini buzzer/bot media sosial. Teks: "${content}". 
    Berikan jawaban dalam format JSON (Bahasa Indonesia): { "isBuzzer": boolean, "confidenceScore": number, "botCharacteristics": string[], "sentimentScore": number, "detectedNarratives": string[], "summary": string, "verdict": string }`;
    
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    // Jika token habis atau error, fallback
    if (result.error) throw new Error(result.error.message || 'Gemini API error');
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return this.parseAIResponse(text, model, 'Gemini');
  }

  private static async callOpenRouter(content: string, model: string, key: string): Promise<AnalysisResponse> {
    const url = `/api/proxy/openrouter/chat`;
    const prompt = `Analisis apakah teks ini buzzer/bot media sosial. Teks: "${content}". 
    Berikan jawaban dalam format JSON (Bahasa Indonesia): { "isBuzzer": boolean, "confidenceScore": number, "botCharacteristics": string[], "sentimentScore": number, "detectedNarratives": string[], "summary": string, "verdict": string }`;
    
    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }]
    };
    
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://buzztrack.ai', 'X-Title': 'BuzzTrack AI' }, body: JSON.stringify(payload) });
    const result = await response.json();
    // Jika token habis atau error, fallback
    if (result.error) throw new Error(result.error.message || 'OpenRouter API error');
    const text = result.choices?.[0]?.message?.content || '{}';
    return this.parseAIResponse(text, model, 'OpenRouter');
  }

  private static parseAIResponse(text: string, model: string, source: string): AnalysisResponse {
    try {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanJson);
      return {
        isBuzzer: !!parsed.isBuzzer,
        confidenceScore: parsed.confidenceScore || 50,
        botCharacteristics: parsed.botCharacteristics || [],
        sentimentScore: parsed.sentimentScore || 0,
        detectedNarratives: parsed.detectedNarratives || [],
        summary: parsed.summary || 'No summary',
        redFlags: [],
        verdict: parsed.verdict || 'Suspected Social Buzzer'
      };
    } catch {
      return {
        isBuzzer: false,
        confidenceScore: 0,
        botCharacteristics: [`Failed to parse ${source} (${model}) response`],
        sentimentScore: 0,
        detectedNarratives: [],
        summary: 'Error parsing AI response',
        redFlags: [],
        verdict: 'Genuine Account'
      };
    }
  }

  static async clusterNetwork(
    nodes: any[],
    links: any[],
    config: AIConfig,
    platformFilter: string = 'All'
  ): Promise<{ clusters: any[], mode: 'AI' | 'Heuristic' }> {
    const cacheKey = AICache.generateKey('cluster', `${nodes.length}_${links.length}_${config.model}_${platformFilter}`);
    const cached = AICache.get<{ clusters: any[], mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    const filteredNodes = platformFilter === 'All' ? nodes : nodes.filter(n => n.platform === platformFilter);
    const filteredLinks = links.filter(l => filteredNodes.find(n => n.id === l.source) && filteredNodes.find(n => n.id === l.target));

    const { provider, model, apiKey } = config;
    const prompt = `Analyze this network graph of social media accounts (Platform Filter: ${platformFilter}). 
    Nodes: ${JSON.stringify(filteredNodes.slice(0, 20))}... 
    Links: ${JSON.stringify(filteredLinks.slice(0, 30))}...
    Identify potential botnet clusters within this platform. Return JSON with cluster assignments: { "clusters": [{ "clusterId": "string", "nodeIds": ["string"], "reason": "string" }] }`;

    try {
      const resp = await (provider === 'Gemini' ? this.callGeminiRaw(prompt, model, apiKey) : this.callOpenRouterRaw(prompt, model, apiKey));
      const cleanJson = resp.replace(/```json/g, '').replace(/```/g, '');
      const result = { clusters: JSON.parse(cleanJson).clusters, mode: 'AI' as const };
      AICache.set(cacheKey, result);
      return result;
    } catch {
      return { clusters: [], mode: 'Heuristic' };
    }
  }

  static async generateEvidence(posts: any[], config: AIConfig, context?: string): Promise<{ summary: string, mode: 'AI' | 'Heuristic' }> {
    // Buat cache key yang lebih unik dengan context (jika ada) dan preview konten
    const contentPreview = posts.slice(0, 3).map(p => (p.text || '').substring(0, 50)).join('|');
    const cacheKey = AICache.generateKey('evidence', `${contentPreview}_${config.model}_${context || ''}`);
    const cached = AICache.get<{ summary: string, mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    // Cek apakah posts adalah ringkasan kampanye (bukan postingan asli)
    const isCampaignSummary = posts.length === 1 && posts[0]?.text?.includes('Judul:');
    
    const { provider, model, apiKey } = config;
    const prompt = isCampaignSummary 
      ? `Tinjau ringkasan kampanye berikut dan berikan ringkasan intelijen singkat (2-3 kalimat Bahasa Indonesia) tentang kemungkinan perilaku tidak otentik yang terkoordinasi: ${posts[0].text}`
      : `Tinjau postingan berikut dan berikan ringkasan poin-poin bukti perilaku tidak otentik yang terkoordinasi (CIB) dalam Bahasa Indonesia. Postingan: ${JSON.stringify(posts.slice(0, 10))}`;

    try {
      if (!apiKey) throw new Error("No API Key");
      const resp = await (provider === 'Gemini' ? this.callGeminiRaw(prompt, model, apiKey) : this.callOpenRouterRaw(prompt, model, apiKey));
      const result = { summary: typeof resp === 'string' ? resp : (resp.summary || "Bukti terkumpul."), mode: 'AI' as const };
      AICache.set(cacheKey, result);
      return result;
    } catch (e) {
      // Heuristic yang lebih informatif, tergantung apakah ini ringkasan kampanye atau postingan
      let heuristicSummary = "";
      if (isCampaignSummary && posts[0]?.text) {
        // Ekstrak informasi dari ringkasan kampanye
        const text = posts[0].text;
        const judulMatch = text.match(/Judul: (.+)/);
        const platformMatch = text.match(/Platform: (.+)/);
        const intensitasMatch = text.match(/Intensitas: (.+)/);
        const rasioBotMatch = text.match(/Rasio Bot: (\d+)%/);
        
        const judul = judulMatch ? judulMatch[1] : "Kampanye";
        const platform = platformMatch ? platformMatch[1] : "multi-platform";
        const intensitas = intensitasMatch ? intensitasMatch[1] : "Medium";
        const rasioBot = rasioBotMatch ? rasioBotMatch[1] : "50";
        
        heuristicSummary = `Kampanye "${judul}" terdeteksi aktif di ${platform} dengan intensitas ${intensitas}. Sekitar ${rasioBot}% aktivitas menunjukkan indikasi akun buzzer terkoordinasi yang menyebarkan narasi serentak.`;
      } else if (posts.length > 0) {
        heuristicSummary = `Terdeteksi ${posts.length} postingan yang menunjukkan pola kemiripan tinggi, kemungkinan sebagai bagian dari upaya penyebaran narasi terkoordinasi.`;
      } else {
        heuristicSummary = "Data postingan tidak cukup untuk analisis AI.";
      }
      
      return { summary: heuristicSummary, mode: 'Heuristic' };
    }
  }

  private static async callGeminiRaw(prompt: string, model: string, key: string): Promise<any> {
    const url = `/api/proxy/gemini/generate?model=${model}&key=${key}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error.message || 'Gemini API error');
      return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static async callOpenRouterRaw(prompt: string, model: string, key: string): Promise<any> {
    const url = `/api/proxy/openrouter/chat`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
        signal: controller.signal
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error.message || 'OpenRouter API error');
      return result.choices?.[0]?.message?.content || "";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async analyzeTrend(trendData: any, config: AIConfig): Promise<{ insight: string, mode: 'AI' | 'Heuristic' }> {
    const { provider, model, apiKey } = config;
    const cacheKey = AICache.generateKey('trend', JSON.stringify(trendData));
    const cached = AICache.get<{ insight: string }>(cacheKey);
    if (cached) return { ...cached, mode: 'AI' };

    // Fallback heuristic terlebih dahulu jika tidak ada API key atau token habis
    const generateHeuristicInsight = (data: any) => {
      if (!data) return "[MODE HEURISTIK] Belum ada data tren yang cukup untuk analisis.";
      const { platforms, totalPosts, dominantPlatform, overallSentiment } = data;
      const platformNames = Object.keys(platforms || {}).join(', ');
      return `[MODE HEURISTIK] Hari ini terpantau ${totalPosts || 0} postingan di ${platformNames || 'beberapa platform'}, dengan dominasi di ${dominantPlatform || 'platform utama'} dan sentimen keseluruhan ${overallSentiment || 'netral'}.`;
    };

    // Jika tidak ada API key, langsung fallback
    if (!apiKey) {
      return { insight: generateHeuristicInsight(trendData), mode: 'Heuristic' };
    }

    const prompt = `Analisis data tren media sosial hari ini: ${JSON.stringify(trendData)}. 
    Berikan insight singkat (1-2 kalimat Bahasa Indonesia) mengenai dinamika platform dan dominasi narasi.`;

    try {
      const resp = await (provider === 'Gemini' ? this.callGeminiRaw(prompt, model, apiKey) : this.callOpenRouterRaw(prompt, model, apiKey));
      const insight = typeof resp === 'string' ? resp : generateHeuristicInsight(trendData);
      AICache.set(cacheKey, { insight });
      return { insight, mode: 'AI' };
    } catch {
      return { insight: generateHeuristicInsight(trendData), mode: 'Heuristic' };
    }
  }

  static async predictRisk(campaign: any, history: any[], config: AIConfig): Promise<{ trend: string, insight: string, mode: 'AI' | 'Heuristic' }> {
    const cacheKey = AICache.generateKey('risk', `${campaign.id}_${config.model}`);
    const cached = AICache.get<{ trend: string, insight: string, mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    const { provider, model, apiKey } = config;
    const prompt = `Analyze this campaign and historical engagement data. 
    Campaign: ${JSON.stringify(campaign)}
    History: ${JSON.stringify(history)}
    Predict future risk trend (rising, stable, falling) and provide 1-sentence deep insight. Return JSON: { "trend": "rising|stable|falling", "insight": "string" }`;

    try {
      const resp = await (provider === 'Gemini' ? this.callGeminiRaw(prompt, model, apiKey) : this.callOpenRouterRaw(prompt, model, apiKey));
      const cleanJson = resp.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanJson);
      const result = { ...parsed, mode: 'AI' as const };
      AICache.set(cacheKey, result);
      return result;
    } catch {
      return { trend: 'stable', insight: '[MODE HEURISTIK] Prediksi AI tidak tersedia.', mode: 'Heuristic' };
    }
  }
}
