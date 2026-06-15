import { AnalysisResponse } from '../../core/domain/entities';
import { AICache } from '../../utils/cache';

export interface AIConfig {
  provider: 'Gemini' | 'OpenRouter' | 'Opencode';
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
    } else if (provider === 'OpenRouter') {
      result = await this.callOpenRouter(content, model, apiKey);
    } else if (provider === 'Opencode') {
      result = await this.callOpencodePerPost(content, model, apiKey);
    } else {
      throw new Error(`Provider "${provider}" belum didukung untuk analisis per-post.`);
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
    if (result.error) throw new Error(result.error.message || 'OpenRouter API error');
    const text = result.choices?.[0]?.message?.content || '{}';
    return this.parseAIResponse(text, model, 'OpenRouter');
  }

  private static async callOpencodePerPost(content: string, model: string, key: string): Promise<AnalysisResponse> {
    const url = `/api/proxy/opencode/chat`;
    const prompt = `Analisis apakah teks ini buzzer/bot media sosial. Teks: "${content}". 
    Berikan jawaban dalam format JSON (Bahasa Indonesia): { "isBuzzer": boolean, "confidenceScore": number, "botCharacteristics": string[], "sentimentScore": number, "detectedNarratives": string[], "summary": string, "verdict": string }`;
    
    const payload = { model, messages: [{ role: 'user', content: prompt }] };
    
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (result.error) throw new Error(result.error.message || 'OpenCode API error');
    const text = result.choices?.[0]?.message?.content || '{}';
    return this.parseAIResponse(text, model, 'Opencode');
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
    const cacheKey = AICache.generateKey('cluster2', `${nodes.length}_${links.length}_${config.model}_${platformFilter}`);
    const cached = AICache.get<{ clusters: any[], mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    const filteredNodes = platformFilter === 'All' ? nodes : nodes.filter(n => n.platform === platformFilter);
    const filteredLinks = links.filter(l => filteredNodes.find(n => n.id === l.source) && filteredNodes.find(n => n.id === l.target));

    const { provider, model, apiKey } = config;
    const prompt = `Analyze this social media coordination network graph (Platform Filter: ${platformFilter}).
Each node has: id, label, group (campaign/platform_hub/hashtag/buzzer_master/buzzer), platform, botScore.
Links represent coordination between nodes.

Identify distinct botnet clusters — groups of nodes working together in a coordinated disinformation campaign.

Rules:
- Nodes in the same campaign or connected through buzzer_masters likely belong to the same cluster
- buzzer_master nodes that connect to the same campaign and same hashtags form a cluster
- A cluster MUST have at least 2 nodes (unless it's a clear isolated campaign node)
- buzzer nodes with botScore > 80 connected to the same master belong together
- Multiple campaigns sharing the same hashtags and buzzers are one cluster

Nodes: ${JSON.stringify(filteredNodes.slice(0, 50).map(n => ({ id: n.id, label: n.label, group: n.group, platform: n.platform, botScore: n.botScore })))}
Links: ${JSON.stringify(filteredLinks.slice(0, 200).map(l => ({ source: l.source, target: l.target, value: l.value })))}

Return ONLY valid JSON (no markdown): { "clusters": [{ "clusterId": "Cluster_A", "nodeIds": ["id1", "id2"], "reason": "brief reason in Indonesian" }] }`;

    try {
      const resp = await this.callProviderRaw(prompt, model, apiKey, provider);
      const cleanJson = resp.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.clusters) && parsed.clusters.length > 0) {
        const result = { clusters: parsed.clusters, mode: 'AI' as const };
        AICache.set(cacheKey, result);
        return result;
      }
      throw new Error('Empty clusters');
    } catch {
      return this.heuristicCluster(filteredNodes, filteredLinks);
    }
  }

  private static heuristicCluster(nodes: any[], links: any[]): { clusters: any[], mode: 'AI' | 'Heuristic' } {
    const clusters: any[] = [];
    const assigned = new Set<string>();

    // 1. Cross-Platform Mapping: Hubungkan akun dengan username sama di platform berbeda
    const usernameMap = new Map<string, string[]>();
    nodes.forEach(n => {
      if (n.group === 'buzzer' || n.group === 'buzzer_master') {
        const username = n.label.toLowerCase().trim();
        if (!usernameMap.has(username)) usernameMap.set(username, []);
        usernameMap.get(username)!.push(n.id);
      }
    });

    let clusterIdx = 0;
    usernameMap.forEach((ids, username) => {
      const platforms = new Set(ids.map(id => nodes.find(n => n.id === id)?.platform));
      if (platforms.size > 1 && ids.length >= 2) {
        ids.forEach(id => assigned.add(id));
        clusters.push({
          clusterId: `CrossPlatform_${username}`,
          nodeIds: ids,
          reason: `Aktor lintas platform terdeteksi: Akun "${username}" aktif di ${Array.from(platforms).join(' & ')}.`
        });
        clusterIdx++;
      }
    });

    // 2. Group by campaign: all nodes linked to the same campaign
    const campaignLinks = new Map<string, string[]>();
    links.forEach(l => {
      const srcCampaign = nodes.find(n => n.id === l.source && n.group === 'campaign');
      const tgtCampaign = nodes.find(n => n.id === l.target && n.group === 'campaign');
      if (srcCampaign) {
        if (!campaignLinks.has(l.source)) campaignLinks.set(l.source, []);
        campaignLinks.get(l.source)!.push(l.target);
      }
      if (tgtCampaign) {
        if (!campaignLinks.has(l.target)) campaignLinks.set(l.target, []);
        campaignLinks.get(l.target)!.push(l.source);
      }
    });

    campaignLinks.forEach((targets, campaignId) => {
      const allIds = [campaignId, ...targets];
      const unassigned = allIds.filter(id => !assigned.has(id));
      if (unassigned.length >= 2) {
        unassigned.forEach(id => assigned.add(id));
        clusters.push({
          clusterId: `Cluster_${String.fromCharCode(65 + clusterIdx)}`,
          nodeIds: unassigned,
          reason: `Terkoordinasi dalam kampanye "${nodes.find(n => n.id === campaignId)?.label || campaignId}"`
        });
        clusterIdx++;
      }
    });

    // 2. Group high-score buzzers (botScore > 75) connected to same buzzer_master
    const masterBuzzers = new Map<string, string[]>();
    links.forEach(l => {
      const srcIsMaster = nodes.find(n => n.id === l.source && n.group === 'buzzer_master');
      const tgtIsBuzzer = nodes.find(n => n.id === l.target && n.group === 'buzzer' && (n.botScore || 0) > 75);
      if (srcIsMaster && tgtIsBuzzer) {
        if (!masterBuzzers.has(l.source)) masterBuzzers.set(l.source, []);
        masterBuzzers.get(l.source)!.push(l.target);
      }
    });

    masterBuzzers.forEach((buzzers, masterId) => {
      const unassigned = [masterId, ...buzzers].filter(id => !assigned.has(id));
      if (unassigned.length >= 2) {
        unassigned.forEach(id => assigned.add(id));
        clusters.push({
          clusterId: `Cluster_${String.fromCharCode(65 + clusterIdx)}`,
          nodeIds: unassigned,
          reason: `Buzzer dengan skor tinggi (${buzzers.length} akun) terkoordinasi oleh master "${nodes.find(n => n.id === masterId)?.label || masterId}"`
        });
        clusterIdx++;
      }
    });

    // 3. Remaining unassigned high-botScore buzzers grouped by platform
    const platformGroups = new Map<string, string[]>();
    nodes.filter(n => n.group === 'buzzer' && !assigned.has(n.id) && (n.botScore || 0) > 60).forEach(n => {
      const platKey = n.platform || 'unknown';
      if (!platformGroups.has(platKey)) platformGroups.set(platKey, []);
      platformGroups.get(platKey)!.push(n.id);
    });

    platformGroups.forEach((ids, plat) => {
      if (ids.length >= 2) {
        ids.forEach(id => assigned.add(id));
        clusters.push({
          clusterId: `Cluster_${String.fromCharCode(65 + clusterIdx)}`,
          nodeIds: ids,
          reason: `${ids.length} akun buzzer skor menengah-tinggi terdeteksi di platform ${plat}`
        });
        clusterIdx++;
      }
    });

    return { clusters, mode: 'Heuristic' };
  }

  static async generateEvidence(posts: any[], config: AIConfig, context?: string): Promise<{ summary: string, mode: 'AI' | 'Heuristic' }> {
    const contentPreview = posts.slice(0, 3).map(p => (p.text || '').substring(0, 50)).join('|');
    const cacheKey = AICache.generateKey('evidence', `${contentPreview}_${config.model}_${context || ''}`);
    const cached = AICache.get<{ summary: string, mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    const isCampaignSummary = posts.length === 1 && posts[0]?.text?.includes('Judul:');
    
    const { provider, model, apiKey } = config;
    const prompt = isCampaignSummary 
      ? `Tinjau ringkasan kampanye berikut dan berikan ringkasan intelijen singkat (2-3 kalimat Bahasa Indonesia) tentang kemungkinan perilaku tidak otentik yang terkoordinasi: ${posts[0].text}`
      : `Tinjau postingan berikut dan berikan ringkasan poin-poin bukti perilaku tidak otentik yang terkoordinasi (CIB) dalam Bahasa Indonesia. Postingan: ${JSON.stringify(posts.slice(0, 10))}`;

    if (!apiKey) {
      return { summary: this.getHeuristicSummary(posts, isCampaignSummary), mode: 'Heuristic' };
    }

    const resp = await this.callProviderRaw(prompt, model, apiKey, provider);
    const result = { summary: typeof resp === 'string' ? resp : (resp.summary || "Bukti terkumpul."), mode: 'AI' as const };
    AICache.set(cacheKey, result);
    return result;
  }

  private static getHeuristicSummary(posts: any[], isCampaignSummary: boolean): string {
    let heuristicSummary = "";
    if (isCampaignSummary && posts[0]?.text) {
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
    return heuristicSummary;
  }

  private static async callGeminiRaw(prompt: string, model: string, key: string): Promise<any> {
    const url = `/api/proxy/gemini/generate?model=${model}&key=${key}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[AI] Gemini Request timeout');
      controller.abort();
    }, 60000);
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
    const timeoutId = setTimeout(() => {
      console.error('[AI] OpenRouter Request timeout');
      controller.abort();
    }, 60000);
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

  private static async callOpencodeRaw(prompt: string, model: string, key: string): Promise<any> {
    const url = `/api/proxy/opencode/chat`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[AI] Opencode Request timeout');
      controller.abort();
    }, 60000);
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
      if (result.error) throw new Error(result.error.message || 'OpenCode API error');
      return result.choices?.[0]?.message?.content || "";
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static callProviderRaw(prompt: string, model: string, key: string, provider: string): Promise<any> {
    if (provider === 'Gemini') return this.callGeminiRaw(prompt, model, key);
    if (provider === 'OpenRouter') return this.callOpenRouterRaw(prompt, model, key);
    if (provider === 'Opencode') return this.callOpencodeRaw(prompt, model, key);
    throw new Error(`Provider "${provider}" tidak dikenal. Fallback ke heuristic.`);
  }

  static async analyzeTrend(trendData: any, config: AIConfig): Promise<{ insight: string, mode: 'AI' | 'Heuristic' }> {
    const { provider, model, apiKey } = config;
    const cacheKey = AICache.generateKey('trend', JSON.stringify(trendData));
    const cached = AICache.get<{ insight: string }>(cacheKey);
    if (cached) return { ...cached, mode: 'AI' };

    const generateHeuristicInsight = (data: any) => {
      if (!data) return "[MODE HEURISTIK] Belum ada data tren yang cukup untuk analisis.";
      const { platforms, totalPosts, dominantPlatform, overallSentiment } = data;
      const platformNames = Object.keys(platforms || {}).join(', ');
      return `[MODE HEURISTIK] Hari ini terpantau ${totalPosts || 0} postingan di Indonesia dari ${platformNames || 'beberapa platform'}, dengan dominasi di ${dominantPlatform || 'platform utama'} dan sentimen keseluruhan ${overallSentiment || 'netral'}.`;
    };

    if (!apiKey) {
      return { insight: generateHeuristicInsight(trendData), mode: 'Heuristic' };
    }

    const prompt = `Analisis data tren media sosial di Indonesia hari ini: ${JSON.stringify(trendData)}. 
    Berikan insight singkat (1-2 kalimat Bahasa Indonesia) mengenai dinamika platform dan dominasi narasi di Indonesia.`;

    try {
      const resp = await this.callProviderRaw(prompt, model, apiKey, provider);
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
    const resp = await this.callProviderRaw(prompt, model, apiKey, provider);
      const cleanJson = resp.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanJson);
      const result = { ...parsed, mode: 'AI' as const };
      AICache.set(cacheKey, result);
      return result;
    } catch {
      return { trend: 'stable', insight: '[MODE HEURISTIK] Prediksi AI tidak tersedia.', mode: 'Heuristic' };
    }
  }

  static async analyzeSentiment(topic: string, posts: any[], config: AIConfig): Promise<{ 
    sentiment: 'Positif' | 'Negatif' | 'Netral',
    score: number,
    summary: string,
    keywords: string[],
    mode: 'AI' | 'Heuristic'
  }> {
    const contentPreview = topic + '|' + posts.slice(0, 5).map(p => (p.text || '').substring(0, 50)).join('|');
    const cacheKey = AICache.generateKey('sentiment', `${contentPreview}_${config.model}`);
    const cached = AICache.get<{ sentiment: 'Positif' | 'Negatif' | 'Netral', score: number, summary: string, keywords: string[], mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    const { provider, model, apiKey } = config;

    const generateHeuristicSentiment = () => {
      const positiveWords = ['bagus', 'hebat', 'sukses', 'menyenangkan', 'terbaik', 'luar biasa', 'cinta', 'bangga', 'positif'];
      const negativeWords = ['buruk', 'jelek', 'gagal', 'menyedihkan', 'terburuk', 'mengecewakan', 'benci', 'kecewa', 'negatif', 'penipuan', 'hoax'];
      let positiveCount = 0;
      let negativeCount = 0;
      const allText = (topic + ' ' + posts.map(p => p.text || '').join(' ')).toLowerCase();

      positiveWords.forEach(word => {
        const regex = new RegExp(word, 'g');
        positiveCount += (allText.match(regex) || []).length;
      });
      negativeWords.forEach(word => {
        const regex = new RegExp(word, 'g');
        negativeCount += (allText.match(regex) || []).length;
      });

      const total = positiveCount + negativeCount;
      let sentiment: 'Positif' | 'Negatif' | 'Netral' = 'Netral';
      let score = 50;

      if (total > 0) {
        if (positiveCount > negativeCount) {
          sentiment = 'Positif';
          score = Math.round(50 + (positiveCount / total) * 50);
        } else if (negativeCount > positiveCount) {
          sentiment = 'Negatif';
          score = Math.round(50 - (negativeCount / total) * 50);
        }
      }

      const keywords = [topic.split(' ')[0], 'trending', 'topik'];
      const summary = `[MODE HEURISTIK] Analisis sentimen untuk topik "${topic}" menunjukkan sentimen ${sentiment.toLowerCase()} berdasarkan ${posts.length} postingan yang dipantau.`;

      return { sentiment, score, summary, keywords, mode: 'Heuristic' as const };
    };

    if (!apiKey) {
      const result = generateHeuristicSentiment();
      AICache.set(cacheKey, result);
      return result;
    }

    const prompt = `Analisis sentimen secara umum untuk topik: "${topic}". 
    Gunakan ${posts.length} postingan berikut sebagai acuan: ${JSON.stringify(posts.slice(0, 20))}.
    Berikan jawaban dalam format JSON (Bahasa Indonesia) dengan struktur: { "sentiment": "Positif" | "Negatif" | "Netral", "score": 0-100 (50 netral), "summary": "ringkasan singkat (2-3 kalimat)", "keywords": ["kata kunci penting"] }`;

    try {
      const resp = await this.callProviderRaw(prompt, model, apiKey, provider);
      const cleanJson = resp.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanJson);
      const result = { ...parsed, mode: 'AI' as const };
      AICache.set(cacheKey, result);
      return result;
    } catch {
      return generateHeuristicSentiment();
    }
  }

  static async analyzePostSentimentsBatch(posts: { id: string; text: string }[], config: AIConfig): Promise<{ postSentiments: { postId: string; sentiment: 'Positif' | 'Negatif' | 'Netral'; score: number }[]; mode: 'AI' | 'Heuristic' }> {
    const contentPreview = posts.slice(0, 5).map(p => (p.text || '').substring(0, 30)).join('|');
    const hasKey = !!config.apiKey;
    const cacheKey = AICache.generateKey('sentiment_batch', `${contentPreview}_${config.model}_${posts.length}_${hasKey}`);
    const cached = AICache.get<{ postSentiments: { postId: string; sentiment: 'Positif' | 'Negatif' | 'Netral'; score: number }[]; mode: 'AI' | 'Heuristic' }>(cacheKey);
    if (cached) return cached;

    const { provider, model, apiKey } = config;

    const generateHeuristic = () => {
      const positiveWords = ['bagus', 'hebat', 'sukses', 'menyenangkan', 'terbaik', 'luar biasa', 'cinta', 'bangga', 'positif', 'baik', 'senang', 'dukung', 'keren', 'salut', 'maju', 'cerdas', 'indah', 'bermanfaat', 'berhasil', 'inovatif', 'pintar', 'transparan', 'adil', 'bersih'];
      const negativeWords = ['buruk', 'jelek', 'gagal', 'menyedihkan', 'terburuk', 'mengecewakan', 'benci', 'kecewa', 'negatif', 'penipuan', 'hoax', 'jahat', 'bohong', 'tolak', 'korupsi', 'rusak', 'salah', 'curang', 'bodoh', 'parah', 'ancam', 'krisis', 'darurat', 'provokasi'];
      const postSentiments = posts.map(p => {
        const lower = (p.text || '').toLowerCase();
        let posCount = 0;
        let negCount = 0;
        positiveWords.forEach(w => {
          const re = new RegExp(w.replace(/\s+/g, '\\s+'), 'gi');
          posCount += (lower.match(re) || []).length;
        });
        negativeWords.forEach(w => {
          const re = new RegExp(w.replace(/\s+/g, '\\s+'), 'gi');
          negCount += (lower.match(re) || []).length;
        });
        const total = posCount + negCount;
        if (total === 0) return { postId: p.id, sentiment: 'Netral' as const, score: 50 };
        if (posCount > negCount) return { postId: p.id, sentiment: 'Positif' as const, score: Math.round(50 + (posCount / total) * 50) };
        if (negCount > posCount) return { postId: p.id, sentiment: 'Negatif' as const, score: Math.round(50 - (negCount / total) * 50) };
        return { postId: p.id, sentiment: 'Netral' as const, score: 50 };
      });
      return { postSentiments, mode: 'Heuristic' as const };
    };

    if (!apiKey) {
      const result = generateHeuristic();
      AICache.set(cacheKey, result);
      return result;
    }

    const postsJson = JSON.stringify(posts.map(p => ({ id: p.id, text: p.text })).slice(0, 30));
    const prompt = `Analisis sentimen setiap postingan berikut satu per satu. Postingan: ${postsJson}.
    Berikan jawaban dalam format JSON ARRAY (Bahasa Indonesia) dengan struktur: [{ "postId": "id_postingan", "sentiment": "Positif" | "Negatif" | "Netral", "score": 0-100 }].
    Penting: output HARUS array JSON, bukan objek.`;

    try {
      const resp = await this.callProviderRaw(prompt, model, apiKey, provider);
      const cleanJson = resp.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      const arr = Array.isArray(parsed) ? parsed : (parsed.postSentiments || parsed.results || []);
      const postSentiments = arr.map((item: any) => ({
        postId: item.postId || item.id || '',
        sentiment: (['Positif', 'Negatif', 'Netral'].includes(item.sentiment) ? item.sentiment : 'Netral') as 'Positif' | 'Negatif' | 'Netral',
        score: typeof item.score === 'number' ? Math.max(0, Math.min(100, item.score)) : 50
      }));
      const result = { postSentiments, mode: 'AI' as const };
      AICache.set(cacheKey, result);
      return result;
    } catch {
      return generateHeuristic();
    }
  }
}
