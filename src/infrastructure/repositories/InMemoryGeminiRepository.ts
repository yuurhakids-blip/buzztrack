import { IGeminiRepository } from '../../core/domain/repositories/IGeminiRepository';

export class InMemoryGeminiRepository implements IGeminiRepository {
  private key: string = '';

  async saveKey(key: string): Promise<void> {
    this.key = key;
  }

  async getKey(): Promise<string> {
    return this.key;
  }
}
