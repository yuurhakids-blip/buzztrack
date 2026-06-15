import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { mkdir } from 'fs/promises';

interface BuzztrackDatabase {
  campaigns: any[];
  accounts: any[];
  posts: any[];
  timeline: any[];
  trendPosts: any[];
  trendCampaigns: any[];
  trendAccounts: any[];
  trendHistory: Array<{
    date: string;
    keyword: string;
    totalPosts: number;
    platforms: Record<string, {
      postCount: number;
      totalEngagement: number;
      topHashtags: string[];
      avgSentiment: string;
      topPosts: Array<{ text: string; url: string }>;
    }>;
  }>;
  aiCache: Array<{ key: string; value: any; timestamp: number }>;
  exportLogs: Array<{
    id: string;
    type: 'csv' | 'pdf';
    tab: string;
    createdAt: string;
    filters: any;
  }>;
  scraperSchedule: {
    enabled: boolean;
    interval: number;
    keywords: string[];
    lastRun: string | null;
  };
}

const filePath = path.join(process.cwd(), 'data', 'db.json');

const defaultData: BuzztrackDatabase = {
  campaigns: [],
  accounts: [],
  posts: [],
  timeline: [],
  trendPosts: [],
  trendCampaigns: [],
  trendAccounts: [],
  trendHistory: [],
  aiCache: [],
  exportLogs: [],
  scraperSchedule: {
    enabled: false,
    interval: 60,
    keywords: [],
    lastRun: null,
  },
};

let db: Low<BuzztrackDatabase> | null = null;

export async function initDatabase(): Promise<Low<BuzztrackDatabase>> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const adapter = new JSONFile<BuzztrackDatabase>(filePath);
  db = new Low(adapter);
  await db.read();
  db.data = { ...defaultData, ...db.data };
  // Migrate old trendHistory entries that lack totalPosts (old format)
  db.data.trendHistory = db.data.trendHistory.filter((e: any) => typeof e.totalPosts === 'number');
  await db.write();
  return db;
}

export function getDb(): Low<BuzztrackDatabase> {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export async function saveSnapshot(
  keyword: string,
  data: {
    totalPosts: number;
    platforms: Record<string, {
      postCount: number;
      totalEngagement: number;
      topHashtags: string[];
      avgSentiment: string;
      topPosts: Array<{ text: string; url: string }>;
    }>;
  }
): Promise<void> {
  const instance = getDb();
  instance.data.trendHistory.push({
    date: new Date().toISOString().slice(0, 10),
    keyword,
    totalPosts: data.totalPosts,
    platforms: data.platforms,
  });
  await instance.write();
}

export function getTrendHistory(keyword?: string) {
  const instance = getDb();
  if (keyword) return instance.data.trendHistory.filter(e => e.keyword === keyword);
  return instance.data.trendHistory;
}
