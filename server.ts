import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import path from "node:path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

import { FileCampaignRepository } from "./src/infrastructure/repositories/FileCampaignRepository.ts";
import { FileAccountRepository } from "./src/infrastructure/repositories/FileAccountRepository.ts";
import { FileGeminiRepository } from "./src/infrastructure/repositories/FileGeminiRepository.ts";

import { GetCampaignsUseCase } from "./src/core/use-cases/GetCampaignsUseCase.ts";
import { SaveGeminiKeyUseCase } from "./src/core/use-cases/SaveGeminiKeyUseCase.ts";
import { AnalyzeThreatUseCase } from "./src/core/use-cases/AnalyzeThreatUseCase.ts";
import { SubmitReportUseCase } from "./src/core/use-cases/SubmitReportUseCase.ts";
import { AnalyzeNetworkUseCase } from "./src/core/use-cases/AnalyzeNetworkUseCase.ts";
import { SummarizeCampaignUseCase } from "./src/core/use-cases/SummarizeCampaignUseCase.ts";
import { ClassifyReportUseCase } from "./src/core/use-cases/ClassifyReportUseCase.ts";
import { AnalyzeSentimentUseCase } from "./src/core/use-cases/AnalyzeSentimentUseCase.ts";
import { RecommendThresholdsUseCase } from "./src/core/use-cases/RecommendThresholdsUseCase.ts";
import { LabelContentUseCase } from "./src/core/use-cases/LabelContentUseCase.ts";
const app = express();
app.use(cors());
app.use(express.json());

// ---------- Repository Instances ----------
const campaignRepo = new FileCampaignRepository();
const accountRepo = new FileAccountRepository();
const geminiRepo = new FileGeminiRepository();

const getCampaignsUseCase = new GetCampaignsUseCase(campaignRepo);
const saveGeminiKeyUseCase = new SaveGeminiKeyUseCase(geminiRepo);
const analyzeThreatUseCase = new AnalyzeThreatUseCase(geminiRepo);
const submitReportUseCase = new SubmitReportUseCase();
const analyzeNetworkUseCase = new AnalyzeNetworkUseCase(geminiRepo);
const summarizeCampaignUseCase = new SummarizeCampaignUseCase(geminiRepo);
const classifyReportUseCase = new ClassifyReportUseCase(geminiRepo);
const analyzeSentimentUseCase = new AnalyzeSentimentUseCase(geminiRepo);
const recommendThresholdsUseCase = new RecommendThresholdsUseCase(geminiRepo);
const labelContentUseCase = new LabelContentUseCase(geminiRepo);

// ---------- WebSocket Server ----------
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/graph-updates" });
wss.setMaxListeners(200);
wss.on("connection", (ws) => {
  console.log("Client connected for graph updates");
  ws.on("close", () => console.log("Client disconnected"));
});

// ---------- API Routes ----------
app.get("/api/campaigns", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const repoData = await getCampaignsUseCase.execute(page, limit);
  const data = scrapedCampaigns.length > 0 ? scrapedCampaigns : repoData.data;
  res.json({ data, pagination: { page, limit, total: data.length } });
});

app.get("/api/accounts", async (req, res) => {
  const data = scrapedAccounts.length > 0 ? scrapedAccounts : await accountRepo.getAll();
  res.json({ data });
});

app.get("/api/stats", async (req, res) => {
  const campaigns = scrapedCampaigns.length > 0 ? scrapedCampaigns : await campaignRepo.getAll();
  const accounts = scrapedAccounts.length > 0 ? scrapedAccounts : await accountRepo.getAll();
  const totalReach = campaigns.reduce((acc: number, c: any) => acc + c.reach, 0);
  const activeBuzzerCount = campaigns.reduce((acc: number, c: any) => acc + c.buzzerCount, 0) + accounts.length;
  const avgBotScore = Math.round(
    accounts.reduce((acc: number, a: any) => acc + a.botScore, 0) / (accounts.length || 1)
  );

  res.json({
    totalCampaigns: campaigns.length,
    activeCampaignsCount: campaigns.filter((c) => c.status === "Active").length,
    totalReach,
    activeBuzzerCount,
    avgBotScore,
    recentReportsCount: 0,
  });
});

app.post("/api/reports", async (req, res) => {
  const { url, username, platform, narrative, evidence, email } = req.body;
  if (!url || !platform || !narrative) {
    return res.status(400).json({ error: "Missing required fields (url, platform, narrative)" });
  }

  const report = await submitReportUseCase.execute({
    url,
    username,
    platform,
    narrative,
    evidence,
    email,
  });

  // Broadcast graph update if needed
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: "GRAPH_UPDATE" }));
    }
  });

  res.status(201).json({ success: true, report });
});

app.post("/api/gemini/key", async (req, res) => {
  const { key } = req.body;
  if (!key?.trim()) {
    return res.status(400).json({ error: "API key required" });
  }
  await saveGeminiKeyUseCase.execute(key);
  res.json({ success: true });
});

app.get("/api/gemini/key", async (req, res) => {
  const key = await geminiRepo.getKey();
  res.json({ key });
});

app.post("/api/analyze", async (req, res) => {
  const { type, content, platform } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Content is required for analysis." });
  }
  const result = await analyzeThreatUseCase.execute(type, content, platform);
  res.json(result);
});

// ---------- AI-Powered Features (Gemini + fallback) ----------
app.post("/api/ai/analyze-network", async (req, res) => {
  const { nodes, links } = req.body;
  const result = await analyzeNetworkUseCase.execute(nodes || [], links || []);
  res.json(result);
});

app.post("/api/ai/summarize-campaign", async (req, res) => {
  const { campaign } = req.body;
  if (!campaign) return res.status(400).json({ error: "Campaign data required" });
  const result = await summarizeCampaignUseCase.execute(campaign);
  res.json(result);
});

app.post("/api/ai/classify-report", async (req, res) => {
  const { url, narrative, evidence } = req.body;
  const result = await classifyReportUseCase.execute(url || '', narrative || '', evidence || '');
  res.json(result);
});

app.post("/api/ai/analyze-sentiment", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });
  const result = await analyzeSentimentUseCase.execute(text);
  res.json(result);
});

app.post("/api/ai/recommend-thresholds", async (req, res) => {
  const { campaigns, accounts } = req.body;
  const result = await recommendThresholdsUseCase.execute(campaigns || [], accounts || []);
  res.json(result);
});

app.post("/api/ai/label-content", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });
  const result = await labelContentUseCase.execute(text);
  res.json(result);
});

// ---------- Python scraper integration ----------
async function runPythonScraper(platform: string, keyword: string, limit: number = 10): Promise<any> {
  try {
    const { stdout } = await execFileAsync("python", [
      "scrapers/run_scraper.py",
      platform,
      "--keyword", keyword,
      "--limit", String(limit),
    ], { timeout: 30000, cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    return JSON.parse(stdout);
  } catch (e: any) {
    if (e.stdout) {
      try { return JSON.parse(e.stdout); } catch { /* ignore */ }
    }
    return { success: false, platform, error: e.message || String(e) };
  }
}

function mapScraperResults(results: any[], keyword: string) {
  const id = Date.now().toString();
  const allPosts: any[] = [];
  const authorsMap = new Map<string, any>();
  // Only include platforms that actually returned results
  const nonEmpty = results.filter(r => r.results && r.results.length > 0);
  const platformLabels: Record<string, string> = { X: 'X', twitter: 'X', youtube: 'YouTube', tiktok: 'TikTok' };

  nonEmpty.forEach(platformResult => {
    const platform = platformLabels[platformResult.platform] || platformResult.platform;
    (platformResult.results || []).forEach((item: any, idx: number) => {
      const postId = `post-${id}-${platform}-${idx}`;
      allPosts.push({
        id: postId,
        platform,
        authorUsername: item.author || 'unknown',
        text: item.snippet || item.title || '',
        postUrl: item.url || '',
        publishedAt: item.publishedAt || new Date().toISOString(),
        likes: item.likes || 0,
        comments: item.comments || 0,
        shares: item.shares || 0,
        reach: (item.views || 0) + (item.likes || 0) * 10,
        engagementRate: parseFloat((Math.random() * 8 + 1).toFixed(2)),
      });

      if (item.author && !authorsMap.has(item.author)) {
        authorsMap.set(item.author, {
          id: `acc-${id}-${authorsMap.size}`,
          username: item.author,
          displayName: item.author,
          platform,
          followers: Math.floor(100 + Math.random() * 5000),
          following: Math.floor(500 + Math.random() * 3000),
          botScore: Math.floor(60 + Math.random() * 40),
          status: 'Flagged',
          lastActive: item.publishedAt || new Date().toISOString(),
          reason: `Suspected coordination in "${keyword}" disinformation network.`,
          recentCopypastaCount: Math.floor(3 + Math.random() * 20),
        });
      }
    });
  });

  scrapedPosts = allPosts;
  scrapedAccounts = Array.from(authorsMap.values());

  scrapedCampaigns = nonEmpty.map((r, i) => {
    const platform = platformLabels[r.platform] || r.platform;
    const posts = r.results || [];
    const totalReach = posts.reduce((acc: number, p: any) => acc + (p.views || 0) + (p.likes || 0) * 10, 0);
    return {
      id: `camp-${id}-${i}`,
      title: `${keyword} - ${platform}`,
      description: `Disinformation campaign around "${keyword}" detected on ${platform} (${posts.length} posts).`,
      topic: keyword,
      platforms: [platform],
      intensity: ['Low', 'Medium', 'High', 'Critical'][i % 4],
      sentiment: ['Positive', 'Negative', 'Neutral', 'Mixed'][i % 4],
      startDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      botRatio: 0.5 + Math.random() * 0.45,
      reach: totalReach || Math.floor(50000 + Math.random() * 200000),
      hashtags: [`#${keyword}`],
      keyNarrative: `Coordinated amplification of "${keyword}" on ${platform}.`,
      buzzerCount: posts.length,
    };
  });

  // If no scrapers returned results, force fallback to synthetic
  if (nonEmpty.length === 0) {
    console.warn("All scrapers returned 0 results, switching to synthetic data");
    generateKeywordData(keyword);
    return;
  }

  scrapedTimeline = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return {
      date: d.toISOString().slice(0, 10),
      likes: Math.floor(200 + Math.random() * 800),
      comments: Math.floor(50 + Math.random() * 300),
      shares: Math.floor(20 + Math.random() * 150),
      reach: Math.floor(5000 + Math.random() * 20000),
    };
  });
}

// ---------- Copypasta similarity engine ----------
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

async function computeBuzzerScores() {
  // Group posts by author
  const authorPosts = new Map<string, string[]>();
  scrapedPosts.forEach((p: any) => {
    const key = `${p.platform}:${p.authorUsername}`;
    if (!authorPosts.has(key)) authorPosts.set(key, []);
    authorPosts.get(key)!.push(p.text);
  });

  // Try AI-enhanced analysis if Gemini key is available
  let aiScores: Record<string, number> | null = null;
  try {
    const key = await geminiRepo.getKey();
    if (key && authorPosts.size > 0) {
      const batchPrompt = `Analyze these social media posts for coordinated inauthentic behavior (copypasta, botnet coordination). 
For each author, return a JSON object with key = author key (format: "Platform:username") and value = buzzer score 0-100.
Score based on: text similarity between posts, posting frequency, repetition of phrases, coordinated timing patterns.
Only respond with valid JSON, no markdown, no explanation.

Authors and their posts:
${Array.from(authorPosts.entries()).slice(0, 20).map(([author, texts]) => 
  `${author}:\n${texts.map((t, i) => `  [${i + 1}] ${t.slice(0, 150)}`).join('\n')}`
).join('\n\n')}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: batchPrompt }] }]
        })
      });
      const result: any = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          aiScores = parsed;
          console.log('[AI Copypasta] Gemini analysis completed for', Object.keys(aiScores).length, 'authors');
        }
      }
    }
  } catch (err) {
    console.warn('[AI Copypasta] Gemini call failed, falling back to Jaccard:', (err as Error)?.message);
  }

  // Compute scores (AI-enhanced or Jaccard fallback)
  const authorScores = new Map<string, number>();
  for (const [author, texts] of authorPosts) {
    if (aiScores && aiScores[author] !== undefined) {
      authorScores.set(author, Math.min(99, Math.max(15, aiScores[author])));
      continue;
    }
    if (texts.length < 2) {
      authorScores.set(author, Math.floor(30 + Math.random() * 30));
      continue;
    }
    let totalSim = 0;
    let pairs = 0;
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        totalSim += jaccardSimilarity(texts[i], texts[j]);
        pairs++;
      }
    }
    const avgSim = pairs > 0 ? totalSim / pairs : 0;
    const freqBonus = Math.min(20, texts.length * 5);
    const score = Math.min(99, Math.round(avgSim * 70 + freqBonus));
    authorScores.set(author, Math.max(15, score));
  }

  // Update account buzzer scores
  scrapedAccounts.forEach((a: any) => {
    const key = `${a.platform}:${a.username}`;
    if (authorScores.has(key)) {
      a.botScore = authorScores.get(key)!;
    }
  });
}

// ---------- AI Campaign Brief ----------
async function generateCampaignBrief(campaign: any): Promise<string> {
  try {
    const key = await geminiRepo.getKey();
    if (!key) return briefFallback(campaign);
    const prompt = `Generate a concise intelligence brief (2-3 sentences in Indonesian) for this disinformation campaign:
Title: ${campaign.title}
Platform: ${campaign.platforms?.join(', ')}
Topic: ${campaign.topic}
Intensity: ${campaign.intensity}
Bot Ratio: ${Math.round((campaign.botRatio || 0) * 100)}%
Posts tracked: ${campaign.buzzerCount || 0}
Hashtags: ${(campaign.hashtags || []).join(', ')}
Narrative: ${campaign.keyNarrative || 'Unknown'}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const result: any = await response.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || briefFallback(campaign);
  } catch {
    return briefFallback(campaign);
  }
}

function briefFallback(campaign: any): string {
  const templates = [
    `Kampanye "${campaign.title}" terdeteksi di ${campaign.platforms?.[0] || 'multi-platform'} dengan intensitas ${campaign.intensity}. ${Math.round((campaign.botRatio || 0) * 100)}% aktivitas terindikasi dari akun buzter terkoordinasi.`,
    `Koordinasi buzzer terdeteksi pada topik "${campaign.topic}" — ${campaign.buzzerCount || 0} postingan terpantau dengan narasi "${campaign.keyNarrative || 'amplifikasi buatan'}"`,
    `Peringatan: Kampanye "${campaign.title}" menunjukkan pola koordinasi sistematis. Rasio buzzer ${Math.round((campaign.botRatio || 0) * 100)}% — memerlukan investigasi lebih lanjut.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ---------- AI Account Brief ----------
async function generateAccountBrief(account: any): Promise<string> {
  try {
    const key = await geminiRepo.getKey();
    if (!key) return accountBriefFallback(account);
    const prompt = `Analisis akun media sosial ini dalam 2-3 kalimat Bahasa Indonesia:
Username: ${account.username}
Platform: ${account.platform}
Skor Buzzer: ${account.botScore}/100
Followers: ${account.followers}
Following: ${account.following}
Copypasta Count: ${account.recentCopypastaCount || 0}
Status: ${account.status}
Alasan: ${account.reason}

Beri penilaian: apakah ini akun buzzer terkoordinasi, bot otomatis, atau pengguna asli? Sebutkan pola mencurigakan yang terdeteksi.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const result: any = await response.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || accountBriefFallback(account);
  } catch {
    return accountBriefFallback(account);
  }
}

function accountBriefFallback(account: any): string {
  const level = account.botScore > 80 ? 'Tinggi' : account.botScore > 50 ? 'Sedang' : 'Rendah';
  return `Akun @${account.username} di ${account.platform} memiliki skor buzzer ${level} (${account.botScore}%). ${account.recentCopypastaCount > 5 ? `Terdeteksi ${account.recentCopypastaCount} pola copypasta — indikasi kuat koordinasi buzzer.` : 'Pola aktivitas masih dalam batas wajar, namun direkomendasikan pemantauan lanjutan.'} ${account.followers < 100 ? 'Jumlah follower rendah tidak sebanding dengan aktivitas.' : ''}`;
}

// ---------- Auto-labeling Posts ----------
async function autoLabelPosts(): Promise<void> {
  if (scrapedPosts.length === 0) return;
  try {
    const key = await geminiRepo.getKey();
    if (!key) return;
    
    const batchSize = 10;
    for (let i = 0; i < Math.min(scrapedPosts.length, batchSize); i++) {
      const post = scrapedPosts[i];
      if (post.label) continue;
      
      const prompt = `Classify this social media post into ONE category: "propaganda", "copypasta", "genuine", or "spam".
Only respond with the category word, nothing else.

Post: "${post.text.slice(0, 200)}"
Platform: ${post.platform}
Author: ${post.authorUsername}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const result: any = await response.json();
      const label = result?.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase().trim();
      if (['propaganda', 'copypasta', 'genuine', 'spam'].includes(label)) {
        post.label = label;
      }
    }
    console.log(`[Auto-label] Labeled ${scrapedPosts.filter((p: any) => p.label).length}/${scrapedPosts.length} posts`);
  } catch (err) {
    console.warn('[Auto-label] Failed:', (err as Error)?.message);
  }
}

// ---------- Sentiment Timeline ----------
function computeSentimentTimeline() {
  const dayBuckets = new Map<string, { pos: number; neg: number; neu: number; total: number }>();
  scrapedPosts.forEach((p: any) => {
    const day = p.publishedAt ? p.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    if (!dayBuckets.has(day)) dayBuckets.set(day, { pos: 0, neg: 0, neu: 0, total: 0 });
    const b = dayBuckets.get(day)!;
    b.total++;
    // Simple keyword-based sentiment
    const text = (p.text || '').toLowerCase();
    if (/baik|dukung|setuju|hebat|keren|salut/.test(text)) b.pos++;
    else if (/tolak|jahat|bohong|penipuan|jelek|benci/.test(text)) b.neg++;
    else b.neu++;
  });
  return Array.from(dayBuckets.entries()).map(([date, v]) => ({
    date,
    positive: Math.round((v.pos / v.total) * 100),
    negative: Math.round((v.neg / v.total) * 100),
    neutral: Math.round((v.neu / v.total) * 100),
  }));
}

// ---------- In-memory store for scraped data ----------
let scrapedCampaigns: any[] = [];
let scrapedAccounts: any[] = [];
let scrapedPosts: any[] = [];
let scrapedTimeline: any[] = [];

async function generateKeywordData(keyword: string) {
  const id = Date.now().toString();
  const platforms = ['X', 'TikTok', 'YouTube'];
  const intensity = ['Low', 'Medium', 'High', 'Critical'];
  const sentiments = ['Positive', 'Negative', 'Neutral', 'Mixed'];
  const statuses = ['Active', 'Active', 'Monitoring'];
  const stats = ['Flagged', 'Under Investigation', 'Verified Buzzer', 'Suspended'];

  scrapedCampaigns = Array.from({ length: 3 }, (_, i) => ({
    id: `camp-${id}-${i}`,
    title: `${keyword} Campaign ${i + 1}`,
    description: `Organized disinformation campaign around "${keyword}" detected across social platforms.`,
    topic: keyword,
    platforms: [platforms[i % 3]],
    intensity: intensity[i % 4],
    sentiment: sentiments[i % 4],
    startDate: new Date().toISOString().slice(0, 10),
    status: statuses[i % 3],
    botRatio: 0.5 + Math.random() * 0.45,
    reach: Math.floor(50000 + Math.random() * 200000),
    hashtags: [`#${keyword}`, `#${keyword}Now`, `#Dukung${keyword}`],
    keyNarrative: `Coordinated amplification of "${keyword}" narrative using copypasta and hashtag spamming.`,
    buzzerCount: Math.floor(10 + Math.random() * 90),
  }));

  scrapedAccounts = Array.from({ length: 5 }, (_, i) => ({
    id: `acc-${id}-${i}`,
    username: `buzzer_${keyword}_${i}`,
    displayName: `Buzzer ${keyword} #${i}`,
    platform: platforms[i % 3],
    followers: Math.floor(100 + Math.random() * 5000),
    following: Math.floor(500 + Math.random() * 3000),
    botScore: Math.floor(60 + Math.random() * 40),
    status: stats[i % 4],
    lastActive: new Date().toISOString(),
    reason: `Suspected coordination in "${keyword}" disinformation network.`,
    recentCopypastaCount: Math.floor(3 + Math.random() * 20),
  }));

  scrapedPosts = Array.from({ length: 8 }, (_, i) => ({
    id: `post-${id}-${i}`,
    platform: platforms[i % 3],
    authorUsername: `user_${keyword}_${i}`,
    text: `${keyword} is a trending topic! #${keyword} #viral ${i % 2 === 0 ? 'Dukung terus!' : 'Tolak!'}`,
    postUrl: `https://${platforms[i % 3].toLowerCase()}.com/post/${id}-${i}`,
    publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
    likes: Math.floor(50 + Math.random() * 500),
    comments: Math.floor(10 + Math.random() * 100),
    shares: Math.floor(5 + Math.random() * 200),
    reach: Math.floor(1000 + Math.random() * 10000),
    engagementRate: parseFloat((Math.random() * 8 + 1).toFixed(2)),
  }));

  scrapedTimeline = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return {
      date: d.toISOString().slice(0, 10),
      likes: Math.floor(200 + Math.random() * 800),
      comments: Math.floor(50 + Math.random() * 300),
      shares: Math.floor(20 + Math.random() * 150),
      reach: Math.floor(5000 + Math.random() * 20000),
    };
  });
  await computeBuzzerScores();
  autoLabelPosts();
}

// ---------- Social / Network / Report Routes ----------
app.get("/api/social/accounts", (_req, res) => {
  res.json(scrapedAccounts);
});

app.get("/api/social/posts", (_req, res) => {
  res.json(scrapedPosts);
});

app.get("/api/social/demographics", (req, res) => {
  const platform = (req.query as any)?.platform || 'All';
  let filtered = scrapedAccounts;
  if (platform !== 'All') filtered = scrapedAccounts.filter((a: any) => a.platform === platform);
  const total = filtered.length || 1;

  const ageBuckets: Record<string, number> = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
  const genderBuckets: Record<string, number> = { Male: 0, Female: 0, Other: 0 };
  const regionBuckets: Record<string, number> = {};

  filtered.forEach((a: any) => {
    // Age: estimate from botScore (higher score → younger demographic bias)
    const ageRand = (a.botScore || 50) + Math.random() * 30;
    if (ageRand < 30) ageBuckets['18-24']++;
    else if (ageRand < 50) ageBuckets['25-34']++;
    else if (ageRand < 70) ageBuckets['35-44']++;
    else ageBuckets['45+']++;

    // Gender: weighted random based on platform
    const genderSeed = ((a.botScore || 50) * 7 + a.followers) % 100;
    if (genderSeed < 50) genderBuckets.Male++;
    else if (genderSeed < 90) genderBuckets.Female++;
    else genderBuckets.Other++;

    // Region: based on platform + username hash
    const regionKey = a.platform === 'X' ? 'Indonesia' : a.platform === 'YouTube' ? 'Malaysia' : 'Other';
    regionBuckets[regionKey] = (regionBuckets[regionKey] || 0) + 1;
  });

  res.json({
    ageBreakdown: Object.entries(ageBuckets).map(([category, value]) => ({ category, value: Math.round((value / total) * 100) })),
    genderBreakdown: Object.entries(genderBuckets).map(([category, value]) => ({ category, value: Math.round((value / total) * 100) })),
    regionBreakdown: Object.entries(regionBuckets).map(([category, value]) => ({ category, value: Math.round((value / total) * 100) })),
  });
});

app.post("/api/proxy/gemini/generate", async (req, res) => {
  const { model, key } = req.query;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    console.log(`[Proxy] Redirecting to Gemini: ${url}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error(`[Proxy] Gemini Error:`, err);
    res.status(500).json({ error: "Gemini proxy failed" });
  }
});

app.post("/api/proxy/openrouter/chat", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const url = `https://openrouter.ai/api/v1/chat/completions`;
    console.log(`[Proxy] Redirecting to OpenRouter: ${url}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': auth || '', 
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://buzztrack.ai',
        'X-Title': 'BuzzTrack AI'
      },
      body: JSON.stringify(req.body)
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error(`[Proxy] OpenRouter Error:`, err);
    res.status(500).json({ error: "OpenRouter proxy failed" });
  }
});

app.get("/api/proxy/models/openrouter", async (_req, res) => {
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models');
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to proxy OpenRouter models" });
  }
});

app.get("/api/proxy/models/gemini", async (req, res) => {
  try {
    const key = req.query.key;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${key}`);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to proxy Gemini models" });
  }
});

// API Routes
app.post("/api/proxy/gemini/generate", async (req, res) => {
  const { model, key } = req.query;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Gemini proxy failed" });
  }
});

app.post("/api/proxy/openrouter/chat", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const url = `https://openrouter.ai/api/v1/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': auth || '', 
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://buzztrack.ai',
        'X-Title': 'BuzzTrack AI'
      },
      body: JSON.stringify(req.body)
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "OpenRouter proxy failed" });
  }
});

app.get("/api/proxy/models/openrouter", async (_req, res) => {
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models');
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to proxy OpenRouter models" });
  }
});

app.get("/api/proxy/models/gemini", async (req, res) => {
  try {
    const key = req.query.key;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${key}`);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to proxy Gemini models" });
  }
});

app.get("/api/social/engagement", (_req, res) => {
  res.json(scrapedTimeline);
});

app.get("/api/social/auth/url", (req, res) => {
  res.json({ url: "", real: false });
});

app.post("/api/social/connect", (req, res) => {
  res.json({ success: false, account: null });
});

app.post("/api/social/disconnect", (req, res) => {
  res.json({ success: false });
});

app.post("/api/social/sync", (req, res) => {
  res.json({ success: false, message: "No social API keys configured." });
});

app.post("/api/social/search", async (req, res) => {
  const { keyword } = req.body;
  if (!keyword || keyword === "Reset_Siber_Clean_Slate") {
    scrapedCampaigns = [];
    scrapedAccounts = [];
    scrapedPosts = [];
    scrapedTimeline = [];
    return res.json({ success: true, method: "reset" });
  }

  // Try real Python scrapers first (skip if DISABLE_PYTHON_SCRAPERS=true, or if required credentials are missing)
  let twitter = { success: false, platform: 'X', error: 'disabled' };
  let youtube = { success: false, platform: 'YouTube', error: 'disabled' };
  let tiktok = { success: false, platform: 'TikTok', error: 'disabled' };
  const twitterConfigured = !!(process.env.TWITTER_COOKIES && process.env.TWITTER_COOKIES.includes("auth_token"));
  const youtubeConfigured = !!(process.env.YOUTUBE_API_KEY);
  const tiktokConfigured = !!(process.env.TIKTOK_MS_TOKEN);

  if (!process.env.DISABLE_PYTHON_SCRAPERS) {
    const scraperPromises: Promise<any>[] = [];
    if (twitterConfigured) scraperPromises.push(runPythonScraper("twitter", keyword, 50));
    if (youtubeConfigured) scraperPromises.push(runPythonScraper("youtube", keyword, 50));
    if (tiktokConfigured) scraperPromises.push(runPythonScraper("tiktok", keyword, 50));
    if (scraperPromises.length === 0) {
      console.log("No scrapers configured — check .env for credentials");
    } else {
      const results = await Promise.all(scraperPromises);
      results.forEach(r => {
        if (r.platform === 'X') twitter = r;
        else if (r.platform === 'YouTube') youtube = r;
        else if (r.platform === 'TikTok') tiktok = r;
      });
    }
  } else {
    console.log("Python scrapers disabled via DISABLE_PYTHON_SCRAPERS env var");
  }

  const succeeded = [twitter, youtube, tiktok].filter(r => r.success === true);
  const hasRealData = succeeded.some(r => r.results && r.results.length > 0);

  if (succeeded.length > 0 && hasRealData) {
    mapScraperResults(succeeded, keyword);
    await computeBuzzerScores();
  } else {
    if (succeeded.length > 0 && !hasRealData) {
      console.warn("Scrapers connected but returned 0 results, using synthetic data");
    } else {
      console.warn("All Python scrapers failed, using synthetic data:", { twitter: twitter.error, youtube: youtube.error, tiktok: tiktok.error });
    }
    generateKeywordData(keyword);
  }
  res.json({
    success: true,
    method: scrapedAccounts.length > 0 ? (hasRealData ? "python" : "synthetic") : "synthetic",
    keyword,
    campaigns: scrapedCampaigns,
    accounts: scrapedAccounts,
  });
});

app.get("/api/network", (_req, res) => {
  const platformSet = new Set<string>();
  scrapedCampaigns.forEach(c => c.platforms?.forEach((p: string) => platformSet.add(p)));
  scrapedAccounts.forEach(a => { if (a.platform) platformSet.add(a.platform); });

  const platformHubs = Array.from(platformSet).map((p, i) => ({
    id: `hub-${p.toLowerCase().replace(/\s+/g, '')}`,
    label: `${p} Hub`,
    group: 'platform_hub',
    size: 18,
    platform: p,
  }));

  const hashtagNodes: any[] = [];
  const hashtagMap = new Map<string, string[]>();
  scrapedCampaigns.forEach(c => {
    (c.hashtags || []).forEach((tag: string) => {
      const key = tag.replace(/^#/, '').toLowerCase();
      if (!hashtagMap.has(key)) {
        const id = `tag-${key}`;
        hashtagNodes.push({ id, label: tag, group: 'hashtag', size: 14, platform: '' });
        hashtagMap.set(key, []);
      }
      hashtagMap.get(key)!.push(c.id);
    });
  });

  const sortedAccounts = [...scrapedAccounts].sort((a, b) => b.botScore - a.botScore);
  const masterNodes = sortedAccounts.slice(0, Math.min(3, sortedAccounts.length)).map(a => ({
    id: `master-${a.id}`,
    label: `@${a.username}`,
    group: 'buzzer_master',
    size: 16,
    botScore: a.botScore,
    platform: a.platform || '',
  }));

  const nodes: any[] = [
    ...scrapedCampaigns.map(c => ({
      id: c.id,
      label: c.title,
      group: 'campaign',
      size: 20 + c.buzzerCount / 5,
      platform: c.platforms?.[0] || '',
      botScore: c.botRatio ? Math.floor(c.botRatio * 100) : 50,
    })),
    ...scrapedAccounts.map(a => ({
      id: a.id,
      label: `@${a.username}`,
      group: 'buzzer',
      size: 10 + a.botScore / 10,
      botScore: a.botScore,
      platform: a.platform || '',
    })),
    ...platformHubs,
    ...hashtagNodes,
    ...masterNodes,
  ];

  const links: any[] = [];

  // Campaign → Platform Hub
  scrapedCampaigns.forEach(c => {
    (c.platforms || []).forEach((p: string) => {
      const hubId = `hub-${p.toLowerCase().replace(/\s+/g, '')}`;
      links.push({ source: c.id, target: hubId, value: 80 });
    });
    // Campaign → Hashtag
    (c.hashtags || []).forEach((tag: string) => {
      const tagId = `tag-${tag.replace(/^#/, '').toLowerCase()}`;
      links.push({ source: c.id, target: tagId, value: 70 });
    });
    // Campaign → Suspicious
    scrapedAccounts.forEach(a => {
      links.push({ source: c.id, target: a.id, value: Math.floor(30 + Math.random() * 70) });
    });
  });

  // Hashtag → Buzzer Master
  hashtagNodes.forEach(h => {
    const tagKey = h.label.replace(/^#/, '').toLowerCase();
    const linkedCampaigns = hashtagMap.get(tagKey) || [];
    masterNodes.forEach(m => {
      // Connect master to hashtag if same platform or any
      links.push({ source: h.id, target: m.id, value: 60 });
    });
  });

  // Buzzer Master → Buzzer (master controls buzzer accounts)
  masterNodes.forEach(m => {
    const platformBuzzers = scrapedAccounts.filter(a => a.platform === m.platform && a.id !== m.id.replace('master-', ''));
    platformBuzzers.slice(0, 4).forEach(a => {
      links.push({ source: m.id, target: a.id, value: 90 });
    });
  });

  res.json({ nodes, links });
});

app.get("/api/account/:id/brief", async (req, res) => {
  const account = scrapedAccounts.find((a: any) => a.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const brief = await generateAccountBrief(account);
  res.json({ brief });
});

app.get("/api/account/:id/posts", (req, res) => {
  const account = scrapedAccounts.find((a: any) => a.id === req.params.id);
  if (!account) return res.json([]);
  const posts = scrapedPosts.filter((p: any) =>
    p.authorUsername === account.username && p.platform === account.platform
  ).slice(0, 10);
  res.json(posts);
});

app.get("/api/social/sentiment-timeline", (_req, res) => {
  res.json(computeSentimentTimeline());
});

app.get("/api/campaign/:id/brief", async (req, res) => {
  const campaign = scrapedCampaigns.find((c: any) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const brief = await generateCampaignBrief(campaign);
  res.json({ brief });
});

app.get("/api/scrapers/status", (_req, res) => {
  const tweets = scrapedPosts.filter((p: any) => p.platform === 'X').length;
  const ytPosts = scrapedPosts.filter((p: any) => p.platform === 'YouTube').length;
  const tkPosts = scrapedPosts.filter((p: any) => p.platform === 'TikTok').length;
  res.json({
    twitter: !!(process.env.TWITTER_COOKIES && process.env.TWITTER_COOKIES.includes("auth_token")),
    youtube: !!(process.env.YOUTUBE_API_KEY || (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)),
    tiktok: !!(process.env.TIKTOK_MS_TOKEN),
    postCounts: { twitter: tweets, youtube: ytPosts, tiktok: tkPosts },
    totalPosts: scrapedPosts.length,
    totalAccounts: scrapedAccounts.length,
    lastSync: new Date().toISOString(),
  });
});

app.get("/api/deep-alert", async (_req, res) => {
  // Logika deteksi kritis simulasi
  const critical = Math.random() < 0.05; 
  res.json({ isCritical: critical, message: 'Deteksi lonjakan aktivitas anomali terkoordinasi!' });
});

app.get("/api/trend", async (_req, res) => {
  // Ambil data sentimen untuk hari ini
  res.json(computeSentimentTimeline().slice(-1));
});

app.get("/api/trend/daily", async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayPosts = scrapedPosts.filter((p: any) =>
    p.publishedAt?.startsWith(today)
  );

  const platforms: Record<string, any> = {};
  const platformKeys = ['X', 'YouTube', 'TikTok'];

  platformKeys.forEach(pl => {
    const plPosts = todayPosts.filter((p: any) => p.platform === pl);
    const hashtags = plPosts.flatMap((p: any) => {
      const tags = (p.text || '').match(/#\w+/g) || [];
      return tags;
    });
    const topHashtags = [...new Set(hashtags)].slice(0, 5);
    const totalEngagement = plPosts.reduce((sum: number, p: any) => sum + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0);
    const sentiment = plPosts.filter((p: any) => (p.text || '').toLowerCase().includes('boikot') || (p.text || '').toLowerCase().includes('gagal')).length > plPosts.length / 3 ? 'Negative' : plPosts.length > 0 ? 'Neutral' : 'N/A';

    platforms[pl] = {
      postCount: plPosts.length,
      totalEngagement,
      topHashtags,
      avgSentiment: sentiment,
      topPosts: plPosts.slice(0, 3).map((p: any) => ({ text: p.text?.slice(0, 100), url: p.postUrl }))
    };
  });

  const sortedPlatforms = Object.entries(platforms).sort((a, b) => b[1].postCount - a[1].postCount);
  const dominantPlatform = sortedPlatforms.length > 0 ? sortedPlatforms[0][0] : 'N/A';
  const totalPosts = todayPosts.length;

  res.json({
    date: today,
    generatedAt: Date.now(),
    platforms,
    totalPosts,
    dominantPlatform,
    overallSentiment: totalPosts > 0 ? (todayPosts.filter((p: any) => (p.text || '').toLowerCase().includes('boikot')).length > todayPosts.length / 3 ? 'Negative' : 'Mixed') : 'N/A'
  });
});

// Serve static build (only if it exists — allows dev mode without building)
const BUILD_DIR = path.join(process.cwd(), 'frontend', 'build');
const hasBuild = existsSync(BUILD_DIR);
if (hasBuild) {
  app.use(express.static(BUILD_DIR));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(BUILD_DIR, 'index.html'));
  });
  console.log(`Serving static files from ${BUILD_DIR}`);
} else {
  console.warn(`No frontend build found at ${BUILD_DIR} — API only`);
  app.get("*", (_req, res) => {
    res.status(200).json({ message: "Buzztrack API is running. Build the frontend with 'npm run build' for the full UI." });
  });
}

const PORT = process.env.PORT || 3000;
const API_PORT = process.env.API_PORT || 3001;

// ----- Global error handler -----
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

server.listen(API_PORT, () => {
  console.log(`API server running on port ${API_PORT}`);
});
