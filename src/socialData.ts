import { SocialAccount, SocialPost, DailyEngagement, AudienceDemographics } from './types';

// Preconnected social accounts initialized as empty (as requested "hilangkan data dummy")
export const INITIAL_SOCIAL_ACCOUNTS: SocialAccount[] = [];

// Rich set of posts initialized as empty
export const INITIAL_SOCIAL_POSTS: SocialPost[] = [];

// Combined demographics breakdown templates for our social audience tracking (customized for YouTube, TikTok & X)
export const INITIAL_DEMOGRAPHICS: Record<string, AudienceDemographics> = {
  All: {
    ageBreakdown: [
      { category: '13-17', value: 12 },
      { category: '18-24', value: 42 },
      { category: '25-34', value: 32 },
      { category: '35-44', value: 9 },
      { category: '45-54', value: 4 },
      { category: '55+', value: 1 }
    ],
    genderBreakdown: [
      { category: 'Male', value: 48 },
      { category: 'Female', value: 49 },
      { category: 'Non-binary', value: 3 }
    ],
    regionBreakdown: [
      { category: 'DKI Jakarta', value: 38 },
      { category: 'Jawa Barat', value: 24 },
      { category: 'Jawa Timur', value: 16 },
      { category: 'Sumatera Utara', value: 12 },
      { category: 'Sulawesi Selatan', value: 10 }
    ]
  },
  X: {
    ageBreakdown: [
      { category: '13-17', value: 5 },
      { category: '18-24', value: 45 },
      { category: '25-34', value: 35 },
      { category: '35-44', value: 10 },
      { category: '45-54', value: 4 },
      { category: '55+', value: 1 }
    ],
    genderBreakdown: [
      { category: 'Male', value: 58 },
      { category: 'Female', value: 39 },
      { category: 'Non-binary', value: 3 }
    ],
    regionBreakdown: [
      { category: 'DKI Jakarta', value: 55 },
      { category: 'Jawa Barat', value: 18 },
      { category: 'Jawa Timur', value: 11 },
      { category: 'Sumatera Utara', value: 9 },
      { category: 'Sulawesi Selatan', value: 7 }
    ]
  },
  YouTube: {
    ageBreakdown: [
      { category: '13-17', value: 15 },
      { category: '18-24', value: 35 },
      { category: '25-34', value: 30 },
      { category: '35-44', value: 12 },
      { category: '45-54', value: 6 },
      { category: '55+', value: 2 }
    ],
    genderBreakdown: [
      { category: 'Male', value: 52 },
      { category: 'Female', value: 45 },
      { category: 'Non-binary', value: 3 }
    ],
    regionBreakdown: [
      { category: 'DKI Jakarta', value: 32 },
      { category: 'Jawa Barat', value: 25 },
      { category: 'Jawa Timur', value: 18 },
      { category: 'Sumatera Utara', value: 13 },
      { category: 'Sulawesi Selatan', value: 12 }
    ]
  },
  TikTok: {
    ageBreakdown: [
      { category: '13-17', value: 28 },
      { category: '18-24', value: 48 },
      { category: '25-34', value: 16 },
      { category: '35-44', value: 5 },
      { category: '45-54', value: 2 },
      { category: '55+', value: 1 }
    ],
    genderBreakdown: [
      { category: 'Male', value: 42 },
      { category: 'Female', value: 55 },
      { category: 'Non-binary', value: 3 }
    ],
    regionBreakdown: [
      { category: 'DKI Jakarta', value: 30 },
      { category: 'Jawa Barat', value: 28 },
      { category: 'Jawa Timur', value: 17 },
      { category: 'Sumatera Utara', value: 14 },
      { category: 'Sulawesi Selatan', value: 11 }
    ]
  }
};

// Past 14 days dynamic metrics timeline
export const INITIAL_DAILY_ENGAGEMENT: DailyEngagement[] = [
  { date: '2026-05-27', likes: 12300, comments: 1450, shares: 3200, reach: 180000 },
  { date: '2026-05-28', likes: 13100, comments: 1600, shares: 3500, reach: 195000 },
  { date: '2026-05-29', likes: 14500, comments: 1820, shares: 3880, reach: 215000 },
  { date: '2026-05-30', likes: 15100, comments: 2010, shares: 4200, reach: 232000 },
  { date: '2026-05-31', likes: 16400, comments: 2100, shares: 4800, reach: 250000 },
  { date: '2026-06-01', likes: 18000, comments: 2340, shares: 5400, reach: 282000 },
  { date: '2026-06-02', likes: 17200, comments: 2200, shares: 5100, reach: 270000 },
  { date: '2026-06-03', likes: 19400, comments: 2600, shares: 5900, reach: 305000 },
  { date: '2026-06-04', likes: 21000, comments: 2850, shares: 6400, reach: 330000 },
  { date: '2026-06-05', likes: 22500, comments: 2980, shares: 6900, reach: 355000 },
  { date: '2026-06-06', likes: 25400, comments: 3410, strokeWidth: undefined, shares: 7800, reach: 410000 } as any,
  { date: '2026-06-07', likes: 23800, comments: 3100, shares: 7200, reach: 390000 },
  { date: '2026-06-08', likes: 26100, comments: 3650, shares: 8100, reach: 425000 },
  { date: '2026-06-09', likes: 28600, comments: 4100, shares: 9200, reach: 468000 }
];
