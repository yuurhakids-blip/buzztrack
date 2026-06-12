export type Platform = 'X' | 'TikTok' | 'YouTube' | 'All';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  topic: string;
  platforms: Platform[];
  intensity: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
  startDate: string;
  status: 'Active' | 'Completed' | 'Monitoring';
  botRatio: number; // 0 to 1
  reach: number;
  hashtags: string[];
  keyNarrative: string;
  buzzerCount: number;
  predictedRiskTrend?: 'rising' | 'stable' | 'falling'; // New: Predictive
  aiInsight?: string; // New: Deep insight
  riskTrendMode?: 'AI' | 'Heuristic'; // New: Mode indicator for prediction
}

export interface SuspiciousAccount {
  id: string;
  username: string;
  displayName: string;
  platform: Platform;
  followers: number;
  following: number;
  botScore: number; // 0 to 100
  status: 'Flagged' | 'Under Investigation' | 'Verified Bot' | 'Suspended';
  lastActive: string;
  reason: string;
  recentCopypastaCount: number;
  aiEvidenceSummary?: string; // New: AI generated evidence
  clusterId?: string; // New: Botnet cluster group
}

export interface NetworkNode {
  id: string;
  label: string;
  group: 'campaign' | 'buzzer_master' | 'buzzer_node' | 'hashtag' | 'platform_hub';
  platform?: Platform;
  size: number;
  botScore?: number;
  postText?: string;
  postUrl?: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number; // strength of coordinated correlation
}

export interface AnalysisRequest {
  type: 'profile' | 'copypasta' | 'campaign';
  content: string; // post contents, text, or profile bio/stats JSON
  platform: Platform;
}

export interface AnalysisResponse {
  isBuzzer: boolean;
  confidenceScore: number; // 0 to 100
  botCharacteristics: string[];
  sentimentScore: number; // -100 (highly negative) to 100 (highly positive)
  detectedNarratives: string[];
  summary: string;
  redFlags: {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  verdict: 'Genuine Account' | 'Suspected Social Buzzer' | 'Coordinated Botnet Client' | 'Highly Repetitive Spammer';
}

export interface UserReport {
  id: string;
  reportedUrl: string;
  username: string;
  platform: Platform;
  narrativeDescription: string;
  evidenceText: string;
  reporterEmail?: string;
  timestamp: string;
  status: 'Pending Review' | 'Processed' | 'Dismissed';
}

export interface SocialAccount {
  id: string;
  username: string;
  displayName: string;
  platform: 'X' | 'YouTube' | 'TikTok';
  avatarUrl?: string;
  connectedAt: string;
  followersCount: number;
  postCount: number;
}

export interface SocialPost {
  id: string;
  platform: 'X' | 'YouTube' | 'TikTok';
  authorUsername: string;
  text: string;
  postUrl: string;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number; // For Twitter this is Retweets, YouTube/TikTok is shares
  reach: number;
  engagementRate: number; // calculated as ((likes+comments+shares)/reach) * 100 or relative
}

export interface DailyEngagement {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

export interface DemographicSegment {
  category: string; // e.g. "18-24", "25-34", etc; or "Male", "Female"; or "Indonesia", "US"
  value: number; // percentage or count
}

export interface AudienceDemographics {
  ageBreakdown: DemographicSegment[];
  genderBreakdown: DemographicSegment[];
  regionBreakdown: DemographicSegment[];
}

export interface NetworkAnalysisResult {
  coordinationDetected: boolean;
  coordinationScore: number;
  patterns: string[];
  summary: string;
  fallback?: boolean;
}

export interface CampaignSummaryResult {
  summary: string;
  keyInsights: string[];
  riskLevel: 'low' | 'medium' | 'high';
  fallback?: boolean;
}

export interface ReportClassificationResult {
  isValid: boolean;
  category: string;
  confidence: number;
  explanation: string;
  fallback?: boolean;
}

export interface PostSentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  explanation: string;
  fallback?: boolean;
}

export interface ThresholdRecommendation {
  suggestedBotScoreThreshold: number;
  suggestedCopypastaThreshold: number;
  reasoning: string;
  fallback?: boolean;
}

export interface ContentLabelResult {
  labels: string[];
  primaryCategory: string;
  explanation: string;
  fallback?: boolean;
}
