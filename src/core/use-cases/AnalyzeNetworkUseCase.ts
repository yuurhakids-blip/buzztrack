import { NetworkAnalysisResult, NetworkNode, NetworkLink } from '../domain/entities';
import { IGeminiRepository } from '../domain/repositories/IGeminiRepository';
import { callGemini, GeminiError } from '../../infrastructure/services/GeminiService';

export class AnalyzeNetworkUseCase {
  constructor(private geminiRepo: IGeminiRepository) {}

  async execute(nodes: NetworkNode[], links: NetworkLink[]): Promise<NetworkAnalysisResult> {
    const key = await this.geminiRepo.getKey();
    if (key) {
      try {
        return await this.callGemini(nodes, links, key);
      } catch (e) {
        if (e instanceof GeminiError) console.warn('Gemini fallback:', e.message);
        return this.fallbackHeuristic(nodes, links);
      }
    }
    return this.fallbackHeuristic(nodes, links);
  }

  private async callGemini(nodes: NetworkNode[], links: NetworkLink[], key: string): Promise<NetworkAnalysisResult> {
    const prompt = `Analyze this social media coordination network. Nodes: ${JSON.stringify(nodes.slice(0, 50))}. Links: ${JSON.stringify(links.slice(0, 100))}. Respond with JSON: { "coordinationDetected": bool, "coordinationScore": 0-100, "patterns": [string], "summary": "text" }`;
    const text = await callGemini(prompt, key);
    return { ...JSON.parse(text), fallback: false };
  }

  private fallbackHeuristic(nodes: NetworkNode[], links: NetworkLink[]): NetworkAnalysisResult {
    const campaignNodes = nodes.filter(n => n.group === 'campaign').length;
    const buzzerNodes = nodes.filter(n => n.group === 'buzzer_node').length;
    const avgLinksPerNode = links.length / (nodes.length || 1);
    const score = Math.min(100, Math.round(buzzerNodes * 5 + avgLinksPerNode * 10 + campaignNodes * 8));
    const patterns: string[] = [];
    if (buzzerNodes > 3) patterns.push('Multiple buzzer nodes detected around campaign hubs');
    if (avgLinksPerNode > 2) patterns.push('High link density suggests coordinated amplification');
    return {
      coordinationDetected: score > 40,
      coordinationScore: Math.min(100, score),
      patterns: patterns.length ? patterns : ['No clear coordination pattern'],
      summary: patterns.length ? `Detected ${buzzerNodes} buzzer nodes with ${links.length} coordination links` : 'Network appears organic',
      fallback: true,
    };
  }
}
