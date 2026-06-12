export interface IGeminiRepository {
  saveKey(key: string): Promise<void>;
  getKey(): Promise<string>;
}
