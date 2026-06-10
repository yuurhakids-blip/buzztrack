import { SocialAccount, SocialPost, DailyEngagement, AudienceDemographics } from './types';

// Preconnected social accounts started dry
export const INITIAL_SOCIAL_ACCOUNTS: SocialAccount[] = [];

// Clean list of acquired posts
export const INITIAL_SOCIAL_POSTS: SocialPost[] = [];

// Empty initial demographics templates for robust rendering
export const INITIAL_DEMOGRAPHICS: Record<string, AudienceDemographics> = {
  All: {
    ageBreakdown: [],
    genderBreakdown: [],
    regionBreakdown: []
  },
  X: {
    ageBreakdown: [],
    genderBreakdown: [],
    regionBreakdown: []
  },
  YouTube: {
    ageBreakdown: [],
    genderBreakdown: [],
    regionBreakdown: []
  },
  TikTok: {
    ageBreakdown: [],
    genderBreakdown: [],
    regionBreakdown: []
  }
};

// Past 14 days engagement timeline started empty
export const INITIAL_DAILY_ENGAGEMENT: DailyEngagement[] = [];
