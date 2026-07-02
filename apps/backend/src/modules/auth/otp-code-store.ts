export interface StoredOtpCode {
  code: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OtpCodeStore {
  save(phone: string, entry: StoredOtpCode): Promise<void>;
  find(phone: string): Promise<StoredOtpCode | null>;
  delete(phone: string): Promise<void>;
}

/**
 * Em memória — suficiente pra um backend rodando como processo único
 * (MVP). Vira Redis no dia em que existir mais de uma instância; a
 * interface já isola essa troca.
 */
export class InMemoryOtpCodeStore implements OtpCodeStore {
  private readonly entries = new Map<string, StoredOtpCode>();

  async save(phone: string, entry: StoredOtpCode): Promise<void> {
    this.entries.set(phone, entry);
  }

  async find(phone: string): Promise<StoredOtpCode | null> {
    return this.entries.get(phone) ?? null;
  }

  async delete(phone: string): Promise<void> {
    this.entries.delete(phone);
  }
}

/** Instância única do processo — mesmo padrão do `db` em db/client.ts. */
export const otpCodeStore: OtpCodeStore = new InMemoryOtpCodeStore();
