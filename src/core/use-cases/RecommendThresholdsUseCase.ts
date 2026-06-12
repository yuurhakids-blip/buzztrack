import { Campaign, SuspiciousAccount, ThresholdRecommendation } from '../domain/entities';
import { IGeminiRepository } from '../domain/repositories/IGeminiRepository';
import { callGemini, GeminiError } from '../../infrastructure/services/GeminiService';

export class RecommendThresholdsUseCase {
  constructor(private geminiRepo: IGeminiRepository) {}

  async execute(campaigns: Campaign[], accounts: SuspiciousAccount[]): Promise<ThresholdRecommendation> {
    const key = await this.geminiRepo.getKey();
    if (key) {
      try {
        return await this.callGemini(campaigns, accounts, key);
      } catch (e) {
        if (e instanceof GeminiError) console.warn('Gemini fallback:', e.message);
        return this.fallbackHeuristic(campaigns, accounts);
      }
    }
    return this.fallbackHeuristic(campaigns, accounts);
  }

  private async callGemini(campaigns: Campaign[], accounts: SuspiciousAccount[], key: string): Promise<ThresholdRecommendation> {
    const avgBot = accounts.length ? Math.round(accounts.reduce((s, a) => s + a.botScore, 0) / accounts.length) : 0;
    const avgRatio = campaigns.length ? Math.round(campaigns.reduce((s, c) => s + c.botRatio, 0) / campaigns.length * 100) : 0;
    const prompt = `Based on current data — avg botScore: ${avgBot}, avg botRatio: ${avgRatio}%, total accounts: ${accounts.length}, total campaigns: ${campaigns.length}. Recommend thresholds. Respond JSON: { "suggestedBotScoreThreshold": 0-100, "suggestedCopypastaThreshold": number, "reasoning": "text" }`;
    const text = await callGemini(prompt, key);
    return { ...JSON.parse(text), fallback: false };
  }

  private fallbackHeuristic(campaigns: Campaign[], accounts: SuspiciousAccount[]): ThresholdRecommendation {
    const avgBotScore = accounts.length ? Math.round(accounts.reduce((s, a) => s + a.botScore, 0) / accounts.length) : 50;
    const avgCopypasta = accounts.length ? Math.round(accounts.reduce((s, a) => s + a.recentCopypastaCount, 0) / accounts.length) : 3;
    return {
      suggestedBotScoreThreshold: Math.max(40, Math.min(90, avgBotScore + 10)),
      suggestedCopypastaThreshold: Math.max(2, Math.min(20, avgCopypasta + 2)),
      reasoning: `Based on ${accounts.length} tracked accounts (avg botScore ${avgBotScore}) and ${campaigns.length} campaigns`,
      fallback: true,
    };
  }
}
