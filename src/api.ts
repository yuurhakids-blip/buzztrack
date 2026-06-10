import type {
  Campaign,
  SuspiciousAccount,
  AnalysisResponse,
  UserReport,
  NetworkNode,
  NetworkLink,
  SocialAccount,
  SocialPost,
  DailyEngagement,
  AudienceDemographics,
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE || '';

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${response.status})`, response.status);
  }

  if (response.status === 204) return undefined as T;

  return response.json();
}

export const api = {
  // Campaigns
  campaigns: {
    list: () => request<Campaign[]>('/api/campaigns'),
  },

  // Suspicious Accounts
  accounts: {
    list: () => request<SuspiciousAccount[]>('/api/accounts'),
  },

  // Stats
  stats: {
    get: () =>
      request<{
        totalCampaigns: number;
        activeCampaignsCount: number;
        totalReach: number;
        activeBuzzersCount: number;
        avgBotScore: number;
        recentReportsCount: number;
      }>('/api/stats'),
  },

  // Reports
  reports: {
    submit: (data: {
      url: string;
      username?: string;
      platform: string;
      narrative: string;
      evidence?: string;
      email?: string;
    }) =>
      request<{ success: boolean; report: UserReport }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Analysis
  analyze: (data: { type: string; content: string; platform: string }) =>
    request<AnalysisResponse>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Social
  social: {
    accounts: {
      list: () => request<SocialAccount[]>('/api/social/accounts'),
    },
    posts: {
      list: () => request<SocialPost[]>('/api/social/posts'),
    },
    demographics: {
      get: (platform: string) =>
        request<AudienceDemographics>(`/api/social/demographics?platform=${encodeURIComponent(platform)}`),
    },
    engagement: {
      get: () => request<DailyEngagement[]>('/api/social/engagement'),
    },
    auth: {
      getUrl: (platform: string) =>
        request<{ url: string; real: boolean }>(`/api/social/auth/url?platform=${encodeURIComponent(platform)}`),
    },
    connect: (platform: string, username: string) =>
      request<{ success: boolean; account: SocialAccount }>('/api/social/connect', {
        method: 'POST',
        body: JSON.stringify({ platform, username }),
      }),
    disconnect: (id: string) =>
      request<{ success: boolean }>('/api/social/disconnect', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    sync: (id: string) =>
      request<{ success: boolean; message: string }>('/api/social/sync', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    search: (keyword: string) =>
      request<{ success: boolean; method: string }>('/api/social/search', {
        method: 'POST',
        body: JSON.stringify({ keyword }),
      }),
  },

  // Network Graph
  network: {
    get: () => request<{ nodes: NetworkNode[]; links: NetworkLink[] }>('/api/network'),
  },

  // Scrapers Status
  scrapers: {
    status: () => request<{ twitter: boolean; youtube: boolean; tiktok: boolean }>('/api/scrapers/status'),
  },

  // Reports list
  reportsList: {
    list: () => request<UserReport[]>('/api/reports'),
  },
};
