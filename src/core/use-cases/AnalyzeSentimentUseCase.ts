import { PostSentimentResult } from '../domain/entities';
import { IGeminiRepository } from '../domain/repositories/IGeminiRepository';
import { callGemini, GeminiError } from '../../infrastructure/services/GeminiService';

export class AnalyzeSentimentUseCase {
  constructor(private geminiRepo: IGeminiRepository) {}

  async execute(text: string): Promise<PostSentimentResult> {
    const key = await this.geminiRepo.getKey();
    if (key) {
      try {
        return await this.callGemini(text, key);
      } catch (e) {
        if (e instanceof GeminiError) console.warn('Gemini fallback:', e.message);
        return this.fallbackHeuristic(text);
      }
    }
    return this.fallbackHeuristic(text);
  }

  private async callGemini(text: string, key: string): Promise<PostSentimentResult> {
    const prompt = `Analyze the sentiment of this social media post. Text: "${text.slice(0, 500)}". Respond with JSON: { "sentiment": "positive"|"negative"|"neutral", "sentimentScore": -100 to 100, "explanation": "brief text" }`;
    const raw = await callGemini(prompt, key);
    return { ...JSON.parse(raw), fallback: false };
  }

  private fallbackHeuristic(text: string): PostSentimentResult {
    const lower = text.toLowerCase();
    const posWords = ['baik', 'senang', 'dukung', 'setuju', 'terima kasih', 'bangga', 'sukses', 'hebat', 'amen', 'amin'];
    const negWords = ['jahat', 'benci', 'tolak', 'curang', 'hoax', 'korupsi', 'rusak', 'bodoh', 'goblok', 'hancur'];
    const posCount = posWords.filter(w => lower.includes(w)).length;
    const negCount = negWords.filter(w => lower.includes(w)).length;
    const score = Math.max(-100, Math.min(100, (posCount - negCount) * 15 + (Math.random() > 0.7 ? (posCount > negCount ? 10 : -10) : 0)));
    const sentiment: 'positive' | 'negative' | 'neutral' = score > 15 ? 'positive' : score < -15 ? 'negative' : 'neutral';
    return {
      sentiment,
      sentimentScore: Math.round(score),
      explanation: posCount || negCount ? `Detected ${posCount} positive and ${negCount} negative keywords` : 'No strong signal',
      fallback: true,
    };
  }
}
