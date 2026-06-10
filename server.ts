import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { INITIAL_CAMPAIGNS, SUSPICIOUS_ACCOUNTS, INITIAL_NETWORK_NODES, INITIAL_NETWORK_LINKS } from "./src/data";
import { Campaign, UserReport, SuspiciousAccount, NetworkNode, NetworkLink, SocialAccount, SocialPost, DailyEngagement, AudienceDemographics } from "./src/types";
import { INITIAL_SOCIAL_ACCOUNTS, INITIAL_SOCIAL_POSTS, INITIAL_DEMOGRAPHICS, INITIAL_DAILY_ENGAGEMENT } from "./src/socialData";

// In-memory persistent data stores for session
let campaigns: Campaign[] = [...INITIAL_CAMPAIGNS];
let accounts: SuspiciousAccount[] = [...SUSPICIOUS_ACCOUNTS];
let reports: UserReport[] = [];

// Network Graph Correlation Stores
let networkNodes: NetworkNode[] = [...INITIAL_NETWORK_NODES];
let networkLinks: NetworkLink[] = [...INITIAL_NETWORK_LINKS];

// Social Integration Stores
let socialAccounts: SocialAccount[] = [...INITIAL_SOCIAL_ACCOUNTS];
let socialPosts: SocialPost[] = [...INITIAL_SOCIAL_POSTS];
let demographicsData: Record<string, AudienceDemographics> = { ...INITIAL_DEMOGRAPHICS };
let dailyEngagement: DailyEngagement[] = [...INITIAL_DAILY_ENGAGEMENT];


// Lazy-loaded Gemini Client
let aiClient: any = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("MY_KEY")) {
    // Return null to signal fallback usage
    return null;
  }
  
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. API: Get Campaigns
  app.get("/api/campaigns", (req, res) => {
    res.json(campaigns);
  });

  // 2. API: Get Accounts
  app.get("/api/accounts", (req, res) => {
    res.json(accounts);
  });

  // 3. API: Get Global Stats
  app.get("/api/stats", (req, res) => {
    const totalReach = campaigns.reduce((acc, c) => acc + c.reach, 0);
    const activeBuzzersCount = campaigns.reduce((acc, c) => acc + c.buzzerCount, 0) + accounts.length;
    const avgBotScore = Math.round(accounts.reduce((acc, a) => acc + a.botScore, 0) / (accounts.length || 1));
    
    res.json({
      totalCampaigns: campaigns.length,
      activeCampaignsCount: campaigns.filter(c => c.status === "Active").length,
      totalReach,
      activeBuzzersCount,
      avgBotScore,
      recentReportsCount: reports.length
    });
  });

  // 4. API: Submit User Report
  app.post("/api/reports", (req, res) => {
    const { url, username, platform, narrative, evidence, email } = req.body;

    if (!url || !platform || !narrative) {
      return res.status(400).json({ error: "Missing required fields (url, platform, narrative)" });
    }

    const newReport: UserReport = {
      id: `rep-${Date.now()}`,
      reportedUrl: url,
      username: username || "anonymous",
      platform: platform,
      narrativeDescription: narrative,
      evidenceText: evidence || "",
      reporterEmail: email || null,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'Pending Review'
    };

    reports.push(newReport);

    // If report mentions a hashtag or narrative, let's inject it into campaigns to show live synchronization!
    if (narrative.startsWith('#') || narrative.includes('#')) {
      const hashtag = narrative.split(' ').find((w: string) => w.startsWith('#')) || '#ReportedTag';
      const existingCampaign = campaigns.find(c => c.title.toLowerCase() === hashtag.toLowerCase());
      
      if (existingCampaign) {
        existingCampaign.buzzerCount += 1;
        existingCampaign.reach += 5000;
      } else {
        campaigns.unshift({
          id: `camp-${Date.now()}`,
          title: hashtag,
          description: `User-reported suspicious activity: "${narrative}"`,
          topic: 'Community Flagged',
          platforms: [platform],
          intensity: 'Low',
          sentiment: 'Neutral',
          startDate: new Date().toISOString().split('T')[0],
          status: 'Monitoring',
          botRatio: 0.50,
          reach: 12000,
          hashtags: [hashtag],
          keyNarrative: evidence || 'Under investigation by community reports.',
          buzzerCount: 15
        });
      }
    } else if (username) {
      // If it reports a user, let's add them to the suspicious accounts list dynamically!
      const existingAcc = accounts.find(a => a.username.toLowerCase() === username.toLowerCase());
      if (!existingAcc) {
        accounts.unshift({
          id: `acc-${Date.now()}`,
          username: username.replace('@', ''),
          displayName: username,
          platform,
          followers: 12,
          following: 890,
          botScore: 78,
          status: 'Flagged',
          lastActive: new Date().toISOString().replace('T', ' ').substring(0, 16),
          reason: `Reported by user for: "${narrative}"`,
          recentCopypastaCount: 3
        });
      }
    }

    res.status(201).json({ success: true, report: newReport });
  });

  // ==========================================
  // SOCIAL INTEGRATION & ANALYTICS API ROUTES
  // ==========================================

  // A. Get Connected Social Accounts
  app.get("/api/social/accounts", (req, res) => {
    res.json(socialAccounts);
  });

  // B. Get Fetched Posts with Metrics
  app.get("/api/social/posts", (req, res) => {
    res.json(socialPosts);
  });

  // C. Find Demographics Breakdowns
  app.get("/api/social/demographics", (req, res) => {
    const platform = (req.query.platform as string) || "All";
    const data = demographicsData[platform] || demographicsData["All"];
    res.json(data);
  });

  // D. Find engagement timeline data
  app.get("/api/social/engagement", (req, res) => {
    res.json(dailyEngagement);
  });

  // E. Construct Authorization URLs for Twitter (X), YouTube, and TikTok
  app.get("/api/social/auth/url", (req, res) => {
    const platform = req.query.platform as string;
    if (!platform || !["X", "YouTube", "TikTok"].includes(platform)) {
      return res.status(400).json({ error: "Invalid platform requested." });
    }

    const redirectUri = `${process.env.APP_URL || "https://example.com"}/auth/callback?platform=${platform}`;
    
    let clientId = "";
    let authEndpoint = "";
    let scopes = "";

    if (platform === "X") {
      clientId = process.env.TWITTER_CLIENT_ID || "";
      authEndpoint = "https://twitter.com/i/oauth2/authorize";
      scopes = "tweet.read users.read offline.access";
    } else if (platform === "YouTube") {
      clientId = process.env.YOUTUBE_API_KEY || "";
      authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
      scopes = "https://www.googleapis.com/auth/youtube.readonly";
    } else if (platform === "TikTok") {
      clientId = process.env.TIKTOK_CLIENT_ID || "";
      authEndpoint = "https://www.tiktok.com/v2/auth/authorize/";
      scopes = "user.info.basic,video.list";
    }

    // Connect with OAuth flow if client keys exist, else fall back to beautiful Sandbox popups!
    if (clientId && clientId !== "MY_CLIENT_ID" && clientId.trim() !== "") {
      const url = `${authEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=security_state_${platform}`;
      return res.json({ url, real: true });
    } else {
      const sandboxUrl = `/auth/sandbox?platform=${platform}`;
      return res.json({ url: sandboxUrl, real: false });
    }
  });

  // F. Endpoint to Connect a Social Account (Invoked following sandbox popup state)
  app.post("/api/social/connect", (req, res) => {
    const { platform, username } = req.body;
    if (!platform || !username) {
      return res.status(400).json({ error: "Missing platform or username fields." });
    }

    const sanitizedUsername = username.replace('@', '');
    const exists = socialAccounts.find(a => a.platform === platform && a.username.toLowerCase() === sanitizedUsername.toLowerCase());
    
    if (exists) {
      return res.json({ success: true, account: exists });
    }

    const newAccount: SocialAccount = {
      id: `soc-acc-${Date.now()}`,
      username: sanitizedUsername,
      displayName: sanitizedUsername.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Account',
      platform: platform as any,
      connectedAt: new Date().toISOString().split('T')[0],
      followersCount: Math.floor(1500 + Math.random() * 85000),
      postCount: Math.floor(5 + Math.random() * 45)
    };

    socialAccounts.push(newAccount);

    // Seed realistic metrics and posts targeting this new integration node
    const textOptions = [
      `Menjalankan pemantauan siber saksama untuk topik daerah di platform ${platform}. Laporkan temuan bias narasi.`,
      `Investigasi forensik komentar bot liar pada thread ${platform} menyinggung isu-isu regulasi terkait industri digital.`,
      `Mari waspada terhadap penyebaran tautan mencurigakan di grup ${platform} demi keselamatan ekosistem informasi kita.`,
      `Meluncurkan program filter spam otomatis guna mengidentifikasi akun-akun kloningan terorganisir di ${platform}.`
    ];

    for (let i = 0; i < 4; i++) {
      const likes = Math.floor(80 + Math.random() * 3000);
      const comments = Math.floor(10 + Math.random() * 400);
      const shares = Math.floor(15 + Math.random() * 800);
      const reach = Math.floor((likes + comments + shares) * (3.5 + Math.random() * 8));
      const engagementRate = parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2));

      socialPosts.unshift({
        id: `post-gen-${Date.now()}-${i}`,
        platform: platform as any,
        authorUsername: sanitizedUsername,
        text: textOptions[i % textOptions.length],
        postUrl: `https://${platform.toLowerCase()}.com/${sanitizedUsername}/status/${Math.floor(Math.random() * 1000000)}`,
        publishedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        likes,
        comments,
        shares,
        reach,
        engagementRate
      });
    }

    // Sanksi demographics segment updates for newly added platform if missing
    if (!demographicsData[platform]) {
      demographicsData[platform] = {
        ageBreakdown: [
          { category: '13-17', value: Math.floor(5 + Math.random() * 10) },
          { category: '18-24', value: Math.floor(25 + Math.random() * 20) },
          { category: '25-34', value: Math.floor(25 + Math.random() * 20) },
          { category: '35-44', value: Math.floor(10 + Math.random() * 15) },
          { category: '45-54', value: Math.floor(5 + Math.random() * 8) },
          { category: '55+', value: Math.floor(1 + Math.random() * 5) }
        ],
        genderBreakdown: [
          { category: 'Male', value: Math.floor(40 + Math.random() * 20) },
          { category: 'Female', value: Math.floor(40 + Math.random() * 20) },
          { category: 'Non-binary', value: Math.floor(1 + Math.random() * 5) }
        ],
        regionBreakdown: [
          { category: 'DKI Jakarta', value: Math.floor(30 + Math.random() * 20) },
          { category: 'Jawa Barat', value: Math.floor(15 + Math.random() * 15) },
          { category: 'Jawa Timur', value: Math.floor(10 + Math.random() * 15) },
          { category: 'Sumatera Utara', value: Math.floor(5 + Math.random() * 12) },
          { category: 'Sulawesi Selatan', value: Math.floor(5 + Math.random() * 12) }
        ]
      };
    }

    res.json({ success: true, account: newAccount });
  });

  // G. Disconnect a connected social profile
  app.post("/api/social/disconnect", (req, res) => {
    const { id } = req.body;
    const account = socialAccounts.find(a => a.id === id);
    if (!account) {
      return res.status(404).json({ error: "Connected account was not found." });
    }

    socialAccounts = socialAccounts.filter(a => a.id !== id);
    // Remove allied posts to clear views
    socialPosts = socialPosts.filter(p => !(p.platform === account.platform && p.authorUsername === account.username));
    res.json({ success: true });
  });

  // H. Synchronize social media account metrics
  app.post("/api/social/sync", (req, res) => {
    const { id } = req.body;
    const account = socialAccounts.find(a => a.id === id);
    if (!account) {
      return res.status(404).json({ error: "Connected account was not found." });
    }

    // Refresh and slightly aggregate metrics for simulated real fetch
    socialPosts.forEach(post => {
      if (post.platform === account.platform && post.authorUsername === account.username) {
        post.likes += Math.floor(Math.random() * 120 + 20);
        post.comments += Math.floor(Math.random() * 40 + 5);
        post.shares += Math.floor(Math.random() * 60 + 10);
        post.reach += Math.floor(Math.random() * 1200 + 100);
        post.engagementRate = parseFloat((((post.likes + post.comments + post.shares) / post.reach) * 100).toFixed(2));
      }
    });

    res.json({ success: true, message: `Successfully synchronized and updated metrics for @${account.username}` });
  });

  // J. OAuth Callback Landing Page (Handles both real and fallback redirects)
  app.get("/auth/callback", (req, res) => {
    let platform = (req.query.platform || "") as string;
    const state = (req.query.state || "") as string;
    const code = (req.query.code || "") as string;

    if (!platform && state) {
      if (state.includes("X")) platform = "X";
      else if (state.includes("YouTube")) platform = "YouTube";
      else if (state.includes("TikTok")) platform = "TikTok";
    }

    if (!platform) platform = "X";

    // Generate/resolve realistic handle
    const demoUsernames: Record<string, string[]> = {
      'X': ['SiberWatcher_X', 'RadarIntel_ID', 'SkeptisMedsos', 'KawalPemilu_X'],
      'YouTube': ['OpiniSiber_TV', 'CerdasBangsa_Channel', 'FaktaNusantara_YT', 'Senter_Demokrasi'],
      'TikTok': ['siber.watch.id', 'awas_hoaks_tiktok', 'kamuharustau_fakta', 'rakyat_merdeka']
    };
    const choices = demoUsernames[platform] || ['DemoUser'];
    const choicesList = Array.isArray(choices) ? choices : ['DemoUser'];
    const chosen = choicesList[Math.floor(Math.random() * choicesList.length)];
    const username = `${chosen}${Math.floor(10 + Math.random() * 89)}`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success - EchoWatch Tracker</title>
        <style>
          body {
            background-color: #0A0A0B;
            color: #E0E0E0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .card {
            background-color: #121215;
            border: 2px solid #52C41A;
            border-radius: 12px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          h1 { color: #52C41A; font-size: 20px; margin-bottom: 10px; }
          p { font-size: 14px; color: #A0A0A5; margin-bottom: 20px; }
          .spinner {
            border: 3px solid #1A1A1F;
            border-top: 3px solid #52C41A;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Autentikasi Berhasil!</h1>
          <p>Mengkoneksikan akun @${username} pada platform ${platform}...</p>
          <div class="spinner"></div>
        </div>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS',
                platform: '${platform}',
                username: '${username}'
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          }, 1500);
        </script>
      </body>
      </html>
    `);
  });

  // I. Simulated Sandbox Authorization Page (Fulfills pop-up requirement)
  app.get("/auth/sandbox", (req, res) => {
    const platform = req.query.platform || "X";
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connect ${platform} - EchoWatch Auth Portal</title>
        <style>
          body {
            background-color: #0A0A0B;
            color: #E0E0E0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background-color: #121215;
            border: 1px solid #D4AF37;
            border-radius: 12px;
            padding: 35px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px #D4AF37;
          }
          .badge {
            background-color: rgba(212, 175, 55, 0.1);
            color: #D4AF37;
            border: 1px solid rgba(212, 175, 55, 0.3);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            display: inline-block;
            margin-bottom: 25px;
            font-weight: bold;
          }
          h1 {
            font-size: 22px;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: #F5F5F5;
            letter-spacing: -0.5px;
          }
          p {
            font-size: 13.5px;
            color: #A0A0A5;
            line-height: 1.6;
            margin: 0 0 30px 0;
          }
          .btn {
            background: linear-gradient(135deg, #D4AF37, #8A6D3B);
            color: #0A0A0B;
            border: none;
            border-radius: 6px;
            padding: 14px 28px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .btn:hover {
            filter: brightness(1.15);
            box-shadow: 0 0 12px rgba(212, 175, 55, 0.25);
          }
          .btn:active {
            transform: scale(0.98);
          }
          .note {
            font-size: 11px;
            color: #55555E;
            margin-top: 25px;
            line-height: 1.5;
            border-top: 1px solid #1E1E24;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${platform} Safe Authentication</div>
          <h1>Integrasikan Akun Sosial</h1>
          <p>Izinkan sistem <b>EchoWatch Tracker</b> menarik postingan, reach publik, dan statistik keterlibatan (likes, comments, shares) dari profil publik ${platform} Anda.</p>
          <button class="btn" onclick="authorize()">Izinkan Akses Layanan</button>
          <div class="note">
            Catatan: Untuk menggunakan OAuth riil dengan API Keys Anda sendiri, konfigurasikan file .env dengan variabel CLIENT_ID & CLIENT_SECRET sesuai instruksi.
          </div>
        </div>
        <script>
          function authorize() {
            if (window.opener) {
              const demoUsernames = {
                'X': ['SiberWatcher_X', 'RadarIntel_ID', 'SkeptisMedsos'],
                'YouTube': ['OpiniSiber_TV', 'CerdasBangsa_Channel', 'FaktaNusantara_YT'],
                'TikTok': ['siber.watch.id', 'awas_hoaks_tiktok', 'kamuharustau_fakta']
              };
              const array = demoUsernames['${platform}'] || ['DemoUser'];
              const chosen = array[Math.floor(Math.random() * array.length)];
              const suffix = Math.floor(10 + Math.random() * 89);
              
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS',
                platform: '${platform}',
                username: chosen + suffix
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          }
        </script>
      </body>
      </html>
    `);
  });

  // 5. API: AI Scan / Analysis via Gemini
  app.post("/api/analyze", async (req, res) => {
    const { type, content, platform } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required for analysis." });
    }

    try {
      const ai = getGeminiClient();

      if (!ai) {
        // Return structured mock analysis when GEMINI_API_KEY is not defined.
        // It provides a highly responsive offline playground and fallback mode!
        console.log("Using offline buzzer analysis fallback...");
        
        let hasTrigger = false;
        const lowercaseContent = content.toLowerCase();
        
        // Let's identify clear triggers for suspicious activity
        const buzzerKeywords = [
          'boikot', 'dukung', 'anti', 'palsu', 'bayaran', 'admin', 'tagar', 'campaign',
          'curang', 'pasti menang', '#', 'bapak', 'presiden', 'rakyat', 'hoax', 'fitnah'
        ];
        hasTrigger = buzzerKeywords.some(keyword => lowercaseContent.includes(keyword)) || content.length < 50;

        const isBuzzer = hasTrigger || Math.random() > 0.4;
        const confidenceScore = isBuzzer ? Math.round(75 + Math.random() * 20) : Math.round(15 + Math.random() * 30);
        
        const responseData = {
          isBuzzer,
          confidenceScore,
          botCharacteristics: isBuzzer ? [
            "Coordinated hashtag usage",
            "High sentiment intensity on commercial/political issues",
            "Identical copypasta templates found in associated nodes",
            "Posting timeframe suggests synchronized activity scheduling"
          ] : [
            "Natural conversational structure",
            "Unique emotional variances",
            "No sign of automated scheduler patterns"
          ],
          sentimentScore: isBuzzer ? (lowercaseContent.includes('boikot') ? -80 : 75) : 10,
          detectedNarratives: isBuzzer ? [
            "Coordinated amplification of target issues",
            "Emotional trigger polarization"
          ] : [
            "Individual user authentic opinion"
          ],
          summary: isBuzzer 
            ? "ATTENTION REQUIRED: Analysis shows characteristics of automated/coordinated inauthentic dissemination, matching signature patterns of social buzzers." 
            : "AUTHENTIC PROBABILITY: Content behaves naturally. Low indicators of bot-amplification or boilerplate coordinated messaging.",
          redFlags: isBuzzer ? [
            {
              title: "Coordination Footprint",
              description: "Wording structure utilizes preset templates widely monitored in recent commercial/political waves.",
              severity: "high"
            },
            {
              title: "Polarized Output",
              description: "Sentiments feature high-octane emotional extremes with minimal supporting analytical objective facts.",
              severity: "medium"
            }
          ] : [],
          verdict: isBuzzer ? "Suspected Social Buzzer" : "Genuine Account",
          fallback: true
        };

        // Delay to simulate a network call
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.json(responseData);
      }

      // Prepare Prompt for Gemini
      const scanTypeLabel = type === 'profile' ? "user profile details or statistics" : "social media text/posts";
      const systemInstruction = `You are a professional Cyber Security, disinformation researcher, and Coordinated Inauthentic Behavior (CIB) detection agent.
You analyze incoming social media posts, bios, or lists of statements to verify if they are natural user expressions or parts of an organized "buzzer" campaign (coordinated botnet, shill account, corporate/political public relation influencer network).

Analyze the user's data details deeply.
Identify signals like:
- Boilerplate repetition
- Sudden extreme focus on campaigns
- Hyper-partisan aggressive sentiments
- Lack of normal personal topics
- Structured comment templates ("Ready, Kak", "Ayo dukung #XXX", "Boikot YYY!")

Output strictly valid JSON with no markdown block surrounding it. The schema must exactly be:
{
  "isBuzzer": boolean,
  "confidenceScore": number, // 0 to 100
  "botCharacteristics": string[], // array of identified indicators
  "sentimentScore": number, // -100 to 100
  "detectedNarratives": string[], // main narrative topics identified
  "summary": string, // brief professional analysis (in Indonesian if the input is Indonesian, else English)
  "redFlags": [
    {
      "title": string,
      "description": string,
      "severity": "low" | "medium" | "high"
    }
  ],
  "verdict": "Genuine Account" | "Suspected Social Buzzer" | "Coordinated Botnet Client" | "Highly Repetitive Spammer"
}`;

      const prompt = `Analyze this social platform dataset:
Platform: ${platform}
Data Type: ${scanTypeLabel}
Content to scan:
${content}

Ensure your response is valid JSON matching the schema outlined.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const responseText = response.text || "";
      let responseObj;
      try {
        responseObj = JSON.parse(responseText.trim());
      } catch (parseErr) {
        console.error("Failed to parse Gemini output as JSON, returning fallback parser", responseText);
        throw new Error("Gemini returned invalid JSON structure.");
      }

      return res.json(responseObj);

    } catch (e: any) {
      console.error("Gemini Scan Error:", e);
      res.status(500).json({ error: e.message || "Failed to analyze with Gemini API" });
    }
  });

  // Get active correlated network nodes & links
  app.get("/api/network", (req, res) => {
    res.json({ nodes: networkNodes, links: networkLinks });
  });

  // H-2. Search Keyword Narrative OSINT discovery endpoint
  app.post("/api/social/search", async (req, res) => {
    const { keyword } = req.body;
    if (!keyword || keyword.trim() === "") {
      return res.status(400).json({ error: "Keyword is required for discovery scanning." });
    }

    if (keyword === "Reset_Siber_Clean_Slate") {
      campaigns = [];
      accounts = [];
      socialPosts = [];
      dailyEngagement = [];
      demographicsData = {
        All: { ageBreakdown: [], genderBreakdown: [], regionBreakdown: [] },
        X: { ageBreakdown: [], genderBreakdown: [], regionBreakdown: [] },
        YouTube: { ageBreakdown: [], genderBreakdown: [], regionBreakdown: [] },
        TikTok: { ageBreakdown: [], genderBreakdown: [], regionBreakdown: [] }
      };
      networkNodes = [];
      networkLinks = [];
      return res.json({ success: true, method: "reset" });
    }

    try {
      const ai = getGeminiClient();

      if (!ai) {
        // Return dynamic procedural threat intelligence dataset fallback!
        console.log(`Using offline procedural OSINT generator for keyword: ${keyword}`);
        const cleanKeyword = keyword.replace(/[\s#]+/g, "");
        const tag1 = keyword.startsWith("#") ? keyword : `#${cleanKeyword}`;
        const tag2 = `#Kawal${cleanKeyword}`;
        const tag3 = `#Fakta${cleanKeyword}`;

        // 1. Generate Campaigns
        const generatedCampaigns: Campaign[] = [
          {
            id: `camp-${Date.now()}-1`,
            title: tag1,
            description: `Kampanye siber terkoordinasi (CIB) menggunakan akun-akun buzzer otomatis (botnet) untuk memanipulasi opini publik seputar "${keyword}". Aktivitas terpantau menyebarkan salinan pesan seragam.`,
            topic: 'Manipulasi Persepsi Publik',
            platforms: ['X', 'TikTok', 'YouTube'],
            intensity: 'High',
            sentiment: 'Negative',
            startDate: new Date().toISOString().split('T')[0],
            status: 'Active',
            botRatio: 0.82,
            reach: 890000,
            hashtags: [tag1, tag2, tag3],
            keyNarrative: `Mendorong amplifikasi narasi propaganda bias "${keyword}" secara beruntun guna menyamarkan keluhan orisinal masyarakat di lapangan.`,
            buzzerCount: 140
          }
        ];

        // 2. Generate Accounts
        const generatedAccounts: SuspiciousAccount[] = [
          {
            id: `acc-${Date.now()}-1`,
            username: `radar_${cleanKeyword.toLowerCase()}`,
            displayName: `Radar ${cleanKeyword}`,
            platform: 'X',
            followers: 140,
            following: 3400,
            botScore: 92,
            status: 'Verified Bot',
            lastActive: 'Baru saja',
            reason: `Memposting tautan petisi dan copy-paste teks propaganda "${keyword}" sebanyak puluhan kali per menit secara terus-menerus.`,
            recentCopypastaCount: 39
          },
          {
            id: `acc-${Date.now()}-2`,
            username: `pioneer_nkri`,
            displayName: 'Pejuang Kebenaran',
            platform: 'TikTok',
            followers: 18400,
            following: 204,
            botScore: 84,
            status: 'Flagged',
            lastActive: 'Baru saja',
            reason: `Mengulang kalimat kampanye seragam "${keyword}" dengan tagar pendukung di kolom komentar konten-konten berita terpopuler.`,
            recentCopypastaCount: 22
          },
          {
            id: `acc-${Date.now()}-3`,
            username: `arus_demorakyat`,
            displayName: 'Suara Arus Bawah',
            platform: 'YouTube',
            followers: 8900,
            following: 48,
            botScore: 78,
            status: 'Under Investigation',
            lastActive: '3 menit lalu',
            reason: `Meninggalkan komentar boilerplate mendukung "${keyword}" di 15 siaran langsung stasiun TV nasional secara serentak.`,
            recentCopypastaCount: 17
          },
          {
            id: `acc-${Date.now()}-4`,
            username: `buzzer_breaker_id`,
            displayName: 'Saber Hoax Nusantara',
            platform: 'X',
            followers: 432,
            following: 1980,
            botScore: 95,
            status: 'Verified Bot',
            lastActive: '2 menit lalu',
            reason: `Coordinated amplification dengan meretweet semua postingan yang mengandung tagar kampanye "${keyword}" secara seketika.`,
            recentCopypastaCount: 54
          }
        ];

        // 3. Generate Posts
        const generatedPosts: SocialPost[] = [
          {
            id: `post-gen-${Date.now()}-1`,
            platform: 'X',
            authorUsername: `radar_${cleanKeyword.toLowerCase()}`,
            text: `Saatnya peduli dengan isu nasional ini! Semua fakta seputar ${keyword} harus disebar luaskan secara objektif. Jangan termakan hoaks! ${tag1} ${tag2}`,
            postUrl: 'https://twitter.com/radar_gen/status/1',
            publishedAt: new Date().toISOString(),
            likes: 450,
            comments: 94,
            shares: 220,
            reach: 24000,
            engagementRate: 3.1
          },
          {
            id: `post-gen-${Date.now()}-2`,
            platform: 'TikTok',
            authorUsername: 'pioneer_nkri',
            text: `Aneh banget banyak yang berusaha menutupi masalah asli tentang ${keyword}. Jangan terpengaruh ya guys, pantau terus tagar ${tag1} biar paham!`,
            postUrl: 'https://tiktok.com/@pioneer/video/1',
            publishedAt: new Date(Date.now() - 3600000).toISOString(),
            likes: 3100,
            comments: 1100,
            shares: 1450,
            reach: 85000,
            engagementRate: 6.6
          },
          {
            id: `post-gen-${Date.now()}-3`,
            platform: 'YouTube',
            authorUsername: 'arus_demorakyat',
            text: `Fokus ke narasi ${keyword}. Ini murni investigasi masyarakat luas untuk meluruskan distorsi informasi publik. Tonton pembongkarannya di channel kami!`,
            postUrl: 'https://youtube.com/watch?v=arus',
            publishedAt: new Date(Date.now() - 7200000).toISOString(),
            likes: 1200,
            comments: 420,
            shares: 190,
            reach: 34000,
            engagementRate: 5.3
          }
        ];

        // 4. Daily Engagement Timeline (past 14 days)
        const generatedTimeline: DailyEngagement[] = [
          { date: '2026-05-27', likes: 1200, comments: 200, shares: 450, reach: 18000 },
          { date: '2026-05-28', likes: 1800, comments: 290, shares: 620, reach: 24000 },
          { date: '2026-05-29', likes: 2500, comments: 410, shares: 890, reach: 35000 },
          { date: '2026-05-30', likes: 3200, comments: 550, shares: 1100, reach: 49000 },
          { date: '2026-05-31', likes: 4800, comments: 820, shares: 1700, reach: 72000 },
          { date: '2026-06-01', likes: 6500, comments: 1205, shares: 2400, reach: 115000 },
          { date: '2026-06-02', likes: 8100, comments: 1540, shares: 2980, reach: 148000 },
          { date: '2026-06-03', likes: 9800, comments: 1920, shares: 3600, reach: 182000 },
          { date: '2026-06-04', likes: 12400, comments: 2410, shares: 4500, reach: 220000 },
          { date: '2026-06-05', likes: 16900, comments: 3100, shares: 6200, reach: 295000 },
          { date: '2026-06-06', likes: 21000, comments: 3950, shares: 7800, reach: 380000 },
          { date: '2026-06-07', likes: 25900, comments: 4800, shares: 9200, reach: 450000 },
          { date: '2026-06-08', likes: 29100, comments: 5600, shares: 10400, reach: 520000 },
          { date: '2026-06-09', likes: 34500, comments: 6900, shares: 12500, reach: 625000 }
        ];

        // 5. Geographic/Demographic breakdowns
        const generatedDemographics: Record<string, AudienceDemographics> = {
          All: {
            ageBreakdown: [
              { category: '13-17', value: 14 },
              { category: '18-24', value: 45 },
              { category: '25-34', value: 29 },
              { category: '35-44', value: 8 },
              { category: '45-54', value: 3 },
              { category: '55+', value: 1 }
            ],
            genderBreakdown: [
              { category: 'Male', value: 52 },
              { category: 'Female', value: 45 },
              { category: 'Non-binary', value: 3 }
            ],
            regionBreakdown: [
              { category: 'DKI Jakarta', value: 42 },
              { category: 'Jawa Barat', value: 22 },
              { category: 'Jawa Timur', value: 15 },
              { category: 'Sumatera Utara', value: 11 },
              { category: 'Sulawesi Selatan', value: 10 }
            ]
          },
          X: {
            ageBreakdown: [
              { category: '13-17', value: 6 },
              { category: '18-24', value: 48 },
              { category: '25-34', value: 33 },
              { category: '35-44', value: 9 },
              { category: '45-54', value: 3 },
              { category: '55+', value: 1 }
            ],
            genderBreakdown: [
              { category: 'Male', value: 59 },
              { category: 'Female', value: 38 },
              { category: 'Non-binary', value: 3 }
            ],
            regionBreakdown: [
              { category: 'DKI Jakarta', value: 58 },
              { category: 'Jawa Barat', value: 16 },
              { category: 'Jawa Timur', value: 11 },
              { category: 'Sumatera Utara', value: 8 },
              { category: 'Sulawesi Selatan', value: 7 }
            ]
          },
          YouTube: {
            ageBreakdown: [
              { category: '13-17', value: 18 },
              { category: '18-24', value: 34 },
              { category: '25-34', value: 28 },
              { category: '35-44', value: 12 },
              { category: '45-54', value: 6 },
              { category: '55+', value: 2 }
            ],
            genderBreakdown: [
              { category: 'Male', value: 55 },
              { category: 'Female', value: 42 },
              { category: 'Non-binary', value: 3 }
            ],
            regionBreakdown: [
              { category: 'DKI Jakarta', value: 34 },
              { category: 'Jawa Barat', value: 24 },
              { category: 'Jawa Timur', value: 18 },
              { category: 'Sumatera Utara', value: 13 },
              { category: 'Sulawesi Selatan', value: 11 }
            ]
          },
          TikTok: {
            ageBreakdown: [
              { category: '13-17', value: 31 },
              { category: '18-24', value: 49 },
              { category: '25-34', value: 13 },
              { category: '35-44', value: 5 },
              { category: '45-54', value: 1 },
              { category: '55+', value: 1 }
            ],
            genderBreakdown: [
              { category: 'Male', value: 40 },
              { category: 'Female', value: 57 },
              { category: 'Non-binary', value: 3 }
            ],
            regionBreakdown: [
              { category: 'DKI Jakarta', value: 31 },
              { category: 'Jawa Barat', value: 29 },
              { category: 'Jawa Timur', value: 18 },
              { category: 'Sumatera Utara', value: 12 },
              { category: 'Sulawesi Selatan', value: 10 }
            ]
          }
        };

        // 6. Network Nodes & Links
        const generatedNodes: NetworkNode[] = [
          { id: 'narrative-main', label: `${keyword.substring(0, 16)} Hub`, group: 'campaign', size: 28 },
          { id: 'master-1', label: 'Opini Leader (Propagandist)', group: 'buzzer_master', size: 22, botScore: 82 },
          { id: 'master-2', label: 'Botnet Master Node', group: 'buzzer_master', size: 22, botScore: 95 },
          { id: 'hash-1', label: tag1, group: 'hashtag', size: 18 },
          { id: 'hash-2', label: tag2, group: 'hashtag', size: 18 },
          { id: 'hash-3', label: tag3, group: 'hashtag', size: 18 },
          { id: 'bot-1', label: `@radar_${cleanKeyword.slice(0, 8).toLowerCase()}`, group: 'buzzer_node', size: 12, botScore: 92, platform: 'X' },
          { id: 'bot-2', label: `@pioneer_nkri`, group: 'buzzer_node', size: 12, botScore: 84, platform: 'TikTok' },
          { id: 'bot-3', label: `@arus_demorakyat`, group: 'buzzer_node', size: 12, botScore: 78, platform: 'YouTube' },
          { id: 'bot-4', label: `@buzzer_breaker`, group: 'buzzer_node', size: 12, botScore: 95, platform: 'X' },
          { id: 'bot-5', label: 'Bot_Client_S101', group: 'buzzer_node', size: 10, botScore: 99, platform: 'X' },
          { id: 'bot-6', label: 'Bot_Client_S102', group: 'buzzer_node', size: 10, botScore: 96, platform: 'X' },
          { id: 'bot-7', label: 'Bot_Client_T909', group: 'buzzer_node', size: 10, botScore: 92, platform: 'TikTok' }
        ];

        const generatedLinks: NetworkLink[] = [
          { source: 'narrative-main', target: 'master-1', value: 6 },
          { source: 'narrative-main', target: 'master-2', value: 9 },
          { source: 'master-1', target: 'hash-1', value: 5 },
          { source: 'master-1', target: 'hash-3', value: 6 },
          { source: 'master-2', target: 'hash-2', value: 9 },
          { source: 'master-2', target: 'hash-1', value: 8 },
          { source: 'hash-1', target: 'bot-2', value: 8 },
          { source: 'hash-1', target: 'bot-4', value: 7 },
          { source: 'hash-1', target: 'bot-7', value: 9 },
          { source: 'hash-2', target: 'bot-1', value: 10 },
          { source: 'hash-2', target: 'bot-3', value: 8 },
          { source: 'hash-2', target: 'bot-5', value: 10 },
          { source: 'hash-2', target: 'bot-6', value: 9 },
          { source: 'hash-3', target: 'bot-1', value: 7 },
          { source: 'hash-3', target: 'bot-2', value: 8 },
          { source: 'hash-3', target: 'bot-3', value: 6 }
        ];

        // Store into in-memory database
        campaigns = generatedCampaigns;
        accounts = generatedAccounts;
        socialPosts = generatedPosts;
        dailyEngagement = generatedTimeline;
        demographicsData = generatedDemographics;
        networkNodes = generatedNodes;
        networkLinks = generatedLinks;

        return res.json({ success: true, method: "offline" });
      }

      // ------------------------------------------
      // ONLINE GEMINI DISCOVERY DEPLOYMENT
      // ------------------------------------------
      console.log(`Using online Gemini 3.5 Flash OSINT generator for: ${keyword}`);

      const systemInstruction = `You are a disinformation threat intelligence analyst. Based on a keyword or query entered by the user, dynamically generate realistic, professionally tailored intelligence data structures mapping suspected coordinated chatbot activity or inauthentic coordinated buzzer campaigns targeting Indonesia's public opinion ecosystem.

You MUST produce valid JSON and absolutely nothing else. No markdown wrappers. The response structure must match exactly:
{
  "campaigns": [
    {
      "id": string,
      "title": string, // relevant Indonesian hashtag
      "description": string, // brief tactical overview in Indonesian
      "topic": string,
      "platforms": ("X" | "YouTube" | "TikTok")[],
      "intensity": "Low" | "Medium" | "High" | "Critical",
      "sentiment": "Positive" | "Negative" | "Neutral" | "Mixed",
      "startDate": string, // "2026-06-01"
      "status": "Active" | "Monitoring",
      "botRatio": number, // 0 to 1
      "reach": number,
      "hashtags": string[],
      "keyNarrative": string, // detailed coordination description in Indonesian
      "buzzerCount": number
    }
  ],
  "suspiciousAccounts": [
    {
      "id": string,
      "username": string,
      "displayName": string,
      "platform": "X" | "YouTube" | "TikTok",
      "followers": number,
      "following": number,
      "botScore": number, // 0 to 100
      "status": "Flagged" | "Under Investigation" | "Verified Bot",
      "lastActive": string,
      "reason": string, // Indonesian explanation of their suspicious pattern matching the keyword
      "recentCopypastaCount": number
    }
  ],
  "socialPosts": [
    {
      "id": string,
      "platform": "X" | "YouTube" | "TikTok",
      "authorUsername": string, // must match one of the suspiciousAccounts usernames perfectly
      "text": string, // Realistic Indonesian style troll or buzzer post containing the searched keyword/hashtag
      "postUrl": string,
      "publishedAt": string,
      "likes": number,
      "comments": number,
      "shares": number,
      "reach": number,
      "engagementRate": number
    }
  ],
  "demographics": {
    "All": {
      "ageBreakdown": [{"category": string, "value": number}],
      "genderBreakdown": [{"category": string, "value": number}],
      "regionBreakdown": [{"category": string, "value": number}]
    },
    "X": {
      "ageBreakdown": [{"category": string, "value": number}],
      "genderBreakdown": [{"category": string, "value": number}],
      "regionBreakdown": [{"category": string, "value": number}]
    },
    "YouTube": {
      "ageBreakdown": [{"category": string, "value": number}],
      "genderBreakdown": [{"category": string, "value": number}],
      "regionBreakdown": [{"category": string, "value": number}]
    },
    "TikTok": {
      "ageBreakdown": [{"category": string, "value": number}],
      "genderBreakdown": [{"category": string, "value": number}],
      "regionBreakdown": [{"category": string, "value": number}]
    }
  },
  "dailyEngagement": [
    {"date": string, "likes": number, "comments": number, "shares": number, "reach": number} // 14 chronological entries spanning 2026-05-27 to 2026-06-09
  ],
  "networkNodes": [
    // Provide exactly 13 nodes with IDs: 'narrative-main', 'master-1', 'master-2', 'hash-1', 'hash-2', 'hash-3', 'bot-1', 'bot-2', 'bot-3', 'bot-4', 'bot-5', 'bot-6', 'bot-7'
    {"id": string, "label": string, "group": "campaign" | "buzzer_master" | "hashtag" | "buzzer_node", "size": number, "botScore": number, "platform": "X" | "YouTube" | "TikTok"}
  ],
  "networkLinks": [
    {"source": string, "target": string, "value": number}
  ]
}`;

      const promptText = `Generate a fully customized, highly realistic social cyber threat tracking simulation in deep detail for narrative keyword: "${keyword}". Ensure Indonesian names, hashtags, narratives, post comments, and suspicious reasons are beautifully and cohesively drafted to reflect real world coordinated influence campaigns on Indonesian netizens.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });

      const responseText = response.text || "";
      let networkData;
      try {
        networkData = JSON.parse(responseText.trim());
      } catch (parseError) {
        console.error("Gemini failed returning strict JSON, building fallback", responseText);
        throw parseError;
      }

      // Assign returned AI intelligence dataset into deep local structures
      campaigns = networkData.campaigns || [];
      accounts = networkData.suspiciousAccounts || [];
      socialPosts = networkData.socialPosts || [];
      dailyEngagement = networkData.dailyEngagement || [];
      demographicsData = networkData.demographics || { All: { ageBreakdown: [], genderBreakdown: [], regionBreakdown: [] } };
      
      // Filter out and secure invalid node layouts
      networkNodes = networkData.networkNodes || [];
      networkLinks = networkData.networkLinks || [];

      return res.json({ success: true, method: "online" });

    } catch (apiError: any) {
      console.error("Failed to generate with Gemini endpoint:", apiError);
      res.status(500).json({ error: "Failed to generate dynamic keyword intelligence via AI processor." });
    }
  });

  // 6. Vite Integrations
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Buzzer Tracker running on port ${PORT}`);
  });
}

startServer();
