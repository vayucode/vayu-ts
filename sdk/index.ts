import { ContractsClient,
  CustomersClient,
  EventsClient,
  InvoicesClient,
  MetersClient,
  WebhooksClient,
  ProductConsumptionsClient } from './clients';
import { ConfigurationService } from './services';

export class Vayu {
  private configurationManager: ConfigurationService;

  constructor(
    apiKey: string,
    baseUrl?: string,
  ) {
    const baseServer = ConfigurationService.generateServerConfiguration(baseUrl);
    this.configurationManager = ConfigurationService.initialize(apiKey, baseServer);
  }

  /** @deprecated Authentication is now handled automatically. You can remove this call. */
  async login() {
    await this.configurationManager.generateToken();
  }

  get events() {
    return new EventsClient();
  }

  get customers() {
    return new CustomersClient();
  }

  get meters() {
    return new MetersClient();
  }

  get contracts() {
    return new ContractsClient();
  }

  get invoices() {
    return new InvoicesClient();
  }

  get webhooks() {
    return new WebhooksClient();
  }

  get productConsumptions() {
    return new ProductConsumptionsClient();
  }
}

export * from './types';
