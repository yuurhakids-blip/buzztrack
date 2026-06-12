import { SuspiciousAccount } from '../../core/domain/entities';
import { IAccountRepository } from '../../core/domain/repositories/IAccountRepository';

export class InMemoryAccountRepository implements IAccountRepository {
  private accounts: SuspiciousAccount[] = [];

  async getAll(): Promise<SuspiciousAccount[]> {
    return this.accounts;
  }

  async findById(id: string): Promise<SuspiciousAccount | null> {
    return this.accounts.find(a => a.id === id) || null;
  }

  async create(account: SuspiciousAccount): Promise<SuspiciousAccount> {
    this.accounts.unshift(account);
    return account;
  }
}
