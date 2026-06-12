import { IGeminiRepository } from '../../core/domain/repositories/IGeminiRepository';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEY_FILE = path.join(DATA_DIR, 'gemini-key.json');

class FileGeminiRepository implements IGeminiRepository {
  private key: string = '';

  constructor() {
    this.ensureDataDir();
    this.load();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch {}
  }

  private async load(): Promise<void> {
    try {
      const data = await fs.readFile(KEY_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      this.key = parsed.key || '';
    } catch {}
    // Seed from env if no saved key (skip placeholder default)
    if (!this.key && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY') {
      this.key = process.env.GEMINI_API_KEY;
      await this.save();
    }
  }

  private async save(): Promise<void> {
    try {
      await fs.writeFile(KEY_FILE, JSON.stringify({ key: this.key }, null, 2));
    } catch (err) {
      console.error('Failed to save Gemini key:', err);
    }
  }

  async saveKey(key: string): Promise<void> {
    this.key = key;
    await this.save();
  }

  async getKey(): Promise<string> {
    return this.key;
  }
}

export { FileGeminiRepository };