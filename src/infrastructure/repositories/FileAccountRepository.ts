import { SuspiciousAccount } from '../../core/domain/entities';
import { IAccountRepository } from '../../core/domain/repositories/IAccountRepository';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ACCOUNT_FILE = path.join(DATA_DIR, 'accounts.json');

class FileAccountRepository implements IAccountRepository {
  private accounts: SuspiciousAccount[] = [];

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
      const data = await fs.readFile(ACCOUNT_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      this.accounts = parsed as SuspiciousAccount[];
    } catch {
      this.accounts = [];
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      await fs.writeFile(ACCOUNT_FILE, JSON.stringify(this.accounts, null, 2));
    } catch (err) {
      console.error('Failed to save accounts:', err);
    }
  }

  async getAll(): Promise<SuspiciousAccount[]> {
    await this.saveToFile();
    return [...this.accounts];
  }

  async findById(id: string): Promise<SuspiciousAccount | null> {
    return this.accounts.find(a => a.id === id) || null;
  }

  async create(account: SuspiciousAccount): Promise<SuspiciousAccount> {
    this.accounts.unshift(account);
    await this.saveToFile();
    return account;
  }
}

export { FileAccountRepository };