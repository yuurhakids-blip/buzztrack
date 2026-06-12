import { Campaign } from '../../core/domain/entities';
import { ICampaignRepository } from '../../core/domain/repositories/ICampaignRepository';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CAMPAIGN_FILE = path.join(DATA_DIR, 'campaigns.json');

class FileCampaignRepository implements ICampaignRepository {
  private campaigns: Campaign[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadFromFile();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch {}
  }

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(CAMPAIGN_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      this.campaigns = parsed as Campaign[];
    } catch {
      this.campaigns = [];
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      await fs.writeFile(CAMPAIGN_FILE, JSON.stringify(this.campaigns, null, 2));
    } catch (err) {
      console.error('Failed to save campaigns:', err);
    }
  }

  async getAll(): Promise<Campaign[]> {
    await this.saveToFile();
    return [...this.campaigns]; // return copy
  }

  async findById(id: string): Promise<Campaign | null> {
    return this.campaigns.find(c => c.id === id) || null;
  }

  async create(campaign: Campaign): Promise<Campaign> {
    this.campaigns.unshift(campaign);
    await this.saveToFile();
    return campaign;
  }
}

export { FileCampaignRepository };