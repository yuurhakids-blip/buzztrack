import { Campaign, CampaignSummaryResult } from '../domain/entities';
import { IGeminiRepository } from '../domain/repositories/IGeminiRepository';
import { callGemini, GeminiError } from '../../infrastructure/services/GeminiService';

export class SummarizeCampaignUseCase {
  constructor(private geminiRepo: IGeminiRepository) {}

  async execute(campaign: Campaign): Promise<CampaignSummaryResult> {
    const key = await this.geminiRepo.getKey();
    if (key) {
      try {
        return await this.callGemini(campaign, key);
      } catch (e) {
        if (e instanceof GeminiError) console.warn('Gemini fallback:', e.message);
        return this.fallbackHeuristic(campaign);
      }
    }
    return this.fallbackHeuristic(campaign);
  }

  private async callGemini(campaign: Campaign, key: string): Promise<CampaignSummaryResult> {
    const prompt = `Summarize this disinformation campaign: Title: "${campaign.title}". Description: "${campaign.description}". Topic: "${campaign.topic}". Hashtags: ${campaign.hashtags.join(', ')}. Intensity: ${campaign.intensity}. Sentiment: ${campaign.sentiment}. Respond with JSON: { "summary": "2-3 sentence analysis", "keyInsights": [string], "riskLevel": "low"|"medium"|"high" }`;
    const text = await callGemini(prompt, key);
    return { ...JSON.parse(text), fallback: false };
  }

  private fallbackHeuristic(campaign: Campaign): CampaignSummaryResult {
    const intensity = campaign.intensity;
    const riskLevel: 'low' | 'medium' | 'high' = intensity === 'Critical' || intensity === 'High' ? 'high' : intensity === 'Medium' ? 'medium' : 'low';
    const insights: string[] = [];
    if (campaign.botRatio > 0.5) insights.push(`Bot ratio ${Math.round(campaign.botRatio * 100)}% indicates automation`);
    if (campaign.reach > 100000) insights.push(`Wide reach of ${campaign.reach.toLocaleString()} impressions`);
    insights.push(`Uses ${campaign.hashtags.length} coordinated hashtags`);
    return {
      summary: `Campaign "${campaign.title}" (${campaign.topic}) — ${campaign.status}. Sentiment leans ${campaign.sentiment.toLowerCase()} with ${campaign.buzzerCount} tracked agents.`,
      keyInsights: insights,
      riskLevel,
      fallback: true,
    };
  }
}
