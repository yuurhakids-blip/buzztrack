import { Campaign } from '../../core/domain/entities';
import { ICampaignRepository } from '../../core/domain/repositories/ICampaignRepository';

export class InMemoryCampaignRepository implements ICampaignRepository {
  private campaigns: Campaign[] = [];

  async getAll(): Promise<Campaign[]> {
    return this.campaigns;
  }

  async findById(id: string): Promise<Campaign | null> {
    return this.campaigns.find(c => c.id === id) || null;
  }

  async create(campaign: Campaign): Promise<Campaign> {
    this.campaigns.unshift(campaign);
    return campaign;
  }
}
