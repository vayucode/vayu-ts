import type { DeductCreditsRequest, GrantCreditsRequest } from '../../openapi';
import { CreditsApi } from '../../openapi';
import { ConfigurationService } from '../services';
import type { PaginationOptions } from '../types';

export class CreditsClient {
  private client: CreditsApi;

  constructor() {
    this.client = ConfigurationService.instance.generateNewClient(CreditsApi);
  }

  async deduct(payload: DeductCreditsRequest) {
    return this.client.deductCredits(payload);
  }

  async grant(payload: GrantCreditsRequest) {
    return this.client.grantCredits(payload);
  }

  async listLedgerEntries(customerId: string, pagination?: PaginationOptions) {
    const cursor = pagination?.cursor;
    const limit = pagination?.limit;

    return this.client.listCreditLedgerEntries(customerId, limit, cursor);
  }
}
