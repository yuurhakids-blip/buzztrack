import { ReportClassificationResult } from '../domain/entities';
import { IGeminiRepository } from '../domain/repositories/IGeminiRepository';
import { callGemini, GeminiError } from '../../infrastructure/services/GeminiService';

export class ClassifyReportUseCase {
  constructor(private geminiRepo: IGeminiRepository) {}

  async execute(url: string, narrative: string, evidence: string): Promise<ReportClassificationResult> {
    const key = await this.geminiRepo.getKey();
    if (key) {
      try {
        return await this.callGemini(url, narrative, evidence, key);
      } catch (e) {
        if (e instanceof GeminiError) console.warn('Gemini fallback:', e.message);
        return this.fallbackHeuristic(url, narrative, evidence);
      }
    }
    return this.fallbackHeuristic(url, narrative, evidence);
  }

  private async callGemini(url: string, narrative: string, evidence: string, key: string): Promise<ReportClassificationResult> {
    const prompt = `Classify this user report as valid or spam. URL: "${url}". Narrative: "${narrative}". Evidence: "${evidence}". Respond with JSON: { "isValid": bool, "category": "politics"|"scam"|"hoax"|"coordination"|"other", "confidence": 0-100, "explanation": "text" }`;
    const text = await callGemini(prompt, key);
    return { ...JSON.parse(text), fallback: false };
  }

  private fallbackHeuristic(url: string, narrative: string, evidence: string): ReportClassificationResult {
    const lower = (narrative + ' ' + evidence).toLowerCase();
    const categories: { word: string; cat: string }[] = [
      { word: 'politik', cat: 'politics' }, { word: 'pemilu', cat: 'politics' },
      { word: 'penipuan', cat: 'scam' }, { word: ' scam', cat: 'scam' },
      { word: 'hoax', cat: 'hoax' }, { word: 'hoaks', cat: 'hoax' },
      { word: 'boikot', cat: 'coordination' }, { word: 'tagar', cat: 'coordination' },
    ];
    let matchedCat = 'other';
    for (const { word, cat } of categories) {
      if (lower.includes(word)) { matchedCat = cat; break; }
    }
    const hasUrl = url.startsWith('http');
    const hasNarrative = narrative.length > 10;
    return {
      isValid: hasUrl && hasNarrative,
      category: matchedCat,
      confidence: hasUrl && hasNarrative ? 60 : 20,
      explanation: hasUrl && hasNarrative ? 'Report has valid URL and narrative content' : 'Incomplete report data',
      fallback: true,
    };
  }
}
