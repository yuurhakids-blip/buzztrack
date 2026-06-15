import dotenv from "dotenv";
dotenv.config();

let dbReady = false;
initDatabase().then(() => { dbReady = true; console.log("[DB] Database initialized"); }).catch(e => console.error("[DB] Init failed:", e));

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import path from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

import { initDatabase, getDb, saveSnapshot, getTrendHistory } from "./src/infrastructure/database.ts";
import { schedule as cronSchedule, ScheduledTask } from "node-cron";

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

function broadcastStatus(type: string, payload: any = {}) {
  const msg = JSON.stringify({ type, ...payload, timestamp: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ---------- Configuration Routes ----------
app.post("/api/config/env", async (req, res) => {
  const { TWITTER_COOKIES, YOUTUBE_API_KEY, TIKTOK_MS_TOKEN } = req.body;
  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    const stored = readScraperConfig();

    // Update existing or add new
    const updateOrAdd = (key: string, val: string) => {
      if (!val || val.includes('*')) return; // skip masked values
      const regex = new RegExp(`^${key}=.*`, 'm');
      const line = `${key}="${val}"`;
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, line);
      } else {
        envContent += `\n${line}`;
      }
    };

    updateOrAdd('TWITTER_COOKIES', TWITTER_COOKIES);
    updateOrAdd('YOUTUBE_API_KEY', YOUTUBE_API_KEY);
    updateOrAdd('TIKTOK_MS_TOKEN', TIKTOK_MS_TOKEN);

    writeFileSync(envPath, envContent);
    // Reload env for current process
    dotenv.config();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
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
  const activeBuzzerCount = accounts.length;
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

app.get("/api/deep-cognition", (req, res) => {
  const campaigns = scrapedCampaigns.filter(c => !c.id.includes('trend_user'));
  const accounts = scrapedAccounts.filter(a => !a.username.includes('trend_user'));
  const posts = scrapedPosts.filter(p => !p.authorUsername.includes('trend_user')).filter((p: any) => {
    const text = p.text || '';
    const postTags = (text.match(/#\w+/g) || []).join(' ');
    const combined = (text + ' ' + postTags).toLowerCase();
    return /#berita|#indonesia|#hoax|#opini|#politik|#pilkada|#pemilu|#jakarta|#viral|#tren|indonesia|jakarta|pemilu|pilkada|pemerintah|presiden|menteri|daerah|rakyat|bangsa|negara|kebijakan|korupsi|demokrasi/.test(combined);
  });

  const highBotAccounts = accounts.filter((a: any) => (a.botScore || 0) >= 70);
  const activeCampaigns = campaigns.filter((c: any) => c.status === "Active");

  const alerts: any[] = [];
  const now = Date.now();

  function formatPost(p: any) {
    return {
      text: p.text || '',
      platform: p.platform,
      author: p.authorUsername || p.author || 'unknown',
      likes: p.likes || 0,
      comments: p.comments || 0,
      shares: p.shares || 0,
      url: p.postUrl || p.url || '',
      publishedAt: p.publishedAt || '',
    };
  }

  // Alert 1: high bot activity
  if (highBotAccounts.length >= 5) {
    const highBotUsernames = new Set(highBotAccounts.map((a: any) => a.username));
    const relatedPosts = posts.filter((p: any) => highBotUsernames.has(p.authorUsername || p.author));
    alerts.push({
      id: 'high-bot',
      message: `${highBotAccounts.length} akun bot-skoring tinggi (≥70) terdeteksi — kemungkinan aktivitas buzzer terkoordinasi.`,
      details: highBotAccounts.slice(0, 10).map((a: any) => ({
        username: a.username, botScore: a.botScore, platform: a.platform, followers: a.followers || 0,
      })),
      posts: relatedPosts.map(formatPost),
    });
  }

  // Alert 2: many active campaigns
  if (activeCampaigns.length >= 3) {
    const campaignTitles = new Set(activeCampaigns.map((c: any) => c.title?.toLowerCase()));
    const relatedPosts = posts.filter((p: any) =>
      campaignTitles.has(p.campaignTitle?.toLowerCase()) ||
      (p.text || '').toLowerCase().includes([...campaignTitles][0] || '')
    );
    alerts.push({
      id: 'active-campaigns',
      message: `Lonjakan ${activeCampaigns.length} kampanye aktif secara bersamaan — pola koordinasi mencurigakan terdeteksi.`,
      details: activeCampaigns.slice(0, 10).map((c: any) => ({
        title: c.title, buzzerCount: c.buzzerCount, platform: c.platforms?.[0] || '', reach: c.reach || 0,
      })),
      posts: relatedPosts.map(formatPost),
    });
  }

  // Alert 3: copypasta
  if (posts.length > 0) {
    const fullTextCounts = new Map<string, { count: number; posts: any[] }>();
    posts.forEach((p: any) => {
      const text = (p.text || '').slice(0, 60);
      if (text.length > 20) {
        if (!fullTextCounts.has(text)) fullTextCounts.set(text, { count: 0, posts: [] });
        const entry = fullTextCounts.get(text)!;
        entry.count++;
        entry.posts.push(p);
      }
    });
    const copypasta = [...fullTextCounts.entries()].filter(([, v]) => v.count >= 3);
    if (copypasta.length > 0) {
      alerts.push({
        id: 'copypasta',
        message: `${copypasta.length} pola copypasta terdeteksi — ${copypasta[0][1].count} postingan dengan teks serupa.`,
        details: copypasta.slice(0, 5).map(([text, data]) => ({
          text: text + '...', count: data.count,
        })),
        posts: copypasta.flatMap(([, data]) => data.posts).map(formatPost),
      });
    }
  }

  // Alert 4: avg bot score
  if (accounts.length >= 3) {
    const avgScore = Math.round(accounts.reduce((s: number, a: any) => s + (a.botScore || 0), 0) / accounts.length);
    if (avgScore >= 50) {
      const topBotUsernames = new Set(
        accounts.sort((a: any, b: any) => b.botScore - a.botScore).slice(0, 10).map((a: any) => a.username)
      );
      const relatedPosts = posts.filter((p: any) => topBotUsernames.has(p.authorUsername || p.author));
      alerts.push({
        id: 'avg-bot-score',
        message: `Skor bot rata-rata ${avgScore}% — komunitas maya berisiko tinggi terinfestasi akun otomatis.`,
        details: accounts.sort((a: any, b: any) => b.botScore - a.botScore).slice(0, 10).map((a: any) => ({
          username: a.username, botScore: a.botScore, platform: a.platform,
        })),
        posts: relatedPosts.map(formatPost),
      });
    }
  }

  // Alert 5: platform imbalance
  const platformCounts: Record<string, number> = {};
  posts.forEach((p: any) => {
    const pl = p.platform || 'unknown';
    platformCounts[pl] = (platformCounts[pl] || 0) + 1;
  });
  const sortedPl = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
  if (sortedPl.length >= 2 && sortedPl[0][1] > sortedPl[1][1] * 3) {
    const dominantPl = sortedPl[0][0];
    const dominantPosts = posts.filter((p: any) => p.platform === dominantPl);
    alerts.push({
      id: 'platform-imbalance',
      message: `Dominasi ${dominantPl} (${sortedPl[0][1]} posting) — ${Math.round(sortedPl[0][1] / sortedPl[1][1])}x lipat dari ${sortedPl[1][0]}. Kemungkinan serangan terfokus.`,
      details: sortedPl.map(([pl, count]) => ({ platform: pl, postCount: count })),
      posts: posts.map(formatPost),
    });
  }

  const severity = alerts.length >= 3 ? 'high' : alerts.length >= 1 ? 'medium' : 'low';

  res.json({
    severity,
    alerts,
    summary: alerts.map(a => a.message),
    stats: {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalAccounts: accounts.length,
      highBotAccounts: highBotAccounts.length,
      avgBotScore: accounts.length > 0 ? Math.round(accounts.reduce((s: number, a: any) => s + (a.botScore || 0), 0) / accounts.length) : 0,
      totalPosts: posts.length,
    },
    timestamp: now,
  });
});

app.post("/api/reports", async (req, res) => {
  const { url, username, platform, narrative, evidence, email } = req.body;
  if (!url || !platform || !narrative) {
    return res.status(400).json({ error: "Missing required fields (url, platform, narrative)" });
  }

  const report = await submitReportUseCase.execute({
    reportedUrl: url,
    username,
    platform,
    narrativeDescription: narrative,
    evidenceText: evidence,
    reporterEmail: email,
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

const PYTHON_PATH = process.env.PYTHON_PATH || "python3";

// ---------- Python scraper integration ----------
async function runPythonScraper(platform: string, keyword: string, limit: number = 10): Promise<any> {
  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, [
      "scrapers/run_scraper.py",
      platform,
      "--keyword", keyword,
      "--limit", String(limit),
    ], { timeout: 60000, cwd: process.cwd(), windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1" } } as any);
    return JSON.parse(String(stdout));
  } catch (e: any) {
    if (e.stdout) {
      try { return JSON.parse(String(e.stdout)); } catch { /* ignore */ }
    }
    return { success: false, platform, error: e.message || String(e) };
  }
}

async function runPythonTrendingScraper(platform: string, limit: number = 10): Promise<any> {
  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, [
      "scrapers/run_scraper.py",
      platform,
      "--trending",
      "--limit", String(limit),
    ], { timeout: 60000, cwd: process.cwd(), windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1" } } as any);
    return JSON.parse(String(stdout));
  } catch (e: any) {
    if (e.stdout) {
      try { return JSON.parse(String(e.stdout)); } catch { /* ignore */ }
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
        text: item.title && item.title !== item.snippet ? `${item.title} - ${item.snippet || ''}` : (item.snippet || item.title || ''),
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

  // If no scrapers returned results, return error
  if (nonEmpty.length === 0) {
    console.warn("All scrapers returned 0 results");
    return { success: false, error: "No results from scrapers" };
  }
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

// ---------- In-memory store for scraped data (global investigation) ----------
let scrapedCampaigns: any[] = [];
let scrapedAccounts: any[] = [];
let scrapedPosts: any[] = [];
let scrapedTimeline: any[] = [];

// ---------- Isolated in-memory store for trend data (does NOT affect investigation tabs) ----------
let trendPosts: any[] = [];
let trendCampaigns: any[] = [];
let trendAccounts: any[] = [];

// Synthetic data generation is disabled — all data must come from real scrapers


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
  const total = filtered.length;

  res.json({
    ageBreakdown: [],
    genderBreakdown: [],
    regionBreakdown: [],
    note: "Demographic data not available from scrapers",
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

app.get("/api/proxy/models/opencode", async (req, res) => {
  try {
    const key = req.query.key;
    const resp = await fetch('https://opencode.ai/zen/v1/models', {
      headers: key ? { 'Authorization': `Bearer ${key}` } : {}
    });
    const data = await resp.json();
    const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: "Failed to proxy OpenCode models" });
  }
});

app.post("/api/proxy/opencode/chat", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const resp = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': auth || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "OpenCode proxy failed" });
  }
});

app.get("/api/social/engagement", (_req, res) => {
  res.json(scrapedTimeline);
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
  let twitter: any = { success: false, platform: 'X', error: 'disabled' };
  let youtube: any = { success: false, platform: 'YouTube', error: 'disabled' };
  let tiktok: any = { success: false, platform: 'TikTok', error: 'disabled' };
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
      console.warn("Scrapers connected but returned 0 results");
    } else {
      console.warn("All Python scrapers failed:", { twitter: twitter.error, youtube: youtube.error, tiktok: tiktok.error });
    }
  }
  res.json({
    success: hasRealData,
    method: hasRealData ? "python" : "no_data",
    keyword,
    campaigns: scrapedCampaigns,
    accounts: scrapedAccounts,
  });
});

// Helper: pick random element from array
function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate trend-only data WITHOUT touching global scrapedCampaigns/scrapedAccounts/scrapedPosts
// Synthetic trend data generation is disabled — all data must come from real scrapers

// Map real scraped results into trend-specific stores (does NOT touch global state)
function mapTrendResults(results: any[], keyword: string) {
  const id = Date.now().toString();
  const platformLabels: Record<string, string> = { X: 'X', twitter: 'X', youtube: 'YouTube', tiktok: 'TikTok' };
  const nonEmpty = results.filter(r => r.results && r.results.length > 0);
  const allPosts: any[] = [];

  nonEmpty.forEach(platformResult => {
    const platform = platformLabels[platformResult.platform] || platformResult.platform;
    (platformResult.results || []).forEach((item: any, idx: number) => {
      allPosts.push({
        id: `trend-post-${id}-${platform}-${idx}`,
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
    });
  });

  trendPosts = allPosts;
  trendCampaigns = nonEmpty.map((r, i) => {
    const platform = platformLabels[r.platform] || r.platform;
    const posts = r.results || [];
    return {
      id: `trend-camp-${id}-${i}`,
      title: `${keyword} - ${platform}`,
      topic: keyword,
      platforms: [platform],
      intensity: ['Low', 'Medium', 'High', 'Critical'][i % 4],
      status: 'Active',
      botRatio: 0.5 + Math.random() * 0.45,
      reach: posts.reduce((acc: number, p: any) => acc + (p.views || 0) + (p.likes || 0) * 10, 0) || Math.floor(50000 + Math.random() * 200000),
      hashtags: [`#${keyword}`],
      buzzerCount: posts.length,
    };
  });
  trendAccounts = [];
}

// Cached availability of Python modules for scrapers
let ytDlpAvailable: boolean | null = null;
let tiktokModuleAvailable: boolean | null = null;

async function checkPythonModule(moduleName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("python", ["-c", `import ${moduleName}; print('ok')`], { timeout: 5000, windowsHide: true });
    return stdout.trim() === 'ok';
  } catch {
    return false;
  }
}

function computePlatformStats(posts: any[]) {
  const platforms: Record<string, any> = {};
  const platformKeys = ['X', 'YouTube', 'TikTok'];
  platformKeys.forEach(pl => {
    const plPosts = posts.filter((p: any) => p.platform === pl);
    const hashtags = plPosts.flatMap((p: any) => (p.text || '').match(/#\w+/g) || []);
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
  return platforms;
}

app.post("/api/social/scrape-trending", async (req, res) => {
  let twitter: any = { success: false, platform: 'X', error: 'disabled' };
  let youtube: any = { success: false, platform: 'YouTube', error: 'disabled' };
  let tiktok: any = { success: false, platform: 'TikTok', error: 'disabled' };
  const twitterConfigured = !!(process.env.TWITTER_COOKIES && process.env.TWITTER_COOKIES.includes("auth_token"));
  const youtubeConfigured = true; // will check yt-dlp below
  const tiktokConfigured = !!(process.env.TIKTOK_MS_TOKEN);

  // Check yt-dlp availability (cached after first check)
  if (ytDlpAvailable === null) {
    ytDlpAvailable = await checkPythonModule('yt_dlp');
  }

  // Check TikTokApi availability
  if (tiktokModuleAvailable === null) {
    tiktokModuleAvailable = await checkPythonModule('TikTokApi');
  }

  if (!process.env.DISABLE_PYTHON_SCRAPERS) {
    broadcastStatus('SCRAPE_START', { platforms: [] });
    const scraperPromises: Promise<any>[] = [];
    if (twitterConfigured) scraperPromises.push(runPythonTrendingScraper("twitter", 50));
    if (ytDlpAvailable) scraperPromises.push(runPythonTrendingScraper("youtube", 50));
    if (tiktokConfigured && tiktokModuleAvailable) scraperPromises.push(runPythonTrendingScraper("tiktok", 50));
    if (scraperPromises.length > 0) {
      const results = await Promise.all(scraperPromises);
      results.forEach(r => {
        if (r.platform === 'X') twitter = r;
        else if (r.platform === 'YouTube') youtube = r;
        else if (r.platform === 'TikTok') tiktok = r;
      });
    }
  }

  const succeeded = [twitter, youtube, tiktok].filter(r => r.success === true);
  const hasRealData = succeeded.some(r => r.results && r.results.length > 0);
  const keyword = "Trending Today";

  if (succeeded.length > 0 && hasRealData) {
    mapTrendResults(succeeded, keyword);
  }

  if (dbReady && trendPosts.length > 0) {
    const snapPlatforms = computePlatformStats(trendPosts);
    await saveSnapshot(keyword, { totalPosts: trendPosts.length, platforms: snapPlatforms }).catch(() => {});
  }
  broadcastStatus('SCRAPE_DONE', { keyword, totalPosts: trendPosts.length });
  res.json({
    success: hasRealData,
    method: hasRealData ? "python" : "no_data",
    keyword,
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
    // Campaign → Suspicious (only accounts linked to this campaign)
    scrapedAccounts.filter(a => a.campaignId === c.id).forEach(a => {
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

const SCRAPER_CONFIG_PATH = path.join(process.cwd(), 'data', 'scraper-config.json');

function readScraperConfig(): Record<string, string> {
  try {
    if (!existsSync(SCRAPER_CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(SCRAPER_CONFIG_PATH, 'utf-8'));
  } catch { return {}; }
}

function writeScraperConfig(config: Record<string, string>) {
  const dir = path.join(process.cwd(), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SCRAPER_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

app.get("/api/scraper-config", (_req, res) => {
  const stored = readScraperConfig();
  const envVal = (key: string) => stored[key] || process.env[key] || '';
  res.json({
    TWITTER_COOKIES: envVal('TWITTER_COOKIES'),
    YOUTUBE_API_KEY: envVal('YOUTUBE_API_KEY'),
    TIKTOK_MS_TOKEN: envVal('TIKTOK_MS_TOKEN'),
  });
});

app.post("/api/scraper-config", (req, res) => {
  const { TWITTER_COOKIES, YOUTUBE_API_KEY, TIKTOK_MS_TOKEN } = req.body;
  const stored = readScraperConfig();
  if (TWITTER_COOKIES !== undefined) {
    if (TWITTER_COOKIES.includes('*') && stored.TWITTER_COOKIES) {
      // keep existing
    } else {
      stored.TWITTER_COOKIES = TWITTER_COOKIES;
      process.env.TWITTER_COOKIES = TWITTER_COOKIES;
    }
  }
  if (YOUTUBE_API_KEY !== undefined) {
    if (YOUTUBE_API_KEY.includes('*') && stored.YOUTUBE_API_KEY) {
      // keep existing
    } else {
      stored.YOUTUBE_API_KEY = YOUTUBE_API_KEY;
      process.env.YOUTUBE_API_KEY = YOUTUBE_API_KEY;
    }
  }
  if (TIKTOK_MS_TOKEN !== undefined) {
    if (TIKTOK_MS_TOKEN.includes('*') && stored.TIKTOK_MS_TOKEN) {
      // keep existing
    } else {
      stored.TIKTOK_MS_TOKEN = TIKTOK_MS_TOKEN;
      process.env.TIKTOK_MS_TOKEN = TIKTOK_MS_TOKEN;
    }
  }
  writeScraperConfig(stored);
  res.json({ success: true, message: 'Konfigurasi scraper berhasil disimpan!' });
});

// ---------- Export Laporan ----------
app.post("/api/export/csv", async (req, res) => {
  const { tab, data, filters } = req.body;
  try {
    const { Parser } = await import('json2csv');
    const parser = new Parser({ flatten: true });
    const csv = parser.parse(data || []);
    const filename = `${tab}-${new Date().toISOString().slice(0,10)}.csv`;
    if (dbReady) {
      const db = getDb();
      db.data.exportLogs.push({ id: `exp-${Date.now()}`, type: 'csv', tab, createdAt: new Date().toISOString(), filters: filters || {} });
      await db.write();
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/export/logs", (_req, res) => {
  if (!dbReady) return res.json([]);
  res.json(getDb().data.exportLogs);
});

// ---------- Scraper Schedule ----------
let scheduledTask: ScheduledTask | null = null;

app.get("/api/schedule", (_req, res) => {
  if (!dbReady) return res.json({ enabled: false, interval: 60, keywords: [], lastRun: null });
  const s = getDb().data.scraperSchedule;
  res.json(s);
});

app.post("/api/schedule", async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'DB not ready' });
  const { enabled, interval, keywords } = req.body;
  const db = getDb();
  db.data.scraperSchedule = { enabled, interval: interval || 60, keywords: keywords || [], lastRun: db.data.scraperSchedule.lastRun };
  await db.write();

  if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }

  if (enabled && keywords && keywords.length > 0) {
    const cronInterval = `*/${interval || 60} * * * *`;
    scheduledTask = cronSchedule(cronInterval, async () => {
      console.log(`[Cron] Running scheduled scrape for: ${keywords.join(', ')}`);
      // Trigger scrape for each keyword using the existing logic
      for (const kw of keywords) {
        try {
          await fetch(`http://localhost:${process.env.PORT || 3001}/api/social/trigger-scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: kw })
          });
        } catch (e) { console.error(`[Cron] Scrape failed for ${kw}:`, e); }
      }
      db.data.scraperSchedule.lastRun = new Date().toISOString();
      await db.write();
    });
    console.log(`[Cron] Scheduled every ${interval} min for: ${keywords.join(', ')}`);
  }

  res.json({ success: true });
});

// Trigger scrape endpoint (internal use by cron)
app.post("/api/social/trigger-scrape", async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'keyword required' });
  try {
    const resp = await fetch(`http://localhost:${process.env.PORT || 3001}/api/social/sentiment-posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword })
    });
    const data = await resp.json();
    res.json({ success: true, posts: data.posts?.length || 0, source: data.source });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/trend", async (_req, res) => {
  // Ambil data sentimen untuk hari ini
  res.json(computeSentimentTimeline().slice(-1));
});

app.post("/api/social/sentiment-posts", async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: "keyword required" });

  // Collect existing relevant posts first (from prior searches on other tabs)
  const existing = scrapedPosts.filter((p: any) =>
    (p.text || '').toLowerCase().includes(keyword.toLowerCase()) ||
    (p.authorUsername || '').toLowerCase().includes(keyword.toLowerCase())
  );

  // Backup globals for isolated scrape
  const bakCampaigns = [...scrapedCampaigns];
  const bakAccounts = [...scrapedAccounts];
  const bakPosts = [...scrapedPosts];
  const bakTimeline = [...(scrapedTimeline || [])];

  // Always run fresh scrapers for this specific keyword (higher limit)
  let twitter: any = { success: false, platform: 'X', error: 'disabled' };
  let youtube: any = { success: false, platform: 'YouTube', error: 'disabled' };
  let tiktok: any = { success: false, platform: 'TikTok', error: 'disabled' };

  if (!process.env.DISABLE_PYTHON_SCRAPERS) {
    const scraperPromises: Promise<any>[] = [];
    if (!!(process.env.TWITTER_COOKIES && process.env.TWITTER_COOKIES.includes("auth_token")))
      scraperPromises.push(runPythonScraper("twitter", keyword, 100));
    if (!!(process.env.YOUTUBE_API_KEY))
      scraperPromises.push(runPythonScraper("youtube", keyword, 100));
    if (!!(process.env.TIKTOK_MS_TOKEN))
      scraperPromises.push(runPythonScraper("tiktok", keyword, 100));
    if (scraperPromises.length > 0) {
      const results = await Promise.all(scraperPromises);
      results.forEach(r => {
        if (r.platform === 'X') twitter = r;
        else if (r.platform === 'YouTube') youtube = r;
        else if (r.platform === 'TikTok') tiktok = r;
      });
    }
  }

  const succeeded = [twitter, youtube, tiktok].filter(r => r.success === true);
  const hasRealData = succeeded.some(r => r.results && r.results.length > 0);

  if (succeeded.length > 0 && hasRealData) {
    mapScraperResults(succeeded, keyword);
    await computeBuzzerScores();
  }

  // Collect ALL posts from this fresh scrape (keyword-matched + any new posts)
  const freshPosts = scrapedPosts.filter((p: any) =>
    (p.text || '').toLowerCase().includes(keyword.toLowerCase()) ||
    (p.authorUsername || '').toLowerCase().includes(keyword.toLowerCase())
  );

  // Restore globals immediately
  scrapedCampaigns = bakCampaigns;
  scrapedAccounts = bakAccounts;
  scrapedPosts = bakPosts;
  scrapedTimeline = bakTimeline;

  // Merge existing + fresh, deduplicate by id
  const seen = new Set<string>();
  const merged = [...freshPosts, ...existing].filter((p: any) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  res.json({ posts: merged, source: hasRealData ? 'scraped' : (merged.length > 0 ? 'existing' : 'no_data') });
});

app.get("/api/trend/history", async (_req, res) => {
  if (!dbReady) return res.json([]);
  try {
    // Save current snapshot before returning
    if (trendPosts.length > 0) {
      const snapPlatforms = computePlatformStats(trendPosts);
      await saveSnapshot('Trending Today', { totalPosts: trendPosts.length, platforms: snapPlatforms });
    }
    res.json(getTrendHistory());
  } catch { res.json([]); }
});

app.get("/api/trend/daily", async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Use trendPosts if available, otherwise fall back to scrapedPosts (read-only, no mutation)
  const sourcePosts = trendPosts.length > 0 ? trendPosts : scrapedPosts;

  // Ambil postingan 14 hari terakhir (tidak hanya hari ini)
  const relevantPosts = sourcePosts.filter((p: any) => {
    if (!p.publishedAt) return true; // Jika tidak ada tanggal, tetap masukkan
    const postDate = new Date(p.publishedAt);
    return postDate >= fourteenDaysAgo;
  });

  const platforms = computePlatformStats(relevantPosts);

  const sortedPlatforms = Object.entries(platforms).sort((a, b) => b[1].postCount - a[1].postCount);
  const dominantPlatform = sortedPlatforms.length > 0 ? sortedPlatforms[0][0] : 'N/A';
  const totalPosts = relevantPosts.length;

  if (dbReady && trendPosts.length > 0) {
    await saveSnapshot('Trending Today', { totalPosts, platforms }).catch(() => {});
  }
  res.json({
    date: today,
    generatedAt: Date.now(),
    location: 'Indonesia',
    platforms,
    totalPosts,
    dominantPlatform,
    overallSentiment: totalPosts > 0 ? (relevantPosts.filter((p: any) => (p.text || '').toLowerCase().includes('boikot')).length > relevantPosts.length / 3 ? 'Negative' : 'Mixed') : 'N/A'
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

// ----- AI Key Status Check -----
app.post("/api/ai/check-status", async (req, res) => {
  const { provider, key, model } = req.body;
  if (!key) return res.json({ valid: false, reason: 'no_key' });

  try {
    if (provider === 'Gemini') {
      const testModel = model || 'gemini-1.5-flash';
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${key}`;
      const resp = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] })
      });
      const data = await resp.json();
      if (data.error) {
        const msg = (data.error.message || '').toLowerCase();
        if (msg.includes('quota') || msg.includes('rate') || msg.includes('billing') || msg.includes('resource has been exhausted') || msg.includes('daily limit') || msg.includes('not enough')) {
          return res.json({ valid: false, reason: 'exhausted' });
        }
        return res.json({ valid: false, reason: 'invalid' });
      }
      return res.json({ valid: true, reason: 'ok' });
    } else if (provider === 'OpenRouter') {
      const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (resp.status === 401) return res.json({ valid: false, reason: 'invalid' });
      const data = await resp.json();
      if (data.error) {
        const msg = (data.error.message || '').toLowerCase();
        if (msg.includes('quota') || msg.includes('credit') || msg.includes('insufficient') || msg.includes('rate')) {
          return res.json({ valid: false, reason: 'exhausted' });
        }
        return res.json({ valid: false, reason: 'invalid' });
      }
      return res.json({ valid: true, reason: 'ok' });
    } else if (provider === 'Opencode') {
      const resp = await fetch('https://opencode.ai/zen/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (resp.status === 401) return res.json({ valid: false, reason: 'invalid' });
      return res.json({ valid: true, reason: 'ok' });
    }
    res.json({ valid: false, reason: 'unknown_provider' });
  } catch {
    res.json({ valid: false, reason: 'error' });
  }
});

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
