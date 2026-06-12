import { SuspiciousAccount } from '../entities';

export interface IAccountRepository {
  getAll(): Promise<SuspiciousAccount[]>;
  findById(id: string): Promise<SuspiciousAccount | null>;
  create(account: SuspiciousAccount): Promise<SuspiciousAccount>;
}
