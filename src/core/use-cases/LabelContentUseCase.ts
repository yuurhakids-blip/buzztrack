import { ContentLabelResult } from '../domain/entities';
import { IGeminiRepository } from '../domain/repositories/IGeminiRepository';
import { callGemini, GeminiError } from '../../infrastructure/services/GeminiService';

export class LabelContentUseCase {
  constructor(private geminiRepo: IGeminiRepository) {}

  async execute(text: string): Promise<ContentLabelResult> {
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

  private async callGemini(text: string, key: string): Promise<ContentLabelResult> {
    const prompt = `Categorize this social media post. Text: "${text.slice(0, 500)}". Respond with JSON: { "labels": [string], "primaryCategory": "politics"|"sara"|"hoax"|"promotion"|"normal"|"spam", "explanation": "text" }`;
    const raw = await callGemini(prompt, key);
    return { ...JSON.parse(raw), fallback: false };
  }

  private fallbackHeuristic(text: string): ContentLabelResult {
    const lower = text.toLowerCase();
    const labelMap: { word: string; label: string; cat: string }[] = [
      { word: 'pemilu', label: 'Election-related', cat: 'politics' },
      { word: 'politik', label: 'Political discourse', cat: 'politics' },
      { word: 'presiden', label: 'Presidential reference', cat: 'politics' },
      { word: 'suku', label: 'Ethnic reference', cat: 'sara' },
      { word: 'agama', label: 'Religious reference', cat: 'sara' },
      { word: 'ras', label: 'Racial reference', cat: 'sara' },
      { word: 'hoax', label: 'Hoax/false info', cat: 'hoax' },
      { word: 'promo', label: 'Promotional', cat: 'promotion' },
      { word: 'jasa', label: 'Promotional', cat: 'promotion' },
      { word: 'beli', label: 'Commercial', cat: 'promotion' },
      { word: 'gabung', label: 'Recruitment', cat: 'spam' },
      { word: 'sebar', label: 'Mass distribution', cat: 'spam' },
    ];
    const matched = labelMap.filter(({ word }) => lower.includes(word));
    const labels = matched.length ? [...new Set(matched.map(m => m.label))] : ['Uncategorized'];
    const primaryCategory = matched.length ? matched[0].cat : 'normal';
    return {
      labels,
      primaryCategory,
      explanation: matched.length ? `Matched ${matched.length} indicators: ${matched.map(m => m.word).join(', ')}` : 'No specific category indicators found',
      fallback: true,
    };
  }
}
