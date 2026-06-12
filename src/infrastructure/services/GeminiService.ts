import fetch from 'node-fetch';

export interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiError extends Error {
  constructor(message: string, public code: 'NO_KEY' | 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'SAFETY_BLOCK' | 'API_ERROR') {
    super(message);
    this.name = 'GeminiError';
  }
}

export async function callGemini(prompt: string, key: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json() as GeminiResponse;

  if (!res.ok) {
    const errMsg = body?.promptFeedback?.blockReason || body?.candidates?.[0]?.finishReason || '';
    if (res.status === 429 || res.status === 403) {
      throw new GeminiError(body?.candidates?.[0]?.content?.parts?.[0]?.text || 'Rate limited', 'RATE_LIMIT');
    }
    if (res.status === 400 && errMsg === 'SAFETY') {
      throw new GeminiError('Content blocked by safety filters', 'SAFETY_BLOCK');
    }
    if (res.status === 402 || res.status === 403) {
      throw new GeminiError('API quota exceeded', 'QUOTA_EXCEEDED');
    }
    throw new GeminiError(`API error: ${res.status}`, 'API_ERROR');
  }

  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiError('Empty response from Gemini', 'API_ERROR');
  }

  return text;
}
