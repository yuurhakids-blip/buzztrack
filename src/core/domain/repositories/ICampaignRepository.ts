import { Campaign } from '../entities/index.ts';

export interface ICampaignRepository {
  getAll(): Promise<Campaign[]>;
  findById(id: string): Promise<Campaign | null>;
  create(campaign: Campaign): Promise<Campaign>;
}
